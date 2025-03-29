// 在文件顶部的导入语句后添加接口定义
import express from 'express';
import multer from 'multer';
import path from 'path';
import { Parser } from './core/parser';
import { Indexer } from './core/indexer';
import { QueryEngine } from './core/queryEngine';
import { Stats } from 'fs';
import { Storage } from './core/storage';
import cors from 'cors';
import fs from 'fs/promises';
import { ProjectImporter } from './core/projectImporter';
import { MainRelationshipAnalyzer } from './core/relationships/MainRelationshipAnalyzer';
import { Relationship, RelationshipMetadata } from './core/relationships/Relationship'; // 更新导入路径
import { SnippetQuery, RelationshipQuery } from './core/types/dbTypes'; // 添加 RelationshipQuery 导入

// 添加接口定义
interface FileStats {
  filename: string;
  stats: Stats;
}

// 创建 Express 应用
const app = express();
const storage = new Storage();

// 基础中间件配置
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Multer 配置
const upload = multer({ 
  dest: 'uploads/',
  fileFilter: (req, file, cb) => {
    const allowedExtensions = ['.ts', '.js', '.tsx', '.jsx', '.html', '.css', '.py'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedExtensions.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only TypeScript, JavaScript, HTML, CSS and Python files are supported'));
    }
  }
});

// API 路由定义
app.post('/api/parse', upload.array('files'), async (req, res) => {
  try {
    const parser = new Parser({
      includeComments: true,
      granularity: 'medium'
    });
    const indexer = new Indexer();
    
    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    console.log('Files received:', files.map(f => ({
      name: f.originalname,
      path: f.path,
      size: f.size
    })));

    const results = [];
    
    for (const file of files) {
      try {
        const ext = path.extname(file.originalname).toLowerCase();
        const language = ext === '.ts' || ext === '.tsx' ? 'typescript' 
                      : ext === '.js' || ext === '.jsx' ? 'javascript'
                      : ext === '.html' ? 'html'
                      : ext === '.css' ? 'css'
                      : ext === '.py'? 'python'
                      : 'unknown';
        
        // 在 /api/parse 路由中
        console.log(`Processing file: ${file.originalname}, language: ${language}`);
        const content = await fs.readFile(file.path, 'utf-8');
        const result = await parser.parseFile(file.path, language, content);
        console.log(`File parsed successfully: ${file.originalname}`);
        
        indexer.addToIndex(result);
        results.push({
          filename: file.originalname,
          ...result
        });
      } catch (fileError) {
        console.error(`Error processing file ${file.originalname}:`, fileError);
        throw fileError;
      }
    }
    
    const queryEngine = new QueryEngine(indexer);
    
    res.json({
      results,
      summary: {
        functions: queryEngine.query({ type: 'function_declaration' }).total,
        classes: queryEngine.query({ type: 'class_declaration' }).total,
      }
    });
  } catch (error) {
    console.error('Server error:', error);
    res.status(500).json({ 
      error: String(error),
      stack: process.env.NODE_ENV === 'development' ? (error as Error).stack : undefined
    });
  }
});

app.post('/api/query', express.json(), async (req, res) => {
  try {
    const { queryRules, files, language } = req.body;
    
    if (!queryRules) {
      return res.status(400).json({ error: 'Query rules are required' });
    }

    console.log('Received query rules:', queryRules);
    console.log('Processing files:', files);

    const parser = new Parser({
      includeComments: true,
      granularity: 'custom',
      customRules: queryRules
    });

    const indexer = new Indexer();
    const results = [];
  
    // 从 uploads 目录获取最新上传的文件
    const uploadedFiles = await new Promise<string[]>((resolve, reject) => {
      const fs = require('fs');
      fs.readdir('uploads', (err: any, files: string[]) => {
        if (err) reject(err);
        else resolve(files);
      });
    });
  
    // 按修改时间排序，获取最新的文件
    const latestFiles = await Promise.all(
      uploadedFiles.map(async (filename): Promise<FileStats> => {
        const stats = await new Promise<Stats>((resolve, reject) => {
          const fs = require('fs');
          fs.stat(`uploads/${filename}`, (err: any, stats: Stats) => {
            if (err) reject(err);
            else resolve(stats);
          });
        });
        return { filename, stats };
      })
    );
  
    latestFiles.sort((a: FileStats, b: FileStats) => 
      b.stats.mtime.getTime() - a.stats.mtime.getTime()
    );
  
    // 只处理最近上传的文件
    for (const file of files) {
      try {
        // 找到对应的上传文件
        const uploadedFile = latestFiles.find((f: FileStats) => f.stats.size > 0);
        if (!uploadedFile) {
          throw new Error('No valid uploaded file found');
        }

        const filePath = path.join(process.cwd(), 'uploads', uploadedFile.filename);
        const content = await fs.readFile(filePath, 'utf-8');
        const result = await parser.parseFile(filePath, language || 'typescript', content);
        
        indexer.addToIndex(result);
        results.push({
          filename: file.name,
          ...result
        });
      } catch (fileError) {
        console.error(`Error processing file:`, fileError);
        throw fileError;
      }
    }
  
    const matchedNodes = indexer.getNodesMatchingRules(queryRules);
  
    res.json({
      results,
      matchedNodes
    });
  } catch (error) {
    console.error('Query error:', error);
    res.status(500).json({ error: String(error) });
  }
});

