import * as Parser from 'tree-sitter';
import { LanguageParser } from './languageParser';
import { getMarkdownQueries } from './queries/markdown';
import { ParsedNode, ParseResult, ParserOptions } from '../../core/types';

export class MarkdownParser extends LanguageParser {
  constructor() {
    super('markdown');
  }

  protected initLanguage(): void {
    try {
      const Markdown = require('tree-sitter-markdown').markdown;  // 修改这里
      this.language = Markdown;  // 直接使用 Markdown 对象
      this.parser.setLanguage(Markdown);
    } catch (error) {
      console.error('Markdown 解析器初始化失败:', error);
      throw new Error('请确保已安装 tree-sitter-markdown 依赖');
    }
  }

  protected getLanguageSpecificNodeTypes(): Record<string, string[]> {
    return {
      coarse: ['document', 'section'],
      medium: [
        'document',
        'section',
        'heading',
        'paragraph',
        'list',
        'code_block'
      ],
      fine: [
        'document',
        'section',
        'heading',
        'paragraph',
        'list',
        'list_item',
        'code_block',
        'link',
        'image',
        'emphasis',
        'strong'
      ]
    };
  }

  getQueries(granularity: 'fine' | 'medium' | 'coarse'): string[] {
    return getMarkdownQueries(granularity);
  }
}