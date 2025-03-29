// src/index.ts
import { Parser } from './core/parser';
import { Indexer } from './core/indexer';
import { QueryEngine } from './core/queryEngine';
import { fetchFileMetadata, renderFileMetadata } from './components/FileMetadata';
import fs from 'fs/promises';

export {
  Parser,
  Indexer,
  QueryEngine
};

// 提供一个简单的使用示例
async function example() {
  // 创建解析器
  const parser = new Parser({
    includeComments: true,
    granularity: 'medium'
  });
  
  // 创建索引器
  const indexer = new Indexer();
  
  try {
    // 解析文件 - using actual files from our project
    const tsContent = await fs.readFile('./src/index.ts', 'utf-8');
    const jsContent = await fs.readFile('./src/services/tree-sitter/queries/javascript.ts', 'utf-8');
    
    const tsResult = await parser.parseFile('./src/index.ts', 'typescript', tsContent);
    const jsResult = await parser.parseFile('./src/services/tree-sitter/queries/javascript.ts', 'typescript', jsContent);
    
    // 将结果添加到索引
    indexer.addToIndex(tsResult);
    indexer.addToIndex(jsResult);
    
    // 创建查询引擎
    const queryEngine = new QueryEngine(indexer);
    
    // 执行查询
    const functions = queryEngine.query({ type: 'function.declaration' });
    console.log(`Found ${functions.total} functions`);
    
    const classes = queryEngine.query({ type: 'class.declaration' });
    console.log(`Found ${classes.total} classes`);
    
    // 文本搜索
    const searchResults = queryEngine.query({ text: 'user' });
    console.log(`Found ${searchResults.total} nodes matching 'user'`);
  } catch (error) {
    console.error('Error:', error);
  }
}

// 如果直接运行此文件则执行示例
if (require.main === module) {
  example().catch(console.error);
}

async function initializeApp() {
  try {
    const container = document.getElementById('file-metadata-container');
    if (container) {
      const metadata = await fetchFileMetadata();
      renderFileMetadata(container, metadata);
    }
  } catch (error) {
    console.error('初始化应用失败:', error);
  }
}

// 在页面加载完成后初始化
document.addEventListener('DOMContentLoaded', initializeApp);