export function getHTMLQueries(granularity: 'fine' | 'medium' | 'coarse'): string[] {
  const queries: Record<string, string[]> = {
    fine: [`
      (element
        (start_tag
          (tag_name) @tag.name
          (attribute
            (attribute_name) @attribute.name
            (quoted_attribute_value
              (attribute_value) @attribute.value)?)?
          (attribute
            (attribute_name) @id.name
            (#eq? @id.name "id")
            (quoted_attribute_value
              (attribute_value) @id.value))?
          (attribute
            (attribute_name) @class.name
            (#eq? @class.name "class")
            (quoted_attribute_value
              (attribute_value) @class.value))?)) @element

      (script_element
        (start_tag
          (tag_name) @script.tag
          (attribute
            (attribute_name) @script.attr.name
            (quoted_attribute_value
              (attribute_value) @script.attr.value))?)) @script

      (style_element
        (start_tag
          (tag_name) @style.tag
          (attribute
            (attribute_name) @style.attr.name
            (quoted_attribute_value
              (attribute_value) @style.attr.value))?)) @style

      (text) @text
      (comment) @comment
    `],
    medium: [`
      (element
        (start_tag
          (tag_name) @tag.name
          (attribute
            (attribute_name) @id.name
            (#eq? @id.name "id")
            (quoted_attribute_value
              (attribute_value) @id.value))?
          (attribute
            (attribute_name) @class.name
            (#eq? @class.name "class")
            (quoted_attribute_value
              (attribute_value) @class.value))?)) @element
      (script_element) @script
      (style_element) @style
    `],
    coarse: [`
      (element) @element
      (script_element) @script
      (style_element) @style
    `]
  };

  return queries[granularity] || queries.medium;
}