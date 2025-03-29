export function getMarkdownQueries(granularity: 'fine' | 'medium' | 'coarse'): string[] {
  const queries: Record<string, string[]> = {
    coarse: [
      `(document) @document`,
      `(section) @section`
    ],
    medium: [
      `(document) @document`,
      `(section) @section`,
      `(heading) @heading`,
      `(paragraph) @paragraph`,
      `(list) @list`,
      `(code_block) @code_block`
    ],
    fine: [
      `(document) @document`,
      `(section) @section`,
      `(heading (heading_content) @heading)`,
      `(paragraph) @paragraph`,
      `(list) @list`,
      `(list_item) @list_item`,
      `(code_block) @code_block`,
      `(link) @link`,
      `(image) @image`,
      `(emphasis) @emphasis`,
      `(strong) @strong`,
      `(inline_code) @inline_code`,
      `(blockquote) @blockquote`,
      `(table) @table`,
      `(table_row) @table_row`,
      `(table_cell) @table_cell`
    ]
  };

  return queries[granularity] || [];
}