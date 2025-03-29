import * as Parser from 'tree-sitter';
import { LanguageParser } from './languageParser';
import { getJavaScriptQueries } from './queries/javascript';

export class JavaScriptParser extends LanguageParser {
  constructor() {
    super('javascript');
  }

  protected initLanguage(): void {
    const JavaScript = require('tree-sitter-javascript');
    this.language = JavaScript;
    this.parser.setLanguage(JavaScript);
  }

  protected getLanguageSpecificNodeTypes(): Record<string, string[]> {
    return {
      coarse: [
        'class_declaration',
        'module'
      ],
      medium: [
        'class_declaration',
        'module',
        'function_declaration',
        'method_definition',
        'import_declaration',
        'export_statement'
      ],
      fine: [
        'class_declaration',
        'module',
        'function_declaration',
        'method_definition',
        'import_declaration',
        'export_statement',
        'variable_declaration',
        'property_definition',
        'call_expression'
      ]
    };
  }

  getQueries(granularity: 'fine' | 'medium' | 'coarse'): string[] {
    return getJavaScriptQueries(granularity);
  }
}