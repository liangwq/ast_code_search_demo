import Parser = require('tree-sitter');
import { ParsedNode, ParseResult, ParserOptions } from '../../core/types';
import { languageQueries } from './queries';

// 添加 Tree 和 Node 类型
type TreeSitterNode = {
  type: string;
  text: string;
  startPosition: { row: number; column: number };
  endPosition: { row: number; column: number };
  children: TreeSitterNode[];
};

type QueryMatch = {
  node: TreeSitterNode;
  name: string;
};

type TreeSitterTree = {
  rootNode: TreeSitterNode;
};

type TreeSitterQuery = {
  captures: (node: TreeSitterNode) => QueryMatch[];
};

export abstract class LanguageParser {
  protected parser!: Parser;
  protected language: any; // 这里保持 any 因为 tree-sitter 的类型定义不完整
  protected languageName: string;
  protected nodeTypeMap: Record<string, string[]>;

  constructor(languageName: string) {
    this.parser = new Parser();
    this.languageName = languageName;
    this.nodeTypeMap = this.getLanguageSpecificNodeTypes();
    this.initLanguage();
  }

  protected abstract initLanguage(): void;
  protected abstract getLanguageSpecificNodeTypes(): Record<string, string[]>;
  abstract getQueries(granularity: 'fine' | 'medium' | 'coarse'): string[];

  parse(sourceCode: string, options: ParserOptions): ParseResult {
    if (!this.parser || !this.language) {
      throw new Error('Parser not initialized');
    }

    this.parser.setLanguage(this.language);
    const tree = this.parser.parse(sourceCode) as TreeSitterTree;

    if (options.granularity === 'custom' && options.customRules) {
      return this.parseWithCustomRules(tree, options.customRules, options);
    }

    const rootNode = tree.rootNode;

    const nodes: Record<string, ParsedNode> = {};
    const rootNodes: string[] = [];
    let nodeId = 0;

    const processNode = (node: TreeSitterNode, parentId?: string) => {
      const currentId = `node_${nodeId++}`;
      
      // 根据粒度级别决定是否处理该节点
      const shouldProcess = this.shouldProcessNode(node.type, options.granularity || 'medium');
      
      if (shouldProcess) {
        let nodeName = 'anonymous';
        
        // 获取节点名称
        switch (node.type) {
          case 'function_declaration':
          case 'method_definition':
            const nameNode = node.children.find((n: any) => n.type === 'identifier');
            if (nameNode) nodeName = nameNode.text;
            break;
          case 'class_declaration':
            const classNameNode = node.children.find((n: any) => n.type === 'type_identifier');
            if (classNameNode) nodeName = classNameNode.text;
            break;
          
          // HTML 相关
          case 'element':
            const tagNode = node.children.find((n: any) => n.type === 'tag_name');
            if (tagNode) nodeName = tagNode.text;
            break;
          case 'attribute':
            const attrNameNode = node.children.find((n: any) => n.type === 'attribute_name');
            if (attrNameNode) nodeName = attrNameNode.text;
            break;
          
          // CSS 相关
          case 'rule_set':
            const selectorNode = node.children.find((n: any) => n.type === 'selector');
            if (selectorNode) nodeName = selectorNode.text;
            break;
          case 'declaration':
            const propertyNode = node.children.find((n: any) => n.type === 'property_name');
            if (propertyNode) nodeName = propertyNode.text;
            break;
          case 'selector':
          case 'class_selector':
          case 'id_selector':
            nodeName = node.text;
            break;
        }
    
        nodes[currentId] = {
          type: node.type,
          name: nodeName,
          range: {
            start: { row: node.startPosition.row, column: node.startPosition.column },
            end: { row: node.endPosition.row, column: node.endPosition.column }
          },
          parent: parentId,
          children: [],
          metadata: {
            nodeText: node.text,
            // 为 import 语句添加额外信息
            ...(node.type === 'import_declaration' && {
              importSource: nodeName,
              importType: node.children.some((n: any) => n.type === 'namespace_import') ? 'namespace' : 'named'
            })
          }
        };
    
        if (parentId && nodes[parentId]) {
          nodes[parentId].children = nodes[parentId].children || [];
          nodes[parentId].children.push(currentId);
        }
    
        if (!parentId) {
          rootNodes.push(currentId);
        }
      }
    
      // 递归处理子节点
      for (const child of node.children || []) {
        processNode(child, shouldProcess ? currentId : parentId);
      }
    };

    processNode(rootNode);

    return {
      nodes,
      rootNodes,
      language: this.languageName,
      filePath: options.filePath || 'unknown'
    };
  }

  private parseWithCustomRules(tree: TreeSitterTree, rules: string, options: ParserOptions): ParseResult {
    try {
      if (!this.language) {
        throw new Error('Language not initialized');
      }

      const query = this.language.query(rules.trim()) as TreeSitterQuery;
      if (!query || typeof query.captures !== 'function') {
        throw new Error('Invalid query object created');
      }

      const matches = query.captures(tree.rootNode);
      
      const nodes: Record<string, ParsedNode> = {};
      const rootNodes: string[] = [];
      let nodeId = 0;
  
      // 处理每个匹配项
      for (const match of matches) {
        const { node, name } = match;
        const id = `node_${nodeId++}`;
        
        // 获取节点名称
        // 获取节点名称
        let nodeName = 'anonymous';
        if (node.type === 'identifier' || 
            node.type === 'property_identifier' || 
            node.type === 'type_identifier' ||
            node.type === 'tag_name' ||
            node.type === 'attribute_name' ||
            node.type === 'property_name' ||
            node.type === 'selector' ||
            node.type === 'class_selector' ||
            node.type === 'id_selector') {
          nodeName = node.text;
        }
        
        nodes[id] = {
          type: node.type,
          name: nodeName,
          range: {
            start: { row: node.startPosition.row, column: node.startPosition.column },
            end: { row: node.endPosition.row, column: node.endPosition.column }
          },
          children: [],
          metadata: {
            captureType: name,
            nodeText: node.text
          }
        };
        
        rootNodes.push(id);
      }
  
      return {
        nodes,
        rootNodes,
        language: this.languageName,
        filePath: options.filePath || 'unknown'
      };
    } catch (error: unknown) {
      console.error('Error parsing with custom rules:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to parse with custom rules: ${errorMessage}`);
    }
  }

  private shouldProcessNode(type: string, granularity: ParserOptions['granularity']): boolean {
    const nodeTypes = this.nodeTypeMap[granularity || 'medium'] || [];
    return granularity === 'custom' || nodeTypes.includes(type);
  }

  protected findChildText(node: TreeSitterNode, type: string): string | undefined {
    const child = node.children.find(n => n.type === type);
    return child ? child.text : undefined;
  }

  protected findAttribute(node: TreeSitterNode, attrName: string): string | undefined {
    const startTag = node.children.find(c => c.type === 'start_tag');
    if (!startTag) return undefined;

    const attribute = startTag.children.find(c => {
      if (c.type !== 'attribute') return false;
      const nameNode = c.children.find(n => n.type === 'attribute_name');
      return nameNode && nameNode.text === attrName;
    });

    if (!attribute) return undefined;

    const valueNode = attribute.children.find(c => c.type === 'quoted_attribute_value');
    if (!valueNode) return undefined;

    const attrValue = valueNode.children.find(c => c.type === 'attribute_value');
    return attrValue ? attrValue.text : undefined;
  }
}
 