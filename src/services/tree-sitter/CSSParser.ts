import * as Parser from 'tree-sitter';
import { LanguageParser } from './languageParser';
import { getCSSQueries } from './queries/css';

export class CSSParser extends LanguageParser {
  constructor() {
    super('css');
  }

  protected initLanguage(): void {
    const CSS = require('tree-sitter-css');
    this.language = CSS;
    this.parser.setLanguage(CSS);
  }

  protected getLanguageSpecificNodeTypes(): Record<string, string[]> {
    return {
      coarse: [
        'stylesheet',
        'rule_set',
        'keyframe_block'
      ],
      medium: [
        'stylesheet',
        'rule_set',
        'keyframe_block',
        'declaration',
        'selector',
        'class_selector',
        'id_selector'
      ],
      fine: [
        'stylesheet',
        'rule_set',
        'keyframe_block',
        'declaration',
        'selector',
        'class_selector',
        'id_selector',
        'property_name',
        'property_value',
        'comment'
      ]
    };
  }

  getQueries(granularity: 'fine' | 'medium' | 'coarse'): string[] {
    return getCSSQueries(granularity);
  }
}