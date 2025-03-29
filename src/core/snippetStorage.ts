import { IndexedNode } from './indexer';
import { Database } from './database';
import { SnippetQuery, SnippetRow, rowToIndexedNode } from './types/dbTypes';
import path from 'path';

export class SnippetStorage {
  private db: Database;

  constructor() {
    this.db = Database.getInstance();
  }

  public async initTable(): Promise<void> {
    // 创建代码片段表 - 增强版
    await this.db.run(`
      CREATE TABLE IF NOT EXISTS snippets (
        id TEXT PRIMARY KEY,
        type TEXT,
        name TEXT,
        content TEXT,
        language TEXT,
        granularity TEXT,
        metadata TEXT,
        
        /* 节点关系相关字段 */
        node_type TEXT,           -- 节点类型（class, function, variable等）
        node_id TEXT UNIQUE,      -- 全局唯一节点ID
        parent_id TEXT,           -- 父节点ID
        
        /* 追溯相关字段 */
        project_name TEXT NOT NULL,      -- 项目名称
        project_path TEXT NOT NULL,      -- 项目完整路径
        file_name TEXT NOT NULL,         -- 文件名
        file_path TEXT NOT NULL,         -- 文件完整路径
        relative_path TEXT NOT NULL,     -- 相对于项目的路径
        repository_url TEXT,             -- 仓库URL（可选）
        branch_name TEXT,                -- 分支名（可选）
        commit_hash TEXT,                -- 提交哈希（可选）
        
        /* 位置信息 */
        start_line INTEGER,              -- 开始行
        start_column INTEGER,            -- 开始列
        end_line INTEGER,                -- 结束行
        end_column INTEGER,              -- 结束列
        
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
  
    // 创建索引
    await Promise.all([
      this.db.run('CREATE INDEX IF NOT EXISTS idx_project ON snippets(project_name)'),
      this.db.run('CREATE INDEX IF NOT EXISTS idx_file ON snippets(file_name)'),
      this.db.run('CREATE INDEX IF NOT EXISTS idx_path ON snippets(relative_path)'),
      this.db.run('CREATE INDEX IF NOT EXISTS idx_node_type ON snippets(node_type)'),
      this.db.run('CREATE INDEX IF NOT EXISTS idx_node_id ON snippets(node_id)'),
      this.db.run('CREATE INDEX IF NOT EXISTS idx_parent_id ON snippets(parent_id)')
    ]);
  }

  public async resetTable(): Promise<void> {
    await this.db.run(`
      DROP TABLE IF EXISTS snippets
    `);
    
    await this.db.run(`
      CREATE TABLE IF NOT EXISTS snippets (
        id TEXT PRIMARY KEY,
        node_id TEXT,  /* 添加原始节点ID字段 */
        name TEXT,
        type TEXT,
        content TEXT,
        language TEXT,
        file_path TEXT,
        project_path TEXT,
        project_name TEXT,
        file_name TEXT,
        relative_path TEXT,
        tokens TEXT,
        granularity TEXT,
        /* 其他字段保持不变 */
        node_type TEXT,
        parent_id TEXT,
        start_line INTEGER,
        start_column INTEGER,
        end_line INTEGER,
        end_column INTEGER,
        metadata TEXT
      )
    `);
    
    // 创建索引
    await this.db.run(`CREATE INDEX IF NOT EXISTS idx_snippets_node_id ON snippets(node_id)`);
    await this.db.run('CREATE INDEX IF NOT EXISTS idx_parent_id ON snippets(parent_id)')
  }

  public async saveSnippet(node: IndexedNode): Promise<void> {
    const stmt = await this.db.prepare(`
      INSERT OR REPLACE INTO snippets (
        id, type, name, content, language, granularity, metadata,
        node_type, node_id, parent_id,
        project_name, project_path, file_name, file_path, relative_path,
        start_line, start_column, end_line, end_column
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
  
    // 生成全局唯一节点ID
    const nodeId = node.id || `node_${node.type}_${node.name}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
    // 提取位置信息
    const startLine = node.range?.start?.row || 0;
    const startColumn = node.range?.start?.column || 0;
    const endLine = node.range?.end?.row || 0;
    const endColumn = node.range?.end?.column || 0;
  
    // 提取父节点ID - 使用可选的 parentId 属性或从 metadata 中安全地提取
    const parentId = (node as any).parentId || '';
  
    await stmt.run([
      node.id,
      node.type,
      node.name,
      node.content,
      node.language,
      node.granularity,
      JSON.stringify(node.metadata),
      node.type,                // 节点类型
      nodeId,                   // 全局唯一节点ID
      parentId,                 // 父节点ID
      node.projectName || '',
      node.projectPath || '',
      node.fileName || '',
      node.filePath || '',
      node.relativePath || '',
      startLine,                // 开始行
      startColumn,              // 开始列
      endLine,                  // 结束行
      endColumn                 // 结束列
    ]);
  }

  public async getSnippets(query: SnippetQuery): Promise<IndexedNode[]> {
    const conditions: string[] = [];
    const params: (string | number)[] = [];
    
    // 添加各种查询条件
    if (query.id) {
      conditions.push('id = ?');
      params.push(query.id);
    }
    if (query.type) {
      conditions.push('type = ?');
      params.push(query.type);
    }
    if (query.name) {
      conditions.push('name LIKE ?');
      params.push(`%${query.name}%`);
    }
    if (query.content) {
      conditions.push('content LIKE ?');
      params.push(`%${query.content}%`);
    }
    if (query.language) {
      conditions.push('language = ?');
      params.push(query.language);
    }
    if (query.granularity) {
      conditions.push('granularity = ?');
      params.push(query.granularity);
    }
    if (query.projectName) {
      conditions.push('project_name = ?');
      params.push(query.projectName);
    }
    if (query.fileName) {
      conditions.push('file_name = ?');
      params.push(query.fileName);
    }
    if (query.filePath) {
      conditions.push('file_path LIKE ?');
      params.push(`%${query.filePath}%`);
    }
    
    // 构建SQL语句
    let sql = 'SELECT * FROM snippets';
    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }
    
    // 执行查询
    const rows = await this.db.all<SnippetRow>(sql, params);
    
    // 转换结果
    return rows.map(rowToIndexedNode);
  }

  public async getNodeById(id: string): Promise<IndexedNode | null> {
    const row = await this.db.get<SnippetRow>('SELECT * FROM snippets WHERE id = ?', [id]);
    if (!row) return null;
    return rowToIndexedNode(row);
  }

  public async getNodeByOriginalId(nodeId: string): Promise<IndexedNode | null> {
    const row = await this.db.get<SnippetRow>(
      'SELECT * FROM snippets WHERE node_id = ?',
      [nodeId]
    );
    
    if (!row) return null;
    
    return rowToIndexedNode(row);
  }

  // 分词方法
  public tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .split(/[^a-zA-Z0-9]+/)
      .filter(token => token.length > 0);
  }
}