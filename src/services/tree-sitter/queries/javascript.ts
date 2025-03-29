// src/services/tree-sitter/queries/javascript.ts  
export function getJavaScriptQueries(granularity: 'fine' | 'medium' | 'coarse'): string[] {  
    // 定义不同粒度的查询  
    const queries: Record<string, string[]> = {  
      fine: [  
        // 细粒度: 包括变量声明、表达式等所有细节  
        `  
        (function_declaration name: (identifier) @function.name) @function.declaration  
        (method_definition name: (property_identifier) @method.name) @method.declaration  
        (class_declaration name: (identifier) @class.name) @class.declaration  
        (variable_declaration (variable_declarator name: (identifier) @variable.name)) @variable.declaration  
        (property_identifier) @property.name  
        (import_declaration) @import  
        (export_statement) @export  
        (call_expression) @call  
        (object) @object  
        (array) @array  
        `,  
      ],  
      medium: [  
        // 中粒度: 主要的代码结构如函数、类等  
        `  
        (function_declaration name: (identifier) @function.name) @function.declaration  
        (method_definition name: (property_identifier) @method.name) @method.declaration  
        (class_declaration name: (identifier) @class.name) @class.declaration  
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
        `,  
      ],  
    };  
    
    return queries[granularity] || queries.medium;  
  }