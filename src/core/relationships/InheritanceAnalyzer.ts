import { ParseResult, ParsedNode } from '../types';
import { Relationship, createRelationship } from './Relationship';
import { RelationshipAnalyzer, NodeMap } from './RelationshipAnalyzer';
import * as path from 'path';

export class InheritanceAnalyzer implements RelationshipAnalyzer {
  getName(): string {
    return '继承关系';
  }

  analyze(parseResults: ParseResult[], nodeMap: Map<string, {node: ParsedNode, result: ParseResult}>): Relationship[] {
    const relationships: Relationship[] = [];
    
    parseResults.forEach(result => {
      // 分析类继承关系
      relationships.push(...this.analyzeClassInheritance(result));
      
      // 分析接口继承关系
      relationships.push(...this.analyzeInterfaceInheritance(result, nodeMap));
    });
    
    return relationships;
  }
  
  private analyzeClassInheritance(result: ParseResult): Relationship[] {
    const relationships: Relationship[] = [];
    
    console.log(`分析文件: ${result.filePath}, 语言: ${result.language}`);
    console.log(`节点数量: ${Object.keys(result.nodes).length}`);
    
    // 查找类声明节点 - 扩展匹配条件
    const classNodes = Object.entries(result.nodes).filter(
      ([id, node]) => 
        node.type === 'class_declaration' || 
        node.type === 'class.declaration' ||
        node.type === 'class' ||
        (node.type && node.type.includes('class'))
    );
    console.log(`找到 ${classNodes.length} 个类声明节点`);
    
    // 遍历所有节点，查找类声明
    Object.entries(result.nodes).forEach(([nodeId, node]) => {
      // 放宽类型检查条件
      if (node.type && (
          node.type.includes('class') || 
          node.type === 'class_declaration' || 
          node.type === 'class.declaration' ||
          node.type === 'class'
      )) {
        console.log(`分析类: ${node.name || '未命名'}, 类型: ${node.type}`);
        
        // 查找继承关系
        const extendsClause = this.findExtendsClause(node, result.nodes);
        if (extendsClause) {
          console.log(`找到继承关系: ${node.name} 继承自 ${extendsClause}`);
          
          // 尝试查找父类 - 放宽查找条件
          let parentClassId: string | undefined;
          
          // 1. 首先在当前文件中查找
          const parentClassInFile = Object.entries(result.nodes).find(
            ([id, n]) => 
              n.name === extendsClause && (
                n.type.includes('class') || 
                n.type === 'class_declaration' || 
                n.type === 'class.declaration' ||
                n.type === 'class'
              )
          );
          
          if (parentClassInFile) {
            parentClassId = parentClassInFile[0];
            console.log(`在当前文件中找到父类: ${extendsClause}`);
          } else {
            // 2. 如果找不到，创建一个虚拟节点ID
            parentClassId = `virtual_${extendsClause}_${Date.now()}`;
            console.log(`创建虚拟父类节点: ${parentClassId}`);
            
            // 添加虚拟节点到结果中
            result.nodes[parentClassId] = {
              type: 'virtual_class',
              name: extendsClause,
              range: node.range, // 使用子类的范围
              metadata: {
                nodeText: `class ${extendsClause} {}`
              }
            };
          }
          
          // 创建继承关系
          relationships.push(createRelationship(
            'inheritance',
            nodeId,
            parentClassId,
            'class_extends',
            result,
            node,
            node.metadata?.nodeText,
            `类 ${node.name} 继承自 ${extendsClause}`
          ));
        }
      }
    });
    
    return relationships;
  }
  
  private analyzeInterfaceInheritance(result: ParseResult, nodeMap: Map<string, {node: ParsedNode, result: ParseResult}>): Relationship[] {
    const relationships: Relationship[] = [];
    
    Object.entries(result.nodes).forEach(([nodeId, node]) => {
      if (node.type === 'interface_declaration') {
        const extendsClause = this.findExtendsClause(node, result.nodes);
        if (extendsClause) {
          const extendedInterface = result.nodes[extendsClause];
          if (extendedInterface && extendedInterface.name) {
            // 查找被继承的接口
            const targetInterface = nodeMap.get(extendedInterface.name);
            if (targetInterface) {
              const targetNodeId = Object.entries(targetInterface.result.nodes)
                .find(([id, n]) => n === targetInterface.node)?.[0];
              
              if (targetNodeId) {
                relationships.push(createRelationship(
                  'inheritance',
                  nodeId,
                  targetNodeId,
                  'interface_extends',
                  result,
                  node,
                  node.metadata?.nodeText,
                  `接口 ${node.name} 继承自 ${extendedInterface.name}`
                ));
              }
            }
          }
        }
      }
    });
    
    return relationships;
  }
  
  private findExtendsClause(node: ParsedNode, allNodes: Record<string, ParsedNode>): string | null {
    // 添加更多调试信息
    console.log(`查找继承关系，节点名称: ${node.name}, 类型: ${node.type}`);
    if (node.children && node.children.length > 0) {
      console.log(`子节点数量: ${node.children.length}`);
      
      // 输出所有子节点的类型，帮助调试
      node.children.forEach(childId => {
        const child = allNodes[childId];
        if (child) {
          console.log(`子节点类型: ${child.type}, 名称: ${child.name || '无名称'}`);
        }
      });
    }
    
    // 查找extends子句 - 扩展匹配条件
    const extendsNode = node.children?.find(childId => {
      const child = allNodes[childId];
      return child && (
        child.type === 'extends_clause' || 
        child.type === 'extends' ||
        child.type === 'heritage_clause' ||  // TypeScript 特有
        child.type === 'class_heritage' ||   // 可能的命名
        (child.type === 'token' && child.name === 'extends') ||  // 简单token
        child.name === 'extends'  // 按名称匹配
      );
    });
    
    if (extendsNode) {
      console.log(`找到extends子句: ${allNodes[extendsNode].type}`);
      
      // 查找继承的类名 - 扩展匹配条件
      const typeIdentifier = allNodes[extendsNode].children?.find(childId => {
        const child = allNodes[childId];
        return child && (
          child.type === 'type_identifier' || 
          child.type === 'identifier' ||
          child.type.includes('identifier') ||  // 包含identifier的任何类型
          child.type === 'type_reference' ||    // TypeScript类型引用
          child.type === 'class_name' ||        // 可能的类名节点
          child.type === 'name'                 // 简单名称节点
        );
      });
      
      if (typeIdentifier) {
        console.log(`找到继承的类名: ${allNodes[typeIdentifier].name}`);
        return allNodes[typeIdentifier].name;
      } else {
        // 如果找不到标准的标识符，尝试直接从extends子句的文本中提取
        const extendsText = allNodes[extendsNode].metadata?.nodeText;
        if (extendsText) {
          // 从 "extends ClassName" 中提取 ClassName
          const match = extendsText.match(/extends\s+([A-Za-z0-9_]+)/);
          if (match && match[1]) {
            console.log(`从文本中提取继承的类名: ${match[1]}`);
            return match[1];
          }
        }
      }
    }
    
    // 尝试从节点的完整文本中查找继承关系
    const nodeText = node.metadata?.nodeText;
    if (nodeText && nodeText.includes('extends')) {
      const match = nodeText.match(/class\s+[A-Za-z0-9_]+\s+extends\s+([A-Za-z0-9_]+)/);
      if (match && match[1]) {
        console.log(`从完整文本中提取继承的类名: ${match[1]}`);
        return match[1];
      }
    }
    
    return null;
  }
}