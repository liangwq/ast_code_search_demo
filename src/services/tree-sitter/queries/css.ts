export function getCSSQueries(granularity: 'fine' | 'medium' | 'coarse'): string[] {
  const queries: Record<string, string[]> = {
    fine: [`
      (rule_set
        (selectors
          (class_selector) @selector.class
          (id_selector) @selector.id)
        (block
          (declaration
            (property_name) @property.name
            (property_value) @property.value))) @rule

      (keyframe_block) @keyframe
      (comment) @comment
    `],
    medium: [`
      (rule_set
        (selectors) @selector
        (block)) @rule
      (keyframe_block) @keyframe
    `],
    coarse: [`
      (rule_set) @rule
      (keyframe_block) @keyframe
    `]
  };

  return queries[granularity] || queries.medium;
}