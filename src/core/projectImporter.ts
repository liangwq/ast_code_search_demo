import fs from 'fs/promises';
import path from 'path';
import { Parser } from './parser';
import { Storage } from './storage';
// 删除旧的关系分析器导入
import { MainRelationshipAnalyzer } from './relationships/MainRelationshipAnalyzer';
// 导入新的类型
import { ParseResult } from './types';

export class ProjectImporter {
  private parser: Parser;
  private storage: Storage;
  // 删除旧的关系分析器属性，改为使用新的
  private relationshipAnalyzer: MainRelationshipAnalyzer;

  constructor() {
    this.parser = new Parser({
      includeComments: true,
      granularity: 'medium'
    });
    this.storage = new Storage();
    // 初始化新的关系分析器
    this.relationshipAnalyzer = new MainRelationshipAnalyzer();
  }

  // 修改方法签名，使用新的关系分析器类型
  async importProject(projectPath: string, relationshipAnalyzer?: MainRelationshipAnalyzer): Promise<any> {
    console.log('开始导入项目:', projectPath);
    const files = await this.scanProject(projectPath);
    console.log('扫描到的文件:', files);
    
    const parseResults = await this.parseFiles(files, projectPath);
    console.log('解析结果:', parseResults);
    
    // 使用提供的关系分析器或默认的实例
    const analyzer = relationshipAnalyzer || this.relationshipAnalyzer;
    const relationships = analyzer.analyze(parseResults);
    
    // 保存关系到数据库
    await this.storage.saveRelationships(relationships);
    
    // 保存解析结果和关系数据
    try {
      await this.storage.saveProjectData(parseResults, relationships);
      console.log('数据保存成功');
    } catch (error) {
      console.error('数据保存失败:', error);
      throw error;
    }
    
    return {
      parseResults,
      relationships
    };
  }

  private async scanProject(projectPath: string): Promise<string[]> {
    // 验证路径是否存在
    try {
      const stats = await fs.stat(projectPath);
      if (!stats.isDirectory()) {
        throw new Error('指定路径不是一个目录');
      }
    } catch (error: NodeJS.ErrnoException | any) {
      throw new Error(`无效的项目路径: ${error.message}`);
    }

    const supportedExtensions = ['.ts', '.js', '.tsx', '.jsx', '.css', '.scss', '.html'];
    const files: string[] = [];
    
    // 添加需要忽略的目录
    const ignoredDirectories = [
      'node_modules',
      'dist',
      'build',
      '.git',
      '.vscode',
      'coverage',
      'tmp',
      'temp',
      '.next',
      '.nuxt'
    ];

    async function scan(dir: string) {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        // 检查是否是需要忽略的目录
        if (entry.isDirectory()) {
          if (!ignoredDirectories.includes(entry.name)) {
            await scan(fullPath);
          }
        } else if (entry.isFile() && 
                   supportedExtensions.includes(path.extname(entry.name))) {
          files.push(fullPath);
        }
      }
    }

    await scan(projectPath);
    return files;
  }

  private async parseFiles(files: string[], projectPath: string) {
    const results = [];
    
    for (const file of files) {
      try {
        const ext = path.extname(file);
        const language = this.getLanguageByExtension(ext);
        
        // 读取文件内容
        const content = await fs.readFile(file, 'utf-8');
        
        const result = await this.parser.parseFile(file, language, content);
        results.push({
          ...result,
          projectPath,
          relativePath: path.relative(projectPath, file)
        });
      } catch (error) {
        console.error(`解析文件失败: ${file}`, error);
        // 继续处理其他文件，而不是直接抛出错误
        continue;
      }
    }
    
    return results;
  }

  private getLanguageByExtension(ext: string): string {
    const map: Record<string, string> = {
      '.ts': 'typescript',
      '.js': 'javascript',
      '.tsx': 'typescript',
      '.jsx': 'javascript',
      '.css': 'css',
      '.scss': 'scss',
      '.html': 'html'
    };
    return map[ext] || 'unknown';
  }
}