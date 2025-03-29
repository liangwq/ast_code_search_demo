import { IndexedNode } from './indexer';
import { ParseResult } from './types';
// 修改导入路径，使用新的关系类型
import { Relationship } from './relationships/Relationship';
import path from 'path';
import { Database } from './database';
import { SnippetStorage } from './snippetStorage';
import { RelationshipStorage } from './relationshipStorage';
import { SnippetQuery, RelationshipQuery } from './types/dbTypes';

export class Storage {
  private db: Database;
  private snippetStorage: SnippetStorage;
  private relationshipStorage: RelationshipStorage;

  constructor() {
    this.db = Database.getInstance();
    this.snippetStorage = new SnippetStorage();
    this.relationshipStorage = new RelationshipStorage();
  }

  public async initDatabase(): Promise<void> {
    // 重置表
    await this.snippetStorage.resetTable();
    await this.relationshipStorage.resetTable();
  }

  // 代理方法 - 代码片段
  async saveSnippet(node: IndexedNode): Promise<void> {
    return this.snippetStorage.saveSnippet(node);
  }

  async getSnippets(query: SnippetQuery): Promise<IndexedNode[]> {
    return this.snippetStorage.getSnippets(query);
  }

  async getNodeById(id: string): Promise<IndexedNode | null> {
    // 先尝试直接通过ID查找
    const node = await this.snippetStorage.getNodeById(id);
    if (node) return node;
    
    // 如果找不到，尝试通过node_id查找
    return this.snippetStorage.getNodeByOriginalId(id);
  }

  // 代理方法 - 关系
  async saveRelationship(relationship: Relationship): Promise<void> {
    return this.relationshipStorage.saveRelationship(relationship);
  }

  // 添加批量保存关系的方法
  async saveRelationships(relationships: Relationship[]): Promise<void> {
    console.log(`保存 ${relationships.length} 个关系到数据库...`);
    
    // 批量保存关系
    for (const relationship of relationships) {
      await this.relationshipStorage.saveRelationship(relationship);
    }
    
    console.log('关系保存完成');
  }

  async getRelationships(query: RelationshipQuery, limit?: number, offset?: number): Promise<Relationship[]> {
    return this.relationshipStorage.getRelationships(query, limit, offset);
  }
  
  // Add missing methods to proxy to RelationshipStorage
  async getRelationshipById(id: string): Promise<Relationship | null> {
    return this.relationshipStorage.getRelationshipById(id);
  }
  
  async getRelationshipsBetween(fromId: string, toId: string): Promise<Relationship[]> {
    return this.relationshipStorage.getRelationshipsBetween(fromId, toId);
  }
  
  // 项目数据保存
  async saveProjectData(parseResults: ParseResult[], relationships: Relationship[]): Promise<void> {
    try {
      console.log('开始保存项目数据');
      console.log('解析结果数量:', parseResults.length);
      console.log('关系数量:', relationships.length);
      
      // 创建节点ID映射表
      const nodeIdMap = new Map<string, string>();
      
      await this.db.beginTransaction();
      
      // 首先保存所有节点，并建立ID映射
      for (const result of parseResults) {
        // 打印每个结果的基本信息
        console.log('保存文件:', {
          projectPath: result.projectPath,
          filePath: result.filePath,
          language: result.language,
          nodesCount: Object.keys(result.nodes).length
        });
        
        // 获取项目路径，如果不存在则使用文件所在目录的上级目录
        const projectPath = result.projectPath || path.dirname(path.dirname(result.filePath));
        const relativePath = result.relativePath || path.relative(projectPath, result.filePath);
    
        for (const [originalNodeId, node] of Object.entries(result.nodes)) {
          // 生成数据库ID
          const dbId = `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          
          // 保存原始节点ID到映射表
          nodeIdMap.set(originalNodeId, dbId);
          
          const indexedNode: IndexedNode = {
            ...node,
            id: dbId,
            nodeId: originalNodeId, // 保存原始节点ID
            filePath: result.filePath,
            language: result.language,
            tokens: this.snippetStorage.tokenize(node.name),
            projectName: path.basename(projectPath),
            projectPath: projectPath,
            fileName: path.basename(result.filePath),
            relativePath: relativePath,
            content: node.metadata?.nodeText || '',
            granularity: 'medium'
          };
    
          await this.saveSnippet(indexedNode);
        }
      }
    
      // 保存关系数据，使用映射后的节点ID
      for (const relationship of relationships) {
        // 使用映射后的节点ID
        const mappedRelationship = {
          ...relationship,
          from: nodeIdMap.get(relationship.from) || relationship.from,
          to: nodeIdMap.get(relationship.to) || relationship.to
        };
        
        await this.saveRelationship(mappedRelationship);
      }
    
      await this.db.commitTransaction();
      console.log('项目数据保存完成');
    } catch (error) {
      console.error('保存项目数据失败:', error);
      await this.db.rollbackTransaction();
      throw error;
    }
  }
}