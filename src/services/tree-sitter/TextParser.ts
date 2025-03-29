import * as Parser from 'tree-sitter';
import { LanguageParser } from './languageParser';
import { ParsedNode, ParseResult, ParserOptions } from '../../core/types';

export class TextParser extends LanguageParser {
  constructor() {
    super('text');
  }

  protected initLanguage(): void {
    // For plain text, we don't need a language parser
    // Don't call setLanguage at all
  }

  parse(sourceCode: string, options: ParserOptions): ParseResult {
    // Simple text parsing implementation
    const nodes: Record<string, ParsedNode> = {};
    const rootNodes: string[] = [];
    
    // Create root node
    const rootId = 'node_0';
    nodes[rootId] = {
      type: 'document',
      name: 'text_document',
      range: {
        start: { row: 0, column: 0 },
        end: { 
          row: sourceCode.split('\n').length - 1,
          column: sourceCode.split('\n').slice(-1)[0].length
        }
      },
      children: [],
      metadata: {}
    };
    rootNodes.push(rootId);

    return {
      nodes,
      rootNodes,
      language: this.languageName,
      filePath: options.filePath || 'unknown'
    };
  }

  protected getLanguageSpecificNodeTypes(): Record<string, string[]> {
    return {
      coarse: ['document'],
      medium: ['document'],
      fine: ['document']
    };
  }

  getQueries(granularity: 'fine' | 'medium' | 'coarse'): string[] {
    return [];
  }
}