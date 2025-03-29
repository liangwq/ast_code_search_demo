import { ParseResult, ParsedNode } from '../types';
import { Relationship, createRelationship } from './Relationship';
import { RelationshipAnalyzer, NodeMap } from './RelationshipAnalyzer';
import * as path from 'path';

export class DependencyAnalyzer implements RelationshipAnalyzer {
  getName(): string {
    return '依赖关系';
  }

  analyze(parseResults: ParseResult[], nodeMap: Map<string, {node: ParsedNode, result: ParseResult}>): Relationship[] {
    const relationships: Relationship[] = [];
    
    parseResults.forEach(result => {
      // 分析模块导入依赖
      relationships.push(...this.analyzeModuleDependencies(result));
      
      // 分析类型依赖
      relationships.push(...this.analyzeTypeDependencies(result, nodeMap));
      
      // 分析参数类型依赖
      relationships.push(...this.analyzeParameterTypeDependencies(result, nodeMap));
    });
    
    // 过滤重复的依赖关系
    return this.filterDuplicateDependencies(relationships);
  }
  
  private filterDuplicateDependencies(relationships: Relationship[]): Relationship[] {
    const uniqueMap = new Map<string, Relationship>();
    
    relationships.forEach(rel => {
      const key = `${rel.from}:${rel.to}:${rel.metadata?.kind}`;
      uniqueMap.set(key, rel);
    });
    
    return Array.from(uniqueMap.values());
  }
  
  private analyzeModuleDependencies(result: ParseResult): Relationship[] {
    const relationships: Relationship[] = [];
    
    console.log(`分析模块依赖: ${result.filePath}`);
    
    Object.entries(result.nodes).forEach(([nodeId, node]) => {
      // 放宽导入语句的匹配条件
      if (
        node.type && (
          node.type.includes('import') || 
          node.type.includes('require') ||
          node.type === 'import_declaration' || 
          node.type === 'import_statement' ||
          node.type === 'import_directive' ||
          node.type === 'import_specifier' ||
          node.type === 'require_call'
        )
      ) {
        console.log(`找到导入节点: ${node.type}, 名称: ${node.name || '无名称'}`);
        
        // 尝试从节点文本中提取导入路径
        const importPath = this.findImportPath(node, result.nodes);
        if (importPath) {
          console.log(`找到导入路径: ${importPath}`);
          
          // 创建一个虚拟目标节点
          const targetId = `virtual_module_${importPath}_${Date.now()}`;
          result.nodes[targetId] = {
            type: 'virtual_module',
            name: importPath,
            children: [], // 添加空的children数组
            range: node.range || { start: { line: 0, column: 0 }, end: { line: 0, column: 0 } }, // 添加默认range
            metadata: {
              nodeText: `// 模块: ${importPath}`
            }
          };
          
          relationships.push(createRelationship(
            'dependency',
            nodeId,
            targetId,
            'module_import',
            result,
            node,
            node.metadata?.nodeText,
            `模块 ${result.filePath} 导入了 ${importPath}`
          ));
        } else {
          console.log(`未能从节点提取导入路径: ${node.metadata?.nodeText || '无文本'}`);
        }
      }
    });
    
    return relationships;
  }
  
