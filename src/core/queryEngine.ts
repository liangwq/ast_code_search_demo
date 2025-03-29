
// src/core/queryEngine.ts
import { Indexer, IndexedNode } from './indexer';

export interface QueryOptions {
  language?: string;
  type?: string;
  name?: string;
  filePath?: string;
  text?: string;
  limit?: number;
  offset?: number;
  
  // 新增查询选项
  projectName?: string;
  fileName?: string;
  relativePath?: string;
}

export interface QueryResult {
  nodes: IndexedNode[];
  total: number;
  limit: number;
  offset: number;
}

export class QueryEngine {
  private indexer: Indexer;

  constructor(indexer: Indexer) {
    this.indexer = indexer;
  }

  query(options: QueryOptions): QueryResult {
    let results: IndexedNode[] = [];
    
    // 根据不同的查询条件获取结果
    if (options.name) {
      results = this.indexer.queryByName(options.name);
    } else if (options.type) {
      results = this.indexer.queryByType(options.type);
    } else if (options.filePath) {
      results = this.indexer.queryByFile(options.filePath);
    } else if (options.language) {
      results = this.indexer.queryByLanguage(options.language);
    } else if (options.text) {
      results = this.indexer.searchByText(options.text);
    } else {
      // 如果没有特定条件，返回所有节点
      results = Object.values(this.indexer.getIndex().nodes);
    }
    
    // 应用过滤条件
    if (options.language && !options.name && !options.type && !options.filePath && !options.text) {
      results = results.filter(node => node.language === options.language);
    }
    
    if (options.type && !options.name && !options.filePath && !options.text) {
      results = results.filter(node => node.type === options.type);
    }
    
    // 应用新增的过滤条件
    if (options.projectName) {
      results = results.filter(node => node.projectName === options.projectName);
    }
    
    if (options.fileName) {
      results = results.filter(node => node.fileName === options.fileName);
    }
    
    if (options.relativePath) {
      const searchPath = options.relativePath;
      results = results.filter(node => 
        typeof node.relativePath === 'string' && 
        typeof searchPath === 'string' && 
        node.relativePath.includes(searchPath)
      );
    }
    
    // 记录总数
    const total = results.length;
    
    // 应用分页
    const limit = options.limit || 100;
    const offset = options.offset || 0;
    
    results = results.slice(offset, offset + limit);
    
    return {
      nodes: results,
      total,
      limit,
      offset
    };
  }
}