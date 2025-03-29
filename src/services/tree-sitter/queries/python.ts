export function getPythonQueries(granularity: 'fine' | 'medium' | 'coarse'): string[] {
  const queries: Record<string, string[]> = {
    coarse: [
      `(module) @module`,
      `(class_definition
        name: (identifier) @class.name) @class`,
      `(function_definition
        name: (identifier) @function.name) @function`
    ],
    
    medium: [
      `(module) @module`,
      `(class_definition
        name: (identifier) @class.name) @class`,
      `(function_definition
        name: (identifier) @function.name) @function`,
      `(if_statement) @if`,
      `(for_statement) @for`,
      `(while_statement) @while`,
      `(import_statement) @import`
    ],
    
    fine: [
      `(module) @module`,
      `(class_definition
        name: (identifier) @class.name) @class`,
      `(function_definition
        name: (identifier) @function.name) @function`,
      `(if_statement) @if`,
      `(for_statement) @for`,
      `(while_statement) @while`,
      `(import_statement) @import`,
      `(assignment
        left: (identifier) @assignment.name) @assignment`,
      `(call
        function: (identifier) @call.name) @call`,
      `(attribute
        object: (identifier) @attribute.object
        attribute: (identifier) @attribute.name) @attribute`,
      `(decorator) @decorator`,
      `(parameter
        name: (identifier) @parameter.name) @parameter`,
      `(return_statement) @return`,
      `(try_statement) @try`,
      `(raise_statement) @raise`
    ]
  };

  return queries[granularity] || [];
}