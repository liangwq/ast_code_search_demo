import { ParseResult, ParsedNode } from '../types';
import { Relationship, createRelationship } from './Relationship';
import { RelationshipAnalyzer, NodeMap } from './RelationshipAnalyzer';
import * as path from 'path';

export class StyleAnalyzer implements RelationshipAnalyzer {
  getName(): string {
    return '样式关系';
  }

  analyze(parseResults: ParseResult[], nodeMap: Map<string, {node: ParsedNode, result: ParseResult}>): Relationship[] {
    const relationships: Relationship[] = [];
    
    parseResults.forEach(result => {
      // 分析组件样式关系
      relationships.push(...this.analyzeComponentStyleRelationships(result, nodeMap));
      
      // 分析CSS选择器关系
      relationships.push(...this.analyzeStyleDependencies(result));
    });
    
    return relationships;
  }
  
  private analyzeComponentStyleRelationships(result: ParseResult, nodeMap: Map<string, {node: ParsedNode, result: ParseResult}>): Relationship[] {
    const relationships: Relationship[] = [];
    
    // 只处理 JavaScript/TypeScript 文件
    if (!['javascript', 'typescript', 'jsx', 'tsx'].includes(result.language)) {
      return relationships;
    }
    
    console.log(`分析组件样式关系: ${result.filePath}, 语言: ${result.language}`);
    console.log(`节点数量: ${Object.keys(result.nodes).length}`);
    
    // 输出一些节点示例，帮助调试
    const nodeEntries = Object.entries(result.nodes).slice(0, 3);
    console.log('节点示例:');
    nodeEntries.forEach(([id, node]) => {
      console.log(`节点ID: ${id}, 类型: ${node.type}, 名称: ${node.name || '无名称'}`);
    });
    
    // 放宽组件识别条件
    Object.entries(result.nodes).forEach(([nodeId, node]) => {
    // 查找任何可能的组件或函数定义
    if (
    node.type === 'class_declaration' || 
    node.type === 'function_declaration' ||
    node.type === 'arrow_function' ||
    node.type === 'method_definition' ||
    node.type?.includes('function') ||
    node.type?.includes('class')
    ) {
    console.log(`找到潜在组件: ${node.type}, 名称: ${node.name || '无名称'}`);
    
    // 查找组件中的类名引用
    const classNames = this.findClassNamesInComponent(node, result.nodes);
    
    if (classNames.length > 0) {
    console.log(`在 ${node.name || '匿名组件'} 中找到的类名: ${classNames.join(', ')}`);
    
    classNames.forEach(className => {
    // 在 CSS 文件中查找对应的选择器
    let foundMatch = false;
    
    Array.from(nodeMap.values())
    .filter(item => ['css', 'scss', 'less'].includes(item.result.language))
    .forEach(cssItem => {
    console.log(`检查CSS文件: ${cssItem.result.filePath}`);
    
    const cssResult = cssItem.result;
    Object.entries(cssResult.nodes).forEach(([cssNodeId, cssNode]) => {
    // 放宽选择器匹配条件
    if (
    (cssNode.type === 'class_selector' && cssNode.name === `.${className}`) ||
    (cssNode.type === 'class_selector' && cssNode.name === className) ||
    (cssNode.type === 'selector' && cssNode.name?.includes(`.${className}`)) ||
    (cssNode.type?.includes('selector') && cssNode.name?.includes(className)) ||
    (cssNode.metadata?.nodeText?.includes(`.${className}`))
    ) {
    console.log(`找到匹配的CSS选择器: ${cssNode.name || cssNode.metadata?.nodeText || '未知'}`);
    foundMatch = true;
    
    relationships.push(createRelationship(
    'style',
    nodeId,
    cssNodeId,
    'component_style',
    result,
    node,
    node.metadata?.nodeText,
    `${node.name || '组件'} 使用了样式类 ${className}`
    ));
    }
    });
    });
    if (!foundMatch) {
    console.log(`未找到类名 ${className} 对应的CSS选择器`);
    }
    });
    } else {
    console.log(`在 ${node.name || '匿名组件'} 中未找到类名`);
    }
    }
    });
    
    return relationships;
  }
  
  private analyzeStyleDependencies(result: ParseResult): Relationship[] {
    const relationships: Relationship[] = [];
    
    // 只处理CSS文件
    if (result.language !== 'css') {
      return relationships;
    }
    
    console.log(`分析CSS样式依赖: ${result.filePath}`);
    
    // 收集所有CSS选择器
    const cssSelectors: {
      id: string;
      selector: string;
      node: ParsedNode;
    }[] = [];
    
    this.collectCssSelectors(result, cssSelectors);
    console.log(`找到 ${cssSelectors.length} 个CSS选择器`);
    
    // 在当前文件中查找选择器之间的依赖关系
    // 例如：嵌套选择器、继承等
    
    return relationships;
  }
  
  private collectCssSelectors(result: ParseResult, selectors: any[]): void {
    Object.entries(result.nodes).forEach(([nodeId, node]) => {
      if (node.type && (
        node.type === 'class_selector' || 
        node.type === 'id_selector' || 
        node.type === 'tag_name' ||
        node.type.includes('selector')
      )) {
        console.log(`找到CSS选择器: ${node.type}, 名称: ${node.name || '无名称'}`);
        
        const selectorText = node.name || node.metadata?.nodeText;
        if (selectorText) {
          selectors.push({
            id: nodeId,
            selector: selectorText.replace(/^\./, ''), // 移除开头的点（类选择器）
            node
          });
        }
      }
    });
  }
  
