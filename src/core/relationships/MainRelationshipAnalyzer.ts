import { ParseResult, ParsedNode } from '../types';
import { Relationship } from './Relationship';
import { InheritanceAnalyzer } from './InheritanceAnalyzer';
import { DependencyAnalyzer } from './DependencyAnalyzer';
import { CallAnalyzer } from './CallAnalyzer';
import { StyleAnalyzer } from './StyleAnalyzer';

export class MainRelationshipAnalyzer {
  private analyzers = [
    new InheritanceAnalyzer(),
    new DependencyAnalyzer(),
    new CallAnalyzer(),
    new StyleAnalyzer()
  ];
  
  analyze(parseResults: ParseResult[]): Relationship[] {
    const relationships: Relationship[] = [];
    
    // 添加调试信息，检查解析结果
    console.log(`收到 ${parseResults.length} 个解析结果`);
    if (parseResults.length > 0) {
      console.log(`第一个解析结果的语言: ${parseResults[0].language}`);
      console.log(`第一个解析结果的节点数量: ${Object.keys(parseResults[0].nodes).length}`);
      
      // 输出一些节点示例
      const nodeEntries = Object.entries(parseResults[0].nodes).slice(0, 3);
      console.log('节点示例:');
      nodeEntries.forEach(([id, node]) => {
        console.log(`节点ID: ${id}, 类型: ${node.type}, 名称: ${node.name || '无名称'}`);
      });
    }
    
    // 创建节点映射，用于跨文件查找关系
    const nodeMap = this.buildNodeMap(parseResults);
    
    // 检查节点映射
    console.log(`节点映射大小: ${nodeMap.size}`);
    if (nodeMap.size > 0) {
      console.log('节点映射示例:');
      let count = 0;
      for (const [name, data] of nodeMap.entries()) {
        if (count < 3) {
          console.log(`名称: ${name}, 类型: ${data.node.type}`);
          count++;
        } else {
          break;
        }
      }
    }
    
    // 使用每个分析器进行分析
    for (const analyzer of this.analyzers) {
      console.log(`使用 ${analyzer.getName()} 分析器分析关系...`);
      const results = analyzer.analyze(parseResults, nodeMap);
      console.log(`${analyzer.getName()} 分析器找到 ${results.length} 个关系`);
      relationships.push(...results);
    }
    
    console.log(`总共找到 ${relationships.length} 个关系`);
    return relationships;
  }
  
  // 构建节点映射，用于跨文件查找关系
  private buildNodeMap(parseResults: ParseResult[]): Map<string, {node: ParsedNode, result: ParseResult}> {
    const nodeMap = new Map<string, {node: ParsedNode, result: ParseResult}>();
    
    parseResults.forEach(result => {
      Object.entries(result.nodes).forEach(([id, node]) => {
        if (node.name && node.name.trim() !== '') {
          nodeMap.set(node.name, { node, result });
        }
      });
    });
    
    return nodeMap;
  }
}