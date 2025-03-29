import { ParseResult, ParsedNode } from '../types';
import { Relationship, createRelationship } from './Relationship';
import { RelationshipAnalyzer, NodeMap } from './RelationshipAnalyzer';
import * as path from 'path';

export class CallAnalyzer implements RelationshipAnalyzer {
  getName(): string {
    return '调用关系';
  }

  analyze(parseResults: ParseResult[], nodeMap: Map<string, {node: ParsedNode, result: ParseResult}>): Relationship[] {
    const relationships: Relationship[] = [];
    
    parseResults.forEach(result => {
      // 分析方法调用
      relationships.push(...this.analyzeMethodCalls(result, nodeMap));
      
      // 分析函数调用
      relationships.push(...this.analyzeFunctionCalls(result, nodeMap));
    });
    
    return relationships;
  }
  
  private analyzeMethodCalls(result: ParseResult, nodeMap: Map<string, {node: ParsedNode, result: ParseResult}>): Relationship[] {
    const relationships: Relationship[] = [];
    
    console.log(`分析方法调用: ${result.filePath}`);
    
    Object.entries(result.nodes).forEach(([nodeId, node]) => {
      // 放宽方法调用表达式的匹配条件
      if (node.type && (
        node.type.includes('call') || 
        node.type.includes('invocation') ||
        node.type === 'call_expression' || 
        node.type === 'method_invocation'
      )) {
        console.log(`找到调用节点: ${node.type}, 名称: ${node.name || '无名称'}`);
        
        // 尝试提取方法名
        const methodName = this.extractMethodName(node, result.nodes);
        if (methodName) {
          console.log(`找到方法名: ${methodName}`);
          
          // 查找方法定义或创建虚拟节点
          const targetNodeId = `virtual_method_${methodName}_${Date.now()}`;
          result.nodes[targetNodeId] = {
            // 移除 id 属性，因为 ParsedNode 类型中不包含此属性
            type: 'virtual_method',
            name: methodName,
            children: [], // 添加空的children数组
            range: node.range || { start: { line: 0, column: 0 }, end: { line: 0, column: 0 } }, // 添加默认range
            metadata: {
              nodeText: `function ${methodName}() {}`
            }
          };
          
          relationships.push(createRelationship(
            'call',
            nodeId,
            targetNodeId,
            'method_call',
            result,
            node,
            node.metadata?.nodeText,
            `调用了方法 ${methodName}`
          ));
        } else {
          console.log(`未能从节点提取方法名: ${node.metadata?.nodeText || '无文本'}`);
        }
      }
    });
    
    return relationships;
  }
  
  private extractMethodName(node: ParsedNode, allNodes: Record<string, ParsedNode>): string | null {
    // 1. 直接从节点名称获取
    if (node.name) {
      return node.name;
    }
    
    // 2. 从节点文本中提取
    const nodeText = node.metadata?.nodeText || '';
    if (nodeText) {
      // 匹配方法调用模式: name(...) 或 obj.name(...)
      const methodMatch = nodeText.match(/(?:(\w+)\.)?(\w+)\s*\(/);
      if (methodMatch && methodMatch[2]) {
        return methodMatch[2];
      }
    }
    
    // 3. 从子节点中查找标识符
    if (node.children) {
      for (const childId of node.children) {
        const child = allNodes[childId];
        if (child && (
          child.type === 'identifier' || 
          child.type?.includes('identifier') ||
          child.type === 'property_identifier' ||
          child.type === 'method_name'
        )) {
          return child.name || child.metadata?.nodeText || null;
        }
      }
    }
    
    return null;
  }
  
  private analyzeFunctionCalls(result: ParseResult, nodeMap: Map<string, {node: ParsedNode, result: ParseResult}>): Relationship[] {
    const relationships: Relationship[] = [];
    
    Object.entries(result.nodes).forEach(([nodeId, node]) => {
      // 查找函数调用表达式
      if (node.type === 'call_expression') {
        // 获取被调用的函数名
        const functionName = this.extractCalledFunctionName(node, result.nodes);
        if (!functionName) return;
        
        // 查找函数定义
        const functionDefinitions = this.findFunctionDefinitions(functionName, nodeMap);
        
        functionDefinitions.forEach(def => {
          relationships.push(createRelationship(
            'call',
            nodeId,
            def.id,
            'function_call',
            result,
            node,
            node.metadata?.nodeText,
            `调用了函数 ${functionName}`
          ));
        });
      }
    });
    
    return relationships;
  }
  
  // 辅助方法
  private findMethodDefinitions(methodName: string, nodeMap: Map<string, {node: ParsedNode, result: ParseResult}>): Array<{id: string, node: ParsedNode}> {
    const definitions: Array<{id: string, node: ParsedNode}> = [];
    
    // 遍历所有节点，查找方法定义
    nodeMap.forEach((value, key) => {
      Object.entries(value.result.nodes).forEach(([id, node]) => {
        if ((node.type === 'method_definition' || node.type.includes('method')) && node.name === methodName) {
          definitions.push({ id, node });
        }
      });
    });
    
    return definitions;
  }
  
  private findFunctionDefinitions(functionName: string, nodeMap: Map<string, {node: ParsedNode, result: ParseResult}>): Array<{id: string, node: ParsedNode}> {
    const definitions: Array<{id: string, node: ParsedNode}> = [];
    
    // 遍历所有节点，查找函数定义
    nodeMap.forEach((value, key) => {
      Object.entries(value.result.nodes).forEach(([id, node]) => {
        if (node.type === 'function_declaration' && node.name === functionName) {
          definitions.push({ id, node });
        }
      });
    });
    
    return definitions;
  }
  
  private extractCalledFunctionName(node: ParsedNode, allNodes: Record<string, ParsedNode>): string | null {
    // 1. 直接从节点名称获取
    if (node.name) {
      return node.name;
    }
    
    // 2. 查找函数表达式的子节点
    if (node.children) {
      // 查找函数名标识符
      const functionIdentifier = node.children.find(childId => {
        const child = allNodes[childId];
        return child && (
          child.type === 'identifier' || 
          child.type?.includes('identifier') ||
          child.type === 'function_name'
        );
      });
      
      if (functionIdentifier) {
        const identifierNode = allNodes[functionIdentifier];
        if (identifierNode) {
          return identifierNode.name || identifierNode.metadata?.nodeText || null;
        }
      }
    }
    
    // 3. 从节点文本中提取
    const nodeText = node.metadata?.nodeText || '';
    if (nodeText) {
      // 匹配函数调用模式: name(...)
      const functionMatch = nodeText.match(/(\w+)\s*\(/);
      if (functionMatch && functionMatch[1]) {
        return functionMatch[1];
      }
    }
    
    return null;
  }
}