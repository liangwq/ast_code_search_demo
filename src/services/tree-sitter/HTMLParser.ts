import * as Parser from 'tree-sitter';
import { LanguageParser } from './languageParser';
import { getHTMLQueries } from './queries/html';

export class HTMLParser extends LanguageParser {
  constructor() {
    super('html');
  }

  protected initLanguage(): void {
    try {
      const HTML = require('tree-sitter-html');
      this.language = HTML;
      this.parser.setLanguage(this.language);
    } catch (error) {
      console.error('Error initializing HTML parser:', error);
      throw new Error('Failed to initialize HTML parser. Make sure tree-sitter-html is properly installed.');
    }
  }

  protected getLanguageSpecificNodeTypes(): Record<string, string[]> {
    return {
      coarse: [
        'element',
        'script_element',
        'style_element'
      ],
      medium: [
        'element',
        'script_element',
        'style_element',
        'attribute',
        'text'
      ],
      fine: [
        'element',
        'script_element',
        'style_element',
        'attribute',
        'text',
        'comment',
        'doctype'
      ]
    };
  }

  getQueries(granularity: 'fine' | 'medium' | 'coarse'): string[] {
    return getHTMLQueries(granularity);
  }
}