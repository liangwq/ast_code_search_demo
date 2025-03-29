import { IndexedNode } from '../indexer';
// 修改导入，使用新的关系类型定义
import { Relationship, RelationshipMetadata, RelationshipPosition } from '../relationships/Relationship';

// 数据库行结构定义
export interface SnippetRow {
  id: string;
  type: string;
  name: string;
  content: string;
  language: string;
  granularity: string;
  metadata: string;
  project_name: string;
  project_path: string;
  file_name: string;
  file_path: string;
  relative_path: string;
  repository_url?: string;
  branch_name?: string;
  commit_hash?: string;
  created_at: string;
  updated_at: string;
}

export interface RelationshipRow {
  id: string;
  type: string;
  from_node: string;
  to_node: string;
  kind?: string;
  source_code?: string;
  path?: string;
  line?: number;
  column?: number;
  project_name?: string;
  file_name?: string;
  metadata: string;
  created_at: string;
}

// 查询参数类型
export interface SnippetQuery {
  id?: string;
  type?: string;
  name?: string;
  language?: string;
  granularity?: string;
  projectName?: string;
  fileName?: string;
  filePath?: string;
  content?: string;
}

export interface RelationshipQuery {
  type?: string;
  from_node?: string;
  to_node?: string;
}

// 转换函数
export function rowToIndexedNode(row: SnippetRow): IndexedNode {
  return {
    id: row.id,
    type: row.type,
    name: row.name,
    content: row.content,
    language: row.language,
    granularity: row.granularity,
    metadata: JSON.parse(row.metadata || '{}'),
    filePath: row.file_path,
    projectName: row.project_name,
    projectPath: row.project_path,
    fileName: row.file_name,
    relativePath: row.relative_path,
    tokens: [],  // 这里可能需要重新生成tokens
    range: { start: { row: 0, column: 0 }, end: { row: 0, column: 0 } } // 默认范围
  };
}

// 修改 rowToRelationship 函数，确保返回的对象符合新的 Relationship 类型
export function rowToRelationship(row: RelationshipRow): Relationship {
  // 确保类型符合 Relationship 中定义的字面量类型
  const validTypes = ['inheritance', 'dependency', 'call', 'style'] as const;
  const type = validTypes.includes(row.type as any) 
    ? (row.type as 'inheritance' | 'dependency' | 'call' | 'style')
    : 'dependency'; // 默认为依赖关系
  
  // 构建元数据对象，确保 kind 字段始终存在
  const metadata: RelationshipMetadata = {
    kind: row.kind || 'unknown', // 提供默认值，确保 kind 不为 undefined
    path: row.path,
    sourceCode: row.source_code,
    projectName: row.project_name,
    fileName: row.file_name
  };
  
  // 添加位置信息（如果有）
  if (row.line || row.column) {
    metadata.position = {
      line: row.line || 0,
      column: row.column || 0
    };
  }
  
  // 解析额外的元数据
  try {
    const extraMetadata = JSON.parse(row.metadata || '{}');
    if (extraMetadata.description) {
      metadata.description = extraMetadata.description;
    }
  } catch (e) {
    console.error('解析关系元数据失败:', e);
  }
  
  return {
    type,
    from: row.from_node,
    to: row.to_node,
    metadata
  };
}

// MetadataRow 接口保持不变
export interface MetadataRow {
  id: string;
  type: string;
  metadata: string;
}