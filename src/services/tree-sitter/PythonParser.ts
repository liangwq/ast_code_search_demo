import * as Parser from 'tree-sitter';
import { LanguageParser } from './languageParser';
import { getPythonQueries } from './queries/python';

export class PythonParser extends LanguageParser {
  constructor() {
    super('python');
  }

  protected initLanguage(): void {
    try {
      const Python = require('tree-sitter-python');
      // 检查是否是函数
      if (typeof Python === 'function') {
        this.language = Python();
      } else {
        this.language = Python;
      }
      
      if (!this.language) {
        throw new Error('Failed to initialize Python language');
      }
      
      this.parser.setLanguage(this.language);
    } catch (error) {
      console.error('Error initializing Python parser:', error);
      throw new Error('Failed to initialize Python parser. Make sure tree-sitter-python is properly installed.');
    }
  }

  protected getLanguageSpecificNodeTypes(): Record<string, string[]> {
    return {
      coarse: [
        'module',
        'class_definition',
        'function_definition'
      ],
      medium: [
        'module',
        'class_definition',
        'function_definition',
        'if_statement',
        'for_statement',
        'while_statement',
        'import_statement'
      ],
      fine: [
        'module',
        'class_definition',
        'function_definition',
        'if_statement',
        'for_statement',
        'while_statement',
        'import_statement',
        'assignment',
        'call',
        'attribute',
        'decorator'
      ]
    };
  }

  getQueries(granularity: 'fine' | 'medium' | 'coarse'): string[] {
    return getPythonQueries(granularity);
  }
}