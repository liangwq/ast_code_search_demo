// src/core/types.ts
export interface ParsedNode {
  type: string;
  name: string;
  range: {
    start: { row: number; column: number };
    end: { row: number; column: number };
  };
  parent?: string;
  children?: string[];
  metadata?: {
    nodeText?: string;
    importSource?: string;
    importType?: 'named' | 'namespace';
    captureType?: string;
  };
}

export interface ParseResult {
  nodes: Record<string, ParsedNode>;  // 节点ID到节点的映射
  rootNodes: string[];               // 根节点ID列表
  language: string;                  // 源代码语言
  filePath: string;                  // 文件路径
  projectPath?: string;             // 项目路径
  relativePath?: string;            // 相对路径
}

export interface ParserOptions {
  includeComments?: boolean;
  maxDepth?: number;
  granularity?: 'fine' | 'medium' | 'coarse' | 'custom';  // 添加 'custom' 选项
  customRules?: any;
  filePath?: string;
}


