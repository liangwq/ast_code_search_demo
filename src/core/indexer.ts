// src/core/indexer.ts
import { ParseResult, ParsedNode } from './types';
import * as path from 'path';
import * as fs from 'fs/promises';
import simpleGit from 'simple-git';

export interface IndexedNode extends ParsedNode {
  id: string;
  filePath: string;
  language: string;
  tokens: string[];
  projectName?: string;
  projectPath?: string;
  fileName?: string;
  relativePath?: string;
  content?: string;
  granularity?: string;
  nodeId?: string;        // 全局唯一节点ID
  parentId?: string;      // 父节点ID
}

export interface Index {
  nodes: Record<string, IndexedNode>;  // 所有节点
  byName: Record<string, string[]>;    // 按名称索引的节点ID
  byType: Record<string, string[]>;    // 按类型索引的节点ID
  byFile: Record<string, string[]>;    // 按文件索引的节点ID
  byLanguage: Record<string, string[]>; // 按语言索引的节点ID
}

export class Indexer {
  private index: Index;

  constructor() {
    this.index = {
      nodes: {},
      byName: {},
      byType: {},
      byFile: {},
      byLanguage: {}
    };
  }

  addToIndex(parseResult: ParseResult): void {
    const { nodes, filePath, language } = parseResult;
    
    // 提取项目信息
    const pathParts = filePath.split('/');
    const fileName = pathParts[pathParts.length - 1];
    
    // 假设项目根目录是 /Users/qian.lwq/Downloads/tree_sitter_test
    const projectPath = '/Users/qian.lwq/Downloads/tree_sitter_test';
    const projectName = 'tree_sitter_test';
    
    // 计算相对路径
    let relativePath = '';
    if (filePath.startsWith(projectPath)) {
      relativePath = filePath.substring(projectPath.length);
      if (relativePath.startsWith('/')) {
        relativePath = relativePath.substring(1);
      }
    }
    
    // 将解析结果添加到索引
    Object.entries(nodes).forEach(([id, node]) => {
      // 创建索引节点
      const indexedNode: IndexedNode = {
        ...node,
        id,
        filePath,
        language,
        tokens: this.tokenize(node.name),
        
        // 新增字段
        projectName,
        projectPath,
        fileName,
        relativePath
      };
      
      // 添加到主索引
      this.index.nodes[id] = indexedNode;
      
      // 添加到名称索引
      if (!this.index.byName[node.name]) {
        this.index.byName[node.name] = [];
      }
      this.index.byName[node.name].push(id);
      
      // 添加到类型索引
      if (!this.index.byType[node.type]) {
        this.index.byType[node.type] = [];
      }
      this.index.byType[node.type].push(id);
      
      // 添加到文件索引
      if (!this.index.byFile[filePath]) {
        this.index.byFile[filePath] = [];
      }
      this.index.byFile[filePath].push(id);
      
      // 添加到语言索引
      if (!this.index.byLanguage[language]) {
        this.index.byLanguage[language] = [];
      }
      this.index.byLanguage[language].push(id);
    });
  }

  private tokenize(text: string): string[] {
    // 简单的分词实现
    // 实际应用中可能需要更复杂的分词
    return text
      .toLowerCase()
      .split(/[^a-z0-9]/i)
      .filter(token => token.length > 0);
  }

  // 查询方法
  queryByName(name: string): IndexedNode[] {
    const ids = this.index.byName[name] || [];
    return ids.map(id => this.index.nodes[id]);
  }

  queryByType(type: string): IndexedNode[] {
    const ids = this.index.byType[type] || [];
    return ids.map(id => this.index.nodes[id]);
  }

  queryByFile(filePath: string): IndexedNode[] {
    const ids = this.index.byFile[filePath] || [];
    return ids.map(id => this.index.nodes[id]);
  }

  queryByLanguage(language: string): IndexedNode[] {
    const ids = this.index.byLanguage[language] || [];
    return ids.map(id => this.index.nodes[id]);
  }

  searchByText(text: string): IndexedNode[] {
    // 简单的文本搜索实现
    const tokens = this.tokenize(text);
    const matchingNodes = new Set<string>();
    
    // 遍历所有节点找到匹配的
    Object.entries(this.index.nodes).forEach(([id, node]) => {
      if (tokens.some(token => node.tokens.includes(token))) {
        matchingNodes.add(id);
      }
    });
    
    return Array.from(matchingNodes).map(id => this.index.nodes[id]);
  }

  getIndex(): Index {
    return this.index;
  }

  clear(): void {
    this.index = {
      nodes: {},
      byName: {},
      byType: {},
      byFile: {},
      byLanguage: {}
    };
  }

  getNodesMatchingRules(queryRules: string): IndexedNode[] {
    try {
      // 使用 tree-sitter 的查询功能来匹配节点
      const matchedNodes: IndexedNode[] = [];
      
      // 遍历所有已索引的节点
      for (const nodeId in this.index.nodes) {
        const node = this.index.nodes[nodeId];
        // 这里可以根据 queryRules 中定义的规则来匹配节点
        // 暂时简单实现，后续可以扩展更复杂的匹配逻辑
        if (this.matchesRule(node, queryRules)) {
          matchedNodes.push(node);
        }
      }
      
      return matchedNodes;
    } catch (error) {
      console.error('Error matching rules:', error);
      return [];
    }
  }

  private matchesRule(node: IndexedNode, rules: string): boolean {
    // 解析查询规则字符串
    const ruleLines = rules.split('\n').filter(line => line.trim());
    
    for (const rule of ruleLines) {
      if (rule.includes(node.type)) {
        return true;
      }
      // 可以添加更多匹配逻辑，比如：
      // - 检查节点名称
      // - 检查节点属性
      // - 支持正则表达式
      // - 支持树结构匹配
    }
    
    return false;
  }

  private async getProjectInfo(filePath: string) {
    // 获取项目根目录
    const projectRoot = await this.findProjectRoot(filePath);
    const projectName = path.basename(projectRoot);
    
    // 获取 Git 信息
    const gitInfo = await this.getGitInfo(projectRoot);
    
    return {
      projectName,
      projectPath: projectRoot,
      repositoryUrl: gitInfo.repositoryUrl,
      branchName: gitInfo.branchName,
      commitHash: gitInfo.commitHash
    };
  }

  private async findProjectRoot(filePath: string): Promise<string> {
    let currentDir = path.dirname(filePath);
    
    while (currentDir !== '/') {
      try {
        await fs.access(path.join(currentDir, 'package.json'));
        return currentDir;
      } catch {
        try {
          await fs.access(path.join(currentDir, '.git'));
          return currentDir;
        } catch {
          currentDir = path.dirname(currentDir);
        }
      }
    }
    
    return path.dirname(filePath);
  }

  private async getGitInfo(projectRoot: string) {
    try {
      const git = simpleGit(projectRoot);
      const remote = await git.getRemotes(true);
      const branch = await git.branch();
      const commit = await git.log(['--max-count=1']);
      
      return {
        repositoryUrl: remote[0]?.refs?.fetch || '',
        branchName: branch.current,
        commitHash: commit.latest?.hash || ''
      };
    } catch (error) {
      console.error('Error getting git info:', error);
      return {
        repositoryUrl: '',
        branchName: '',
        commitHash: ''
      };
    }
  }
}