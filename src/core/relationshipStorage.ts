// 修改导入，使用新的关系类型
import { Relationship, RelationshipMetadata } from './relationships/Relationship';
import { Database } from './database';
import { RelationshipQuery, RelationshipRow, MetadataRow } from './types/dbTypes';

// 添加本地的 rowToRelationship 函数，替代从 dbTypes 导入的版本
function rowToRelationship(row: RelationshipRow): Relationship {
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

export class RelationshipStorage {
  private db: Database;

  constructor() {
    this.db = Database.getInstance();
  }

  public async initTable(): Promise<void> {
    // 创建关系表 - 增强版
    await this.db.run(`
      CREATE TABLE IF NOT EXISTS relationships (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        from_node TEXT NOT NULL,
        to_node TEXT NOT NULL,
        
        /* 关系元数据 */
        kind TEXT,                  -- 关系种类
        source_code TEXT,           -- 相关代码
        path TEXT,                  -- 文件路径
        
        /* 位置信息 */
        line INTEGER,               -- 行号
        column INTEGER,             -- 列号
        
        /* 项目信息 */
        project_name TEXT,          -- 项目名称
        file_name TEXT,             -- 文件名
        
        metadata TEXT,              -- 其他元数据（JSON格式）
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        
        FOREIGN KEY(from_node) REFERENCES snippets(id),
        FOREIGN KEY(to_node) REFERENCES snippets(id)
      )
    `);
    
    // 创建索引
    await Promise.all([
      this.db.run('CREATE INDEX IF NOT EXISTS idx_rel_type ON relationships(type)'),
      this.db.run('CREATE INDEX IF NOT EXISTS idx_from_node ON relationships(from_node)'),
      this.db.run('CREATE INDEX IF NOT EXISTS idx_to_node ON relationships(to_node)'),
      this.db.run('CREATE INDEX IF NOT EXISTS idx_rel_kind ON relationships(kind)'),
      this.db.run('CREATE INDEX IF NOT EXISTS idx_rel_project ON relationships(project_name)')
    ]);
  }

  public async resetTable(): Promise<void> {
    await this.db.run('DROP TABLE IF EXISTS relationships');
    await this.initTable();
  }

  public async saveRelationship(relationship: Relationship): Promise<void> {
    const stmt = await this.db.prepare(`
      INSERT INTO relationships (
        id, type, from_node, to_node, 
        kind, source_code, path, line, column,
        project_name, file_name, metadata
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    // 提取元数据
    const metadata = relationship.metadata || { kind: 'unknown' }; // 确保metadata存在且有kind字段
    const kind = metadata.kind; // kind现在一定存在，因为RelationshipMetadata中kind是必需字段
    const sourceCode = metadata.sourceCode || '';
    const path = metadata.path || '';
    const line = metadata.position?.line || 0;
    const column = metadata.position?.column || 0;
    
    // 提取项目和文件信息（如果有）
    // 从 path 中提取项目名和文件名，因为 metadata 中没有这些字段
    const projectName = path ? path.split('/')[0] || '' : '';
    const fileName = path ? path.split('/').pop() || '' : '';
    
    await stmt.run([
      `rel_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      relationship.type,
      relationship.from,
      relationship.to,
      kind,
      sourceCode,
      path,
      line,
      column,
      projectName,
      fileName,
      JSON.stringify(metadata)
    ]);
  }

  // 在 RelationshipStorage 类中修改 getRelationships 方法
  public async getRelationships(query: RelationshipQuery, limit?: number, offset?: number): Promise<Relationship[]> {
    const conditions: string[] = [];
    const params: any[] = [];
  
    // 处理查询条件
    if (query.type && query.type !== 'all') {
      conditions.push('type = ?');
      params.push(query.type);
    }
    if (query.from_node) {
      conditions.push('from_node = ?');
      params.push(query.from_node);
    }
    if (query.to_node) {
      conditions.push('to_node = ?');
      params.push(query.to_node);
    }
  
    // 构建 SQL 查询
    const whereClause = conditions.length > 0 
      ? `WHERE ${conditions.join(' AND ')}` 
      : '';
    
    // 添加分页
    const limitClause = limit !== undefined ? `LIMIT ${limit}` : '';
    const offsetClause = offset !== undefined ? `OFFSET ${offset}` : '';
    
    const sql = `SELECT * FROM relationships ${whereClause} ${limitClause} ${offsetClause}`;
    
    // 执行查询
    const rows = await this.db.all<RelationshipRow>(sql, params);
    return rows.map(row => rowToRelationship(row));
  }
  
  // 添加计数方法
  public async countRelationships(query: RelationshipQuery): Promise<number> {
    const conditions: string[] = [];
    const params: any[] = [];
  
    // 处理查询条件（与 getRelationships 相同）
    if (query.type && query.type !== 'all') {
      conditions.push('type = ?');
      params.push(query.type);
    }
    if (query.from_node) {
      conditions.push('from_node = ?');
      params.push(query.from_node);
    }
    if (query.to_node) {
      conditions.push('to_node = ?');
      params.push(query.to_node);
    }
  
    const whereClause = conditions.length > 0 
      ? `WHERE ${conditions.join(' AND ')}` 
      : '';
  
    const sql = `SELECT COUNT(*) as count FROM relationships ${whereClause}`;
    const result = await this.db.get<{count: number}>(sql, params);
    
    // 修改这一行，增加类型安全性
    return result && typeof result.count === 'number' ? result.count : 0;
  }
  
  // 添加一个新方法来检查代码片段
  public async getRelationshipsWithSourceCode(): Promise<any[]> {
    const rows = await this.db.all(`
      SELECT id, type, from_node, to_node, kind, source_code, path, file_name
      FROM relationships
      WHERE source_code IS NOT NULL AND source_code != ''
    `);
    
    console.log('查询到包含代码片段的关系数据:', rows.length);
    return rows;
  }
  
  // 添加一个方法来检查所有关系的元数据
  public async checkRelationshipsMetadata(): Promise<void> {
    interface MetadataRow {
      id: string;
      type: string;
      metadata: string;
    }
    
    const rows = await this.db.all<MetadataRow>(`
      SELECT id, type, metadata
      FROM relationships
      LIMIT 10
    `);
    
    console.log('关系元数据样本:');
    rows.forEach(row => {
      try {
        const metadata = JSON.parse(row.metadata);
        console.log(`关系ID: ${row.id}, 类型: ${row.type}, 是否有sourceCode: ${!!metadata.sourceCode}`);
        if (metadata.sourceCode) {
          console.log(`代码片段长度: ${metadata.sourceCode.length}`);
        }
      } catch (e) {
        console.error(`解析元数据失败: ${e}`);
      }
    });
  }

  public async getRelationshipById(id: string): Promise<Relationship | null> {
    const row = await this.db.get<RelationshipRow>(
      'SELECT * FROM relationships WHERE id = ?',
      [id]
    );
    
    if (!row) return null;
    
    return rowToRelationship(row);
  }

  public async getRelationshipsBetween(fromId: string, toId: string): Promise<Relationship[]> {
    const rows = await this.db.all<RelationshipRow>(
      'SELECT * FROM relationships WHERE (from_node = ? AND to_node = ?) OR (from_node = ? AND to_node = ?)',
      [fromId, toId, toId, fromId]
    );
    
    return rows.map(row => rowToRelationship(row));
  }
}