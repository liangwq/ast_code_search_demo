// src/services/tree-sitter/queries/typescript.ts  
export function getTypeScriptQueries(granularity: 'fine' | 'medium' | 'coarse'): string[] {  
    const queries: Record<string, string[]> = {  
      fine: [  
        `
        (import_declaration
          source: (string) @import.source
          clause: (named_imports
            (import_specifier
              name: (identifier) @import.name))) @import

        (import_declaration
          source: (string) @import.source
          clause: (namespace_import
            name: (identifier) @import.namespace)) @import

        (function_declaration 
          name: (identifier) @function.name) @function.declaration  

        (method_definition 
          name: (property_identifier) @method.name) @method.declaration  

        (class_declaration 
          name: (identifier) @class.name) @class.declaration  

        (interface_declaration 
          name: (identifier) @interface.name) @interface.declaration  

        (variable_declaration 
          (variable_declarator 
            name: (identifier) @variable.name)) @variable.declaration  

        (property_signature 
          name: (property_identifier) @property.name) @property.declaration  

        (export_statement) @export  
        (call_expression) @call  
        `,  
      ],  
      medium: [  
        // 中粒度: 主要的代码结构如函数、类、接口等  
        `  
        (function_declaration name: (identifier) @function.name) @function.declaration  
        (method_definition name: (property_identifier) @method.name) @method.declaration  
        (class_declaration name: (identifier) @class.name) @class.declaration  
        (interface_declaration name: (identifier) @interface.name) @interface.declaration  
        (variable_declaration) @variable.declaration  
        (import_declaration) @import  
        (export_statement) @export  
        `,  
      ],  
      coarse: [  
        // 粗粒度: 只关注主要结构如类和函数  
        `  
        (function_declaration name: (identifier) @function.name) @function.declaration  
        (class_declaration name: (identifier) @class.name) @class.declaration  
        (interface_declaration name: (identifier) @interface.name) @interface.declaration  
        `,  
      ],  
    };  
    
    return queries[granularity] || queries.medium;  
}