import * as Parser from 'tree-sitter';
import { LanguageParser } from './languageParser';
import { getTypeScriptQueries } from './queries/typescript';

export class TypeScriptParser extends LanguageParser {
  constructor() {
    super('typescript');
  }

  protected initLanguage(): void {
    const TypeScript = require('tree-sitter-typescript').typescript;
    this.language = TypeScript;
    this.parser.setLanguage(TypeScript);
  }

  protected getLanguageSpecificNodeTypes(): Record<string, string[]> {
    return {
      coarse: [
        'class_declaration',
        'interface_declaration',
        'module_declaration'
      ],
      medium: [
        'class_declaration',
        'interface_declaration',
        'module_declaration',
        'function_declaration',
        'method_definition',
        'import_declaration',
        'export_statement'
      ],
      fine: [
        'class_declaration',
        'interface_declaration',
        'module_declaration',
        'function_declaration',
        'method_definition',
        'import_declaration',
        'export_statement',
        'variable_declaration',
        'property_signature',
        'call_expression',
        'type_alias_declaration',
        'enum_declaration'
      ]
    };
  }

  getQueries(granularity: 'fine' | 'medium' | 'coarse'): string[] {
    return getTypeScriptQueries(granularity);
  }
}