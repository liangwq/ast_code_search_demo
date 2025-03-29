// src/core/parser.ts
import { ParsedNode, ParseResult, ParserOptions } from './types';
import { getLanguageParser } from '../services/tree-sitter';
import { readFile as fsReadFile } from 'fs/promises';

export class Parser {
  private options: ParserOptions;

  constructor(options: ParserOptions = {}) {
    this.options = {
      includeComments: false,
      maxDepth: Infinity,
      granularity: 'medium',
      ...options
    };
  }

  async parseFile(filePath: string, language: string, content: string): Promise<ParseResult> {
    const languageParser = getLanguageParser(language || this.inferLanguageFromPath(filePath));
    if (!languageParser) {
      throw new Error(`Unsupported language: ${language}`);
    }
    
    return languageParser.parse(content, {
      ...this.options,
      filePath
    });
  }

  private inferLanguageFromPath(filePath: string): string {
    const extension = filePath.split('.').pop()?.toLowerCase();
    const extensionMap: Record<string, string> = {
      'ts': 'typescript',
      'tsx': 'typescript',
      'js': 'javascript',
      'jsx': 'javascript',
      'py': 'python',
      'java': 'java',
      'cs': 'csharp',
      'go': 'go',
      // 添加更多扩展名映射
    };
    
    return extensionMap[extension || ''] || 'unknown';

  }
}