  private collectHtmlElements(result: ParseResult, elements: any[]): void {
    Object.entries(result.nodes).forEach(([nodeId, node]) => {
      if (node.type === 'element') {
        console.log(`找到HTML元素: ${node.name || '无名称'}`);
        
        // 尝试提取类名和ID
        let className = '';
        let elementId = ''; // 重命名变量，避免与属性名冲突
        let tagName = node.name || 'div';
        
        node.children?.forEach(childId => {
          const child = result.nodes[childId];
          if (child && child.type === 'attribute') {
            if (child.name === 'class') {
              className = child.metadata?.nodeText?.replace(/^class=["']|["']$/g, '') || '';
            } else if (child.name === 'id') {
              elementId = child.metadata?.nodeText?.replace(/^id=["']|["']$/g, '') || '';
            }
          } else if (child && child.type === 'tag_name') {
            tagName = child.name || child.metadata?.nodeText || 'div';
          }
        });
        
        elements.push({
          id: nodeId,
          className,
          elementId, // 使用重命名后的变量
          tagName,
          result,
          node
        });
      }
    });
  }
  
  private selectorMatchesElement(selector: string, element: any): boolean {
    // 简单匹配逻辑
    if (selector.startsWith('.') && element.className) {
      // 类选择器
      return element.className.split(' ').includes(selector.substring(1));
    } else if (selector.startsWith('#') && element.elementId) { // 更新属性名
      // ID选择器
      return element.elementId === selector.substring(1);
    } else {
      // 标签选择器
      return element.tagName === selector;
    }
  }
  
  private findClassNamesInComponent(node: ParsedNode, allNodes: Record<string, ParsedNode>): string[] {
    const classNames: string[] = [];
    
    console.log(`开始查找组件中的类名, 节点类型: ${node.type}, 名称: ${node.name || '无名称'}`);
    
    // 递归查找所有字符串字面量，可能包含类名
    const findClassNamesInNode = (nodeId: string, visited = new Set<string>()) => {
      if (visited.has(nodeId)) return;
      visited.add(nodeId);
      
      const currentNode = allNodes[nodeId];
      if (!currentNode) {
        return;
      }
      
      // 检查是否是字符串字面量
      if (currentNode.type === 'string_literal' || currentNode.type === 'string' || 
          currentNode.type?.includes('string')) {
        const text = currentNode.metadata?.nodeText;
        if (text) {
          // 提取可能的类名
          const cleanText = text.replace(/^['"]|['"]$/g, '');
          
          // 检查是否可能是类名（简单启发式方法）
          if (cleanText.match(/^[a-zA-Z0-9_-]+$/) || cleanText.includes(' ')) {
            console.log(`找到可能的类名字符串: ${cleanText}`);
            
            if (cleanText.includes(' ')) {
              // 可能是多个类名
              cleanText.split(' ').forEach(part => {
                if (part.trim()) classNames.push(part.trim());
              });
            } else {
              classNames.push(cleanText);
            }
          }
        }
      }
      
      // 检查更多的类名模式
      if (
        (currentNode.type === 'jsx_attribute' && currentNode.name === 'className') ||
        (currentNode.type === 'property_identifier' && currentNode.name === 'className') ||
        (currentNode.type?.includes('attribute') && currentNode.name === 'class') ||
        (currentNode.metadata?.nodeText?.includes('className=')) ||
        (currentNode.metadata?.nodeText?.includes('class='))
      ) {
        console.log(`找到类名属性: ${currentNode.metadata?.nodeText || currentNode.name}`);
        
        // 处理子节点
        currentNode.children?.forEach(childId => {
          const child = allNodes[childId];
          if (child && (
            child.type === 'string_literal' || 
            child.type === 'string' || 
            child.type?.includes('string')
          )) {
            const text = child.metadata?.nodeText;
            if (text) {
              const cleanText = text.replace(/^['"]|['"]$/g, '');
              console.log(`从类名属性中提取: ${cleanText}`);
              
              cleanText.split(' ').forEach(part => {
                if (part.trim()) classNames.push(part.trim());
              });
            }
          }
        });
      }
      
      // 递归处理子节点
      currentNode.children?.forEach(childId => {
        findClassNamesInNode(childId, visited);
      });
    };
    
    // 从组件节点开始递归查找
    if (node.children && node.children.length > 0) {
      node.children.forEach(childId => {
        findClassNamesInNode(childId, new Set<string>());
      });
    } else {
      // 如果没有子节点，尝试遍历所有节点
      console.log(`节点没有子节点，尝试遍历所有节点`);
      Object.keys(allNodes).forEach(id => {
        findClassNamesInNode(id, new Set<string>());
      });
    }
    
    // 过滤掉明显不是类名的字符串
    const filteredClassNames = [...new Set(classNames)].filter(name => 
      name.length > 1 && // 至少2个字符
      !name.includes('(') && // 不包含括号
      !name.includes(')') && 
      !name.includes('{') && // 不包含花括号
      !name.includes('}') &&
      !name.includes(';') && // 不包含分号
      !name.includes('=') // 不包含等号
    );
    
    console.log(`最终找到的类名: ${filteredClassNames.join(', ') || '无'}`);
    return filteredClassNames;
  }
}
