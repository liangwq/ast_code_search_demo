import { LanguageParser } from './languageParser';
import { TypeScriptParser } from './TypeScriptParser';
import { JavaScriptParser } from './JavaScriptParser';
import { HTMLParser } from './HTMLParser';
import { CSSParser } from './CSSParser';
import { PythonParser } from './PythonParser';
//import { MarkdownParser } from './MarkdownParser';
//import { TextParser } from './TextParser';

const languageParsers: Record<string, LanguageParser> = {
  typescript: new TypeScriptParser(),
  javascript: new JavaScriptParser(),
  html: new HTMLParser(),
  css: new CSSParser(),
  python: new PythonParser(),
  //markdown: new MarkdownParser(),
  //txt: new TextParser(),
  //text: new TextParser()
};

export function getLanguageParser(language: string): LanguageParser | undefined {
  return languageParsers[language.toLowerCase()];
}