  private findImportPath(node: ParsedNode, allNodes: Record<string, ParsedNode>): string | null {
    // 从节点文本中提取导入路径
    const nodeText = node.metadata?.nodeText;
    if (nodeText) {
      // 匹配 import ... from 'path' 或 require('path')
      const importMatch = nodeText.match(/from\s+['"]([^'"]+)['"]/);
      const requireMatch = nodeText.match(/require\s*\(\s*['"]([^'"]+)['"]\s*\)/);
      
      if (importMatch && importMatch[1]) {
        return importMatch[1];
      } else if (requireMatch && requireMatch[1]) {
        return requireMatch[1];
      }
    }
    
    // 查找子节点中的字符串字面量
    if (node.children) {
      for (const childId of node.children) {
        const child = allNodes[childId];
        if (child && (
          child.type === 'string' || 
          child.type === 'string_literal' || 
          child.type.includes('string')
        )) {
          // 去除引号
          const value = child.metadata?.nodeText;
          if (value) {
            return value.replace(/^['"]|['"]$/g, '');
          }
        }
      }
    }
    
    return null;
  }
  
  private analyzeTypeDependencies(result: ParseResult, nodeMap: Map<string, {node: ParsedNode, result: ParseResult}>): Relationship[] {
    const relationships: Relationship[] = [];
    
    Object.entries(result.nodes).forEach(([nodeId, node]) => {
      // 分析接口属性类型依赖
      if (node.type === 'interface_declaration') {
        node.children?.forEach(childId => {
          const childNode = result.nodes[childId];
          
          if (childNode.type === 'property_signature') {
            const propType = this.extractTypeFromProperty(childNode, result.nodes);
            if (propType) {
              const targetType = nodeMap.get(propType);
              if (targetType) {
                const targetNodeId = Object.entries(targetType.result.nodes)
                  .find(([id, n]) => n === targetType.node)?.[0];
                
                if (targetNodeId) {
                  relationships.push(createRelationship(
                    'dependency',
                    nodeId,
                    targetNodeId,
                    'interface_property_type',
                    result,
                    childNode,
                    childNode.metadata?.nodeText,
                    `接口 ${node.name} 的属性 ${childNode.name} 依赖类型 ${propType}`
                  ));
                }
              }
            }
          }
        });
      }
    });
    
    return relationships;
  }
  
  private analyzeParameterTypeDependencies(result: ParseResult, nodeMap: Map<string, {node: ParsedNode, result: ParseResult}>): Relationship[] {
    const relationships: Relationship[] = [];
    
    Object.entries(result.nodes).forEach(([nodeId, node]) => {
      // 查找函数声明和方法定义
      if (node.type === 'function_declaration' || 
          node.type === 'method_definition' || 
          node.type === 'arrow_function') {
        
        // 提取参数类型
        const paramTypes = this.extractParameterTypes(node, result.nodes);
        
        // 为每个参数类型创建依赖关系
        paramTypes.forEach(paramType => {
          const targetType = nodeMap.get(paramType);
          if (targetType) {
            const targetNodeId = Object.entries(targetType.result.nodes)
              .find(([id, n]) => n === targetType.node)?.[0];
            
            if (targetNodeId) {
              relationships.push(createRelationship(
                'dependency',
                nodeId,
                targetNodeId,
                'parameter_type',
                result,
                node,
                node.metadata?.nodeText,
                `函数 ${node.name} 的参数依赖类型 ${paramType}`
              ));
            }
          }
        });
        
        // 提取返回类型
        const returnType = this.extractReturnType(node, result.nodes);
        if (returnType) {
          const targetType = nodeMap.get(returnType);
          if (targetType) {
            const targetNodeId = Object.entries(targetType.result.nodes)
              .find(([id, n]) => n === targetType.node)?.[0];
            
            if (targetNodeId) {
              relationships.push(createRelationship(
                'dependency',
                nodeId,
                targetNodeId,
                'return_type',
                result,
                node,
                node.metadata?.nodeText,
                `函数 ${node.name} 的返回值依赖类型 ${returnType}`
              ));
            }
          }
        }
      }
    });
    
    return relationships;
  }
  
  // 辅助方法
  private extractTypeFromProperty(node: ParsedNode, allNodes: Record<string, ParsedNode>): string | null {
    // 查找类型注解节点
    const typeAnnotation = node.children?.find(childId => {
      const child = allNodes[childId];
      return child && (
        child.type === 'type_annotation' || 
        child.type.includes('type')
      );
    });
    
    if (typeAnnotation) {
      const typeNode = allNodes[typeAnnotation];
      // 查找类型标识符
      const typeIdentifier = typeNode.children?.find(childId => {
        const child = allNodes[childId];
        return child && (
          child.type === 'type_identifier' || 
          child.type === 'identifier' ||
          child.type.includes('identifier')
        );
      });
      
      if (typeIdentifier) {
        return allNodes[typeIdentifier].name;
      }
    }
    
    return null;
  }
  
  private extractParameterTypes(node: ParsedNode, allNodes: Record<string, ParsedNode>): string[] {
    const types: string[] = [];
    
    // 查找参数列表
    const parameterList = node.children?.find(childId => {
      const child = allNodes[childId];
      return child && (
        child.type === 'formal_parameters' || 
        child.type.includes('parameter')
      );
    });
    
    if (parameterList) {
      const params = allNodes[parameterList].children || [];
      
      params.forEach(paramId => {
        const param = allNodes[paramId];
        if (param && param.type.includes('parameter')) {
          // 查找参数类型
          const typeAnnotation = param.children?.find(childId => {
            const child = allNodes[childId];
            return child && child.type.includes('type');
          });
          
          if (typeAnnotation) {
            const typeNode = allNodes[typeAnnotation];
            const typeName = typeNode.name || typeNode.metadata?.nodeText;
            if (typeName) {
              types.push(typeName);
            }
          }
        }
      });
    }
    
    return types;
  }
  
  private extractReturnType(node: ParsedNode, allNodes: Record<string, ParsedNode>): string | null {
    // 查找返回类型注解
    const returnType = node.children?.find(childId => {
      const child = allNodes[childId];
      return child && (
        child.type === 'return_type' || 
        child.type?.includes('return') && child.type?.includes('type')
      );
    });
    
    if (returnType) {
      const typeNode = allNodes[returnType];
      if (typeNode) {
        return typeNode.name || typeNode.metadata?.nodeText || null;
      }
    }
    
    return null;
  }
}