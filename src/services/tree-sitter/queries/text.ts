export function getTextQueries(granularity: 'fine' | 'medium' | 'coarse'): string[] {
  const queries: Record<string, string[]> = {
    coarse: [
      `(text) @text`
    ],
    
    medium: [
      `(text) @text`,
      `(line) @line`
    ],
    
    fine: [
      `(text) @text`,
      `(line) @line`,
      `(word) @word`,
      `(punctuation) @punctuation`,
      `(whitespace) @whitespace`,
      `(newline) @newline`
    ]
  };

  // 由于纯文本解析器不使用 tree-sitter 的查询功能
  // 这里返回空数组，实际的文本处理在 TextParser 的 parse 方法中完成
  return [];
}