// 修改搜索接口为 POST 方法
app.post('/api/search', async (req, res) => {
  try {
    const { type, value, filters } = req.body;
    
    // 构建查询条件
    const queryParams: any = {};
    
    if (filters.projectName) {
      queryParams.projectName = filters.projectName;
    }
    if (filters.fileName) {
      queryParams.fileName = filters.fileName;
    }
    if (filters.relativePath) {
      queryParams.filePath = filters.relativePath;
    }
    
    // 如果有搜索类型和值，添加相应的查询条件
    if (type && value) {
      queryParams[type] = value;
    }
    
    const snippets = await storage.getSnippets(queryParams);
    res.json({ results: snippets });
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ 
      error: 'Search failed',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

// Initialize server
// 在 initializeServer 函数中
async function initializeServer() {
  try {
    await fs.mkdir('uploads', { recursive: true });
    
    // 确保数据库初始化 - 重建表结构
    console.log('正在初始化数据库...');
    await storage.initDatabase(); // 这会调用 resetTable() 方法
    console.log('数据库初始化完成');
    
    app.listen(3001, () => {
      console.log('Server running on http://localhost:3001');
    });
  } catch (error) {
    console.error('服务器初始化失败:', error);
    process.exit(1);
  }
}

// Start the server
initializeServer();

// 添加获取元数据的接口
app.get('/api/metadata', async (req, res) => {
  try {
    // 从数据库中获取唯一的项目名称和文件类型
    const snippets = await storage.getSnippets({});
    
    // 提取唯一的项目名称和文件类型（添加空值检查）
    const projects = [...new Set(snippets.map(s => s.projectName || '').filter(Boolean))];
    const fileTypes = [...new Set(snippets
      .map(s => s.fileName || '')
      .filter(Boolean)
      .map(name => name.split('.').pop() || '')
      .filter(Boolean)
    )];
    
    res.json({
      projects,
      fileTypes,
      snippets: snippets
        .filter(s => s.projectName && s.fileName) // 只返回有效的数据
        .map(s => ({
          projectName: s.projectName,
          projectPath: s.projectPath,
          fileName: s.fileName,
          filePath: s.filePath
        }))
    });
  } catch (error) {
    console.error('获取元数据失败:', error);
    res.status(500).json({ 
      error: '获取元数据失败',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

// 修改项目导入路由
app.post('/api/import-project', async (req, res) => {
  try {
    const { projectPath } = req.body;
    if (!projectPath) {
      return res.status(400).json({ error: '项目路径不能为空' });
    }

    // 确保路径是绝对路径
    const absolutePath = path.isAbsolute(projectPath) 
      ? projectPath 
      : path.resolve(process.cwd(), projectPath);

    const importer = new ProjectImporter();
    // 使用新的关系分析器
    const relationshipAnalyzer = new MainRelationshipAnalyzer();
    
    // 导入项目并分析关系
    const result = await importer.importProject(absolutePath, relationshipAnalyzer);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('项目导入失败:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '项目导入失败'
    });
  }
});

// 修改关系查询接口，确保返回完整的节点信息
app.get('/api/relationships', async (req, res) => {
  try {
    const storage = new Storage();
    const type = req.query.type as string;
    
    // 获取关系数据
    const relationships = await storage.getRelationships({
      type: type === 'all' ? undefined : type
    }) as Relationship[]; // 添加类型断言

    // 获取相关节点
    const nodeIds = new Set<string>();
    relationships.forEach(rel => {
      nodeIds.add(rel.from);
      nodeIds.add(rel.to);
    });

    // 获取节点数据
    const nodes: Record<string, any> = {};
    for (const id of nodeIds) {
      const node = await storage.getNodeById(id);
      if (node) {
        nodes[id] = node;
      } else {
        console.warn(`无法找到节点: ${id}`);
        // 创建一个占位符节点，避免前端报错
        nodes[id] = {
          id,
          type: '未知',
          name: '未知节点',
          content: '无法获取节点内容',
          fileName: '未知文件'
        };
      }
    }

    res.json({
      relationships,
      nodes
    });
  } catch (error) {
    console.error('获取关系数据失败:', error);
    res.status(500).json({ 
      error: String(error),
      stack: process.env.NODE_ENV === 'development' ? (error as Error).stack : undefined
    });
  }
});

app.get('/api/search', async (req, res) => {
  try {
    const { projectName, fileName, relativePath, name, type, content } = req.query;
    
    // 构建查询对象，只包含非空值
    const query: SnippetQuery = {};
    
    if (projectName) query.projectName = projectName as string;
    if (fileName) query.fileName = fileName as string;
    if (relativePath) query.filePath = relativePath as string;
    if (name) query.name = name as string;
    if (type) query.type = type as string;
    if (content) query.content = content as string;
    
    console.log('搜索查询参数:', query);
    
    // 从存储中获取代码片段
    const snippets = await storage.getSnippets(query);
    console.log(`找到 ${snippets.length} 个匹配的代码片段`);
    
    res.json({ results: snippets });
  } catch (error) {
    console.error('搜索错误:', error);
    res.status(500).json({ 
      error: '搜索失败', 
      details: error instanceof Error ? error.message : String(error) 
    });
  }
});



// 添加关系解释接口
app.get('/api/relationship-explanation', async (req, res) => {
  try {
    const fromId = req.query.from as string;
    const toId = req.query.to as string;
    
    if (!fromId || !toId) {
      return res.status(400).json({ error: '缺少必要的参数' });
    }
    
    // 获取关系数据
    const relationships = await storage.getRelationships({
      from_node: fromId,
      to_node: toId
    });
    
    // 如果没有找到直接关系，尝试反向查找
    if (relationships.length === 0) {
      const reverseRelationships = await storage.getRelationships({
        from_node: toId,
        to_node: fromId
      });
      
      if (reverseRelationships.length > 0) {
        // 找到了反向关系
        const relationship = reverseRelationships[0] as Relationship; // 添加类型断言
        const explanation = generateExplanation(relationship, true);
        return res.json({ explanation });
      }
      
      return res.json({ explanation: '未找到这两个节点之间的直接关系' });
    }
    
    // 找到了关系
    const relationship = relationships[0] as Relationship; // 添加类型断言
    const explanation = generateExplanation(relationship, false);
    
    res.json({ explanation });
  } catch (error) {
    console.error('获取关系解释失败:', error);
    res.status(500).json({ 
      error: '获取关系解释失败',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

// 生成关系解释
function generateExplanation(relationship: Relationship, isReverse: boolean): string {
  const { type, metadata } = relationship;
  
  // 修复这里：检查 description 属性是否存在
  if (metadata && 'description' in metadata && metadata.description) {
    return metadata.description;
  }
  
  let explanation = '';
  
  if (isReverse) {
    // 反向关系
    switch (type) {
      case 'inheritance':
        explanation = '这是一个继承关系，目标节点继承自源节点';
        break;
      case 'dependency':
        explanation = '这是一个依赖关系，目标节点依赖于源节点';
        break;
      case 'call':
        explanation = '这是一个调用关系，目标节点调用了源节点';
        break;
      case 'style':
        explanation = '这是一个样式关系，目标节点的样式影响源节点';
        break;
      default:
        explanation = `这是一个 ${type} 类型的关系`;
    }
  } else {
    // 正向关系
    switch (type) {
      case 'inheritance':
        explanation = '这是一个继承关系，源节点继承自目标节点';
        break;
      case 'dependency':
        explanation = '这是一个依赖关系，源节点依赖于目标节点';
        break;
      case 'call':
        explanation = '这是一个调用关系，源节点调用了目标节点';
        break;
      case 'style':
        explanation = '这是一个样式关系，源节点的样式影响目标节点';
        break;
      default:
        explanation = `这是一个 ${type} 类型的关系`;
    }
  }
  
  // 添加元数据信息
  if (metadata && metadata.kind) {
    explanation += `<br>关系种类: ${metadata.kind}`;
  }
  
  // 使用 pre 和 code 标签包装源代码，确保正确显示
  if (metadata && metadata.sourceCode) {
    const escapedCode = metadata.sourceCode
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    explanation += `<br>相关代码: <pre><code>${escapedCode}</code></pre>`;
  }
  
  return explanation;
}

// 添加关系统计接口
app.get('/api/relationship-stats', async (req, res) => {
  try {
    // 获取所有关系
    const relationships = await storage.getRelationships({}) as Relationship[]; // 添加类型断言
    
    // 检查是否有数据返回
    console.log(`获取到 ${relationships.length} 个关系数据`);
    
    // 按类型统计关系
    const stats = {
      total: relationships.length,
      byType: {
        inheritance: relationships.filter(r => r.type === 'inheritance').length,
        dependency: relationships.filter(r => r.type === 'dependency').length,
        call: relationships.filter(r => r.type === 'call').length,
        style: relationships.filter(r => r.type === 'style').length
      },
      byKind: {} as Record<string, number>
    };
    
    // 按 kind 统计关系
    relationships.forEach(rel => {
      if (rel.metadata?.kind) {
        const kind = rel.metadata.kind;
        if (!stats.byKind[kind]) {
          stats.byKind[kind] = 0;
        }
        stats.byKind[kind]++;
      }
    });
    
    res.json(stats);
  } catch (error) {
    console.error('获取关系统计失败:', error);
    res.status(500).json({ 
      error: '获取关系统计失败',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

// 添加关系过滤接口
app.post('/api/relationships/filter', async (req, res) => {
  try {
    const { 
      type, 
      kind, 
      projectName, 
      fileName,
      limit = 100,
      offset = 0
    } = req.body;
    
    // 修改查询对象构建方式，使其符合 RelationshipQuery 接口
    const query: RelationshipQuery = {};
    if (type && type !== 'all') query.type = type;
    
    // 获取关系数据
    const relationships = await storage.getRelationships(query, limit, offset) as Relationship[];
    
    // 在内存中进行额外的过滤，处理元数据相关的条件
    let filteredRelationships = relationships;
    
    if (kind || projectName || fileName) {
      filteredRelationships = relationships.filter(rel => {
        if (kind && rel.metadata?.kind !== kind) return false;
        if (projectName && rel.metadata?.projectName !== projectName) return false;
        if (fileName && rel.metadata?.fileName !== fileName) return false;
        return true;
      });
    }
    
    // 获取总数（这里使用过滤后的数组长度）
    const total = filteredRelationships.length;

    // 获取相关节点
    const nodeIds = new Set<string>();
    filteredRelationships.forEach(rel => {
      nodeIds.add(rel.from);
      nodeIds.add(rel.to);
    });

    // 获取节点数据
    const nodes: Record<string, any> = {};
    for (const id of nodeIds) {
      const node = await storage.getNodeById(id);
      if (node) {
        nodes[id] = node;
      } else {
        nodes[id] = {
          id,
          type: '未知',
          name: '未知节点',
          content: '无法获取节点内容',
          fileName: '未知文件'
        };
      }
    }

    res.json({
      relationships: filteredRelationships,
      nodes,
      total,
      limit,
      offset
    });
  } catch (error) {
    console.error('过滤关系数据失败:', error);
    res.status(500).json({ 
      error: String(error)
    });
  }
});

// 添加一个调试端点，检查关系数据
app.get('/api/debug-relationships', async (req, res) => {
  try {
    // 1. 检查数据库中是否有关系数据
    const db = require('./core/database').Database.getInstance();
    const rawRows = await db.all('SELECT COUNT(*) as count FROM relationships');
    
    // 2. 尝试使用旧的查询方式获取数据
    const relationships = await storage.getRelationships({});
    
    // 3. 检查 storage 对象是否正确初始化
    const storageInfo = {
      isInitialized: !!storage,
      hasGetRelationships: typeof storage.getRelationships === 'function'
    };
    
    res.json({
      databaseCount: rawRows[0]?.count || 0,
      relationshipsCount: relationships.length,
      storageInfo,
      sampleRelationship: relationships.length > 0 ? relationships[0] : null
    });
  } catch (error) {
    console.error('调试关系数据失败:', error);
    res.status(500).json({ 
      error: '调试关系数据失败',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});