import { ParseResult, ParsedNode } from './types';
import * as path from 'path';

export interface Relationship {
  type: 'inheritance' | 'dependency' | 'call' | 'style';
  from: string;
  to: string;
  metadata?: {
    kind?: string;
    path?: string;
    sourceCode?: string;
    projectName?: string;  // 添加项目名称
    fileName?: string;     // 添加文件名
    position?: {
      line: number;
      column: number;
    };
  };
}

export class RelationshipAnalyzer {
  analyze(parseResults: ParseResult[]): Relationship[] {
    const relationships: Relationship[] = [];
    
    // 创建节点映射，用于跨文件查找关系
    const nodeMap = this.buildNodeMap(parseResults);
    
    parseResults.forEach(result => {
      // 原有分析
      relationships.push(...this.analyzeInheritance(result));
      relationships.push(...this.analyzeMethodCalls(result));
      relationships.push(...this.analyzeStyleDependencies(result));
      relationships.push(...this.analyzeModuleDependencies(result));
      
      // 新增分析
      relationships.push(...this.analyzeClassNameRelationships(result, nodeMap));
      relationships.push(...this.analyzeFunctionNameRelationships(result, nodeMap));
      relationships.push(...this.analyzeComponentStyleRelationships(result, nodeMap));
      relationships.push(...this.analyzeSimilarNameRelationships(result, nodeMap));
      
      // 添加接口依赖分析
      relationships.push(...this.analyzeInterfaceDependencies(result, nodeMap));
      
      // 添加参数类型依赖分析
      relationships.push(...this.analyzeParameterTypeDependencies(result, nodeMap));
    });
    
    // 添加日志，检查生成的关系是否包含源代码
    console.log(`生成关系总数: ${relationships.length}`);
    const withSourceCode = relationships.filter(r => r.metadata?.sourceCode);
    console.log(`包含源代码的关系数: ${withSourceCode.length}`);
    
    return relationships;
  }

  // 构建节点映射，用于跨文件查找关系
  private buildNodeMap(parseResults: ParseResult[]): Map<string, {node: ParsedNode, result: ParseResult}> {
    const nodeMap = new Map<string, {node: ParsedNode, result: ParseResult}>();
    
    parseResults.forEach(result => {
      Object.entries(result.nodes).forEach(([nodeId, node]) => {
        // 使用节点名称作为键
        if (node.name && node.name.trim() !== '') {
          nodeMap.set(node.name, {node, result});
        }
        
        // 对于类和函数，也可以使用类型+名称作为键
        if (node.type && node.name) {
          nodeMap.set(`${node.type}:${node.name}`, {node, result});
        }
      });
    });
    
    return nodeMap;
  }

  private findExtendsClause(node: ParsedNode, allNodes: Record<string, ParsedNode>): string | null {
    // 查找类的继承声明
    const extendsNode = node.children?.find(childId => {
      const child = allNodes[childId];
      return child.type === 'extends_clause' || child.type === 'heritage_clause';
    });

    if (extendsNode) {
      return allNodes[extendsNode].children?.[0] || null;
    }
    return null;
  }

  private findMethodCalls(node: ParsedNode, allNodes: Record<string, ParsedNode>): string[] {
    const calls: string[] = [];
    
    const searchCalls = (nodeId: string) => {
      const currentNode = allNodes[nodeId];
      if (!currentNode) return;

      if (currentNode.type === 'call_expression') {
        calls.push(nodeId);
      }

      currentNode.children?.forEach(childId => searchCalls(childId));
    };

    node.children?.forEach(childId => searchCalls(childId));
    return calls;
  }

  private findStyleSelectors(node: ParsedNode, allNodes: Record<string, ParsedNode>): string[] {
    const selectors: string[] = [];
    
    node.children?.forEach(childId => {
      const child = allNodes[childId];
      if (child.type === 'selector' || child.type === 'class_selector' || child.type === 'id_selector') {
        selectors.push(childId);
      }
    });

    return selectors;
  }

  private analyzeModuleDependencies(result: ParseResult): Relationship[] {
    const relationships: Relationship[] = [];
    
    Object.entries(result.nodes).forEach(([nodeId, node]) => {
      // 检查更多类型的导入语句
      if (
        node.type === 'import_declaration' || 
        node.type === 'import_statement' ||
        node.type === 'import_directive' ||
        node.type === 'import_specifier' ||
        node.type === 'require_call'
      ) {
        console.log('找到导入节点:', node);
        
        // 查找导入路径
        const importPath = this.findImportPath(node, result.nodes);
        if (importPath) {
          console.log('导入路径:', importPath);
          
          relationships.push({
            type: 'dependency',
            from: nodeId,
            to: importPath,
            metadata: {
              kind: 'import',
              path: result.filePath,
              sourceCode: node.metadata?.nodeText
            }
          });
        }
      }
      
      // 检查 require 调用
      if (node.type === 'call_expression' && node.name === 'require') {
        console.log('找到require调用:', node);
        
        // 查找第一个参数作为导入路径
        const args = node.children?.filter(childId => {
          const child = result.nodes[childId];
          return child.type === 'arguments' || child.type === 'string_literal';
        });
        
        if (args && args.length > 0) {
          const importPath = args[0];
          console.log('require路径:', importPath);
          
          relationships.push({
            type: 'dependency',
            from: nodeId,
            to: importPath,
            metadata: {
              kind: 'require',
              path: result.filePath,
              sourceCode: node.metadata?.nodeText
            }
          });
        }
      }
    });
    
    return relationships;
  }

  private findImportPath(node: ParsedNode, allNodes: Record<string, ParsedNode>): string | null {
    // 查找字符串字面量作为导入路径
    const importNode = node.children?.find(childId => {
      const child = allNodes[childId];
      return (
        child.type === 'string' || 
        child.type === 'string_literal' ||
        child.type === 'raw_string_literal' ||
        child.type.includes('string')
      );
    });
  
    // 如果找到了字符串字面量，返回其ID
    if (importNode) {
      console.log('找到导入路径节点:', allNodes[importNode]);
      return importNode;
    }
    
    // 如果没有直接找到字符串，递归查找子节点
    for (const childId of node.children || []) {
      const child = allNodes[childId];
      const result = this.findImportPath(child, allNodes);
      if (result) return result;
    }
  
    return null;
  }

  private analyzeInheritance(result: ParseResult): Relationship[] {
    const relationships: Relationship[] = [];
    
    Object.entries(result.nodes).forEach(([nodeId, node]) => {
      if (node.type === 'class.declaration') {
        const extendsClause = this.findExtendsClause(node, result.nodes);
        if (extendsClause) {
          const parentClassId = Object.entries(result.nodes).find(
            ([id, n]) => n.type === 'class.declaration' && n.name === extendsClause
          )?.[0];
          
          if (parentClassId) {
            // 提取源代码
            const sourceCode = node.metadata?.nodeText || '';
            
            relationships.push({
              type: 'inheritance',
              from: nodeId,
              to: parentClassId,
              metadata: {
                kind: 'extends',
                path: result.filePath,
                sourceCode: sourceCode, // 设置源代码
                projectName: result.projectPath ? path.basename(result.projectPath) : '',
                fileName: result.filePath ? path.basename(result.filePath) : '',
                position: {
                  line: node.range?.start?.row || 0,
                  column: node.range?.start?.column || 0
                }
              }
            });
          }
        }
      }
    });
    
    return relationships;
  }

  private analyzeMethodCalls(result: ParseResult): Relationship[] {
    const relationships: Relationship[] = [];
    
    Object.entries(result.nodes).forEach(([nodeId, node]) => {
      if (node.type === 'function_declaration' || node.type === 'method_definition') {
        const calls = this.findMethodCalls(node, result.nodes);
        calls.forEach(call => {
          relationships.push({
            type: 'call',
            from: nodeId,  // 使用 nodeId 而不是 node.id
            to: call,
            metadata: {
              kind: 'method_call',
              path: result.filePath
            }
          });
        });
      }
    });
    
    return relationships;
  }

  private analyzeStyleDependencies(result: ParseResult): Relationship[] {
    const relationships: Relationship[] = [];
    
    if (result.language === 'css' || result.language === 'scss') {
      Object.entries(result.nodes).forEach(([nodeId, node]) => {
        if (node.type === 'rule_set') {
          const selectors = this.findStyleSelectors(node, result.nodes);
          selectors.forEach(selector => {
            // 获取CSS规则的源代码
            const sourceCode = node.metadata?.nodeText || '';
            
            relationships.push({
              type: 'style',
              from: nodeId,
              to: selector,
              metadata: {
                kind: 'style_dependency',
                path: result.filePath,
                sourceCode: sourceCode, // 添加源代码
                projectName: result.projectPath ? path.basename(result.projectPath) : '',
                fileName: result.filePath ? path.basename(result.filePath) : '',
                position: {
                  line: node.range?.start?.row || 0,
                  column: node.range?.start?.column || 0
                }
              }
            });
          });
        }
      });
    }
    
    return relationships;
  }

  // 新增方法：分析基于类名的关系
  private analyzeClassNameRelationships(result: ParseResult, nodeMap: Map<string, {node: ParsedNode, result: ParseResult}>): Relationship[] {
    const relationships: Relationship[] = [];
    
    Object.entries(result.nodes).forEach(([nodeId, node]) => {
      // 查找类声明
      if (node.type === 'class_declaration' || node.type === 'class.declaration') {
        // 查找类中的属性和方法
        node.children?.forEach(childId => {
          const childNode = result.nodes[childId];
          
          // 查找属性类型引用
          if (childNode.type === 'property_declaration' || childNode.type === 'field_declaration') {
            // 提取属性类型
            const typeName = this.extractTypeFromProperty(childNode, result.nodes);
            if (typeName) {
              // 查找对应的类
              const targetClass = nodeMap.get(typeName);
              if (targetClass) {
                const targetNodeId = Object.entries(targetClass.result.nodes)
                  .find(([id, n]) => n === targetClass.node)?.[0];
                
                if (targetNodeId) {
                  relationships.push({
                    type: 'dependency',
                    from: nodeId,
                    to: targetNodeId,
                    metadata: {
                      kind: 'class_property_type',
                      path: result.filePath,
                      sourceCode: childNode.metadata?.nodeText || '',
                      projectName: result.projectPath ? path.basename(result.projectPath) : '',
                      fileName: result.filePath ? path.basename(result.filePath) : '',
                      position: {
                        line: childNode.range?.start?.row || 0,
                        column: childNode.range?.start?.column || 0
                      }
                    }
                  });
                }
              }
            }
          }
        });
      }
    });
    
    return relationships;
  }

  // 提取属性类型
  private extractTypeFromProperty(node: ParsedNode, allNodes: Record<string, ParsedNode>): string | null {
    // 查找类型注解
    const typeNode = node.children?.find(childId => {
      const child = allNodes[childId];
      return child.type === 'type_annotation' || child.type.includes('type');
    });
    
    if (typeNode) {
      const typeIdentifier = allNodes[typeNode].children?.find(childId => {
        const child = allNodes[childId];
        return child.type === 'type_identifier' || child.type === 'identifier';
      });
      
      if (typeIdentifier) {
        return allNodes[typeIdentifier].name;
      }
    }
    
    return null;
  }

  // 新增方法：分析基于函数名的关系
  private analyzeFunctionNameRelationships(result: ParseResult, nodeMap: Map<string, {node: ParsedNode, result: ParseResult}>): Relationship[] {
    const relationships: Relationship[] = [];
    
    Object.entries(result.nodes).forEach(([nodeId, node]) => {
      // 查找函数声明和方法定义
      if (node.type === 'function_declaration' || node.type === 'method_definition') {
        // 查找函数体中的标识符
        this.findIdentifiersInFunction(node, result.nodes).forEach(identifierName => {
          // 查找对应的函数或方法
          const targetFunc = nodeMap.get(identifierName);
          if (targetFunc && targetFunc.node.type.includes('function')) {
            const targetNodeId = Object.entries(targetFunc.result.nodes)
              .find(([id, n]) => n === targetFunc.node)?.[0];
            
            if (targetNodeId && targetNodeId !== nodeId) { // 避免自引用
              relationships.push({
                type: 'call',
                from: nodeId,
                to: targetNodeId,
                metadata: {
                  kind: 'function_name_reference',
                  path: result.filePath,
                  sourceCode: node.metadata?.nodeText || '',
                  projectName: result.projectPath ? path.basename(result.projectPath) : '',
                  fileName: result.filePath ? path.basename(result.filePath) : '',
                  position: {
                    line: node.range?.start?.row || 0,
                    column: node.range?.start?.column || 0
                  }
                }
              });
            }
          }
        });
      }
    });
    
    return relationships;
  }

  // 查找函数体中的标识符
  private findIdentifiersInFunction(node: ParsedNode, allNodes: Record<string, ParsedNode>): string[] {
    const identifiers: string[] = [];
    
    const searchIdentifiers = (nodeId: string) => {
      const currentNode = allNodes[nodeId];
      if (!currentNode) return;
      
      if (currentNode.type === 'identifier' && currentNode.name) {
        identifiers.push(currentNode.name);
      }
      
      currentNode.children?.forEach(childId => searchIdentifiers(childId));
    };
    
    node.children?.forEach(childId => searchIdentifiers(childId));
    return [...new Set(identifiers)]; // 去重
  }

  // 新增方法：分析组件和样式之间的关系
  private analyzeComponentStyleRelationships(result: ParseResult, nodeMap: Map<string, {node: ParsedNode, result: ParseResult}>): Relationship[] {
    const relationships: Relationship[] = [];
    
    // 只处理 JavaScript/TypeScript 文件
    if (!['javascript', 'typescript', 'jsx', 'tsx'].includes(result.language)) {
      return relationships;
    }
    
    Object.entries(result.nodes).forEach(([nodeId, node]) => {
      // 查找组件定义（类组件或函数组件）
      if (
        (node.type === 'class_declaration' && node.name.endsWith('Component')) ||
        (node.type === 'function_declaration' && (
          node.name.startsWith('use') || // Hook
          node.name[0] === node.name[0].toUpperCase() // 组件名首字母大写
        ))
      ) {
        // 查找组件中的类名引用
        const classNames = this.findClassNamesInComponent(node, result.nodes);
        
        classNames.forEach(className => {
          // 在 CSS 文件中查找对应的选择器
          // 修复：使用 nodeMap 中的所有 CSS 结果，而不是未定义的 parseResults
          Array.from(nodeMap.values())
            .filter(item => ['css', 'scss', 'less'].includes(item.result.language))
            .forEach(cssItem => {
              const cssResult = cssItem.result;
              Object.entries(cssResult.nodes).forEach(([cssNodeId, cssNode]) => {
                if (
                  (cssNode.type === 'class_selector' && cssNode.name === `.${className}`) ||
                  (cssNode.type === 'selector' && cssNode.name?.includes(`.${className}`))
                ) {
                  relationships.push({
                    type: 'style',
                    from: nodeId,
                    to: cssNodeId,
                    metadata: {
                      kind: 'component_style',
                      path: result.filePath,
                      sourceCode: node.metadata?.nodeText || '',
                      projectName: result.projectPath ? path.basename(result.projectPath) : '',
                      fileName: result.filePath ? path.basename(result.filePath) : '',
                      position: {
                        line: node.range?.start?.row || 0,
                        column: node.range?.start?.column || 0
                      }
                    }
                  });
                }
              });
            });
        });
      }
    });
    
    return relationships;
  }

  // 查找组件中的类名引用
  private findClassNamesInComponent(node: ParsedNode, allNodes: Record<string, ParsedNode>): string[] {
    const classNames: string[] = [];
    
    const searchClassNames = (nodeId: string) => {
      const currentNode = allNodes[nodeId];
      if (!currentNode) return;
      
      // 查找 className="xxx" 属性
      if (currentNode.type === 'jsx_attribute' && currentNode.name === 'className') {
        currentNode.children?.forEach(childId => {
          const child = allNodes[childId];
          if (child.type === 'string_literal' || child.type === 'string') {
            // 提取类名
            const value = child.name.replace(/['"]/g, '');
            value.split(/\s+/).forEach(cls => {
              if (cls) classNames.push(cls);
            });
          }
        });
      }
      
      currentNode.children?.forEach(childId => searchClassNames(childId));
    };
    
    node.children?.forEach(childId => searchClassNames(childId));
    return [...new Set(classNames)]; // 去重
  }

  // 新增方法：分析相似名称之间的关系
  private analyzeSimilarNameRelationships(result: ParseResult, nodeMap: Map<string, {node: ParsedNode, result: ParseResult}>): Relationship[] {
    const relationships: Relationship[] = [];
    
    Object.entries(result.nodes).forEach(([nodeId, node]) => {
      // 只处理有名称的节点
      if (!node.name || node.name.trim() === '') return;
      
      // 查找名称相似的节点
      nodeMap.forEach((target, targetName) => {
        // 跳过自己
        if (target.node === node) return;
        
        // 检查名称相似性
        if (this.areNamesSimilar(node.name, targetName)) {
          const targetNodeId = Object.entries(target.result.nodes)
            .find(([id, n]) => n === target.node)?.[0];
          
          if (targetNodeId) {
            relationships.push({
              type: 'dependency',
              from: nodeId,
              to: targetNodeId,
              metadata: {
                kind: 'similar_name',
                path: result.filePath,
                sourceCode: node.metadata?.nodeText || '',
                projectName: result.projectPath ? path.basename(result.projectPath) : '',
                fileName: result.filePath ? path.basename(result.filePath) : '',
                position: {
                  line: node.range?.start?.row || 0,
                  column: node.range?.start?.column || 0
                }
              }
            });
          }
        }
      });
    });
    
    return relationships;
  }

  // 检查两个名称是否相似
  private areNamesSimilar(name1: string, name2: string): boolean {
    // 如果包含冒号，提取冒号后的部分
    if (name2.includes(':')) {
      name2 = name2.split(':')[1];
    }
    
    // 移除常见前缀和后缀
    const cleanName1 = this.removeCommonPrefixSuffix(name1);
    const cleanName2 = this.removeCommonPrefixSuffix(name2);
    
    // 如果清理后的名称相同，则认为相似
    if (cleanName1 === cleanName2) return true;
    
    // 如果一个名称包含另一个，则认为相似
    if (cleanName1.includes(cleanName2) || cleanName2.includes(cleanName1)) return true;
    
    // 计算编辑距离，如果小于名称长度的1/3，则认为相似
    const distance = this.levenshteinDistance(cleanName1, cleanName2);
    const maxLength = Math.max(cleanName1.length, cleanName2.length);
    
    return distance < maxLength / 3;
  }

  // 移除常见前缀和后缀
  private removeCommonPrefixSuffix(name: string): string {
    // 移除常见前缀
    const prefixes = ['get', 'set', 'is', 'has', 'on', 'handle'];
    let result = name;
    
    for (const prefix of prefixes) {
      if (name.startsWith(prefix) && name.length > prefix.length) {
        // 确保前缀后面是大写字母
        const nextChar = name.charAt(prefix.length);
        if (nextChar === nextChar.toUpperCase()) {
          result = name.substring(prefix.length);
          // 首字母小写
          result = result.charAt(0).toLowerCase() + result.substring(1);
          break;
        }
      }
    }
    
    // 移除常见后缀
    const suffixes = ['Component', 'Container', 'View', 'Page', 'Screen', 'Handler', 'Util', 'Helper'];
    for (const suffix of suffixes) {
      if (result.endsWith(suffix)) {
        result = result.substring(0, result.length - suffix.length);
        break;
      }
    }
    
    return result;
  }

  // 计算编辑距离
  private levenshteinDistance(s1: string, s2: string): number {
    const m = s1.length;
    const n = s2.length;
    
    // 创建距离矩阵
    const d: number[][] = Array(m + 1).fill(0).map(() => Array(n + 1).fill(0));
    
    // 初始化第一行和第一列
    for (let i = 0; i <= m; i++) d[i][0] = i;
    for (let j = 0; j <= n; j++) d[0][j] = j;
    
    // 填充矩阵
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
        d[i][j] = Math.min(
          d[i - 1][j] + 1,      // 删除
          d[i][j - 1] + 1,      // 插入
          d[i - 1][j - 1] + cost // 替换
        );
      }
    }
    
    return d[m][n];
  }

  // 新增方法：分析接口依赖关系
  private analyzeInterfaceDependencies(result: ParseResult, nodeMap: Map<string, {node: ParsedNode, result: ParseResult}>): Relationship[] {
    const relationships: Relationship[] = [];
    
    Object.entries(result.nodes).forEach(([nodeId, node]) => {
      // 查找接口声明
      if (node.type === 'interface_declaration') {
        // 查找接口中的方法和属性
        node.children?.forEach(childId => {
          const childNode = result.nodes[childId];
          
          // 查找方法签名
          if (childNode.type === 'method_signature' || 
              childNode.type === 'method_definition' || 
              childNode.type.includes('method')) {
            // 提取方法返回类型
            const returnType = this.extractReturnType(childNode, result.nodes);
            if (returnType) {
              // 查找对应的类型
              const targetType = nodeMap.get(returnType);
              if (targetType) {
                const targetNodeId = Object.entries(targetType.result.nodes)
                  .find(([id, n]) => n === targetType.node)?.[0];
                
                if (targetNodeId) {
                  relationships.push({
                    type: 'dependency',
                    from: nodeId,
                    to: targetNodeId,
                    metadata: {
                      kind: 'interface_method_return_type',
                      path: result.filePath,
                      sourceCode: childNode.metadata?.nodeText || '',
                      projectName: result.projectPath ? path.basename(result.projectPath) : '',
                      fileName: result.filePath ? path.basename(result.filePath) : '',
                      position: {
                        line: childNode.range?.start?.row || 0,
                        column: childNode.range?.start?.column || 0
                      }
                    }
                  });
                }
              }
              
              // 提取方法参数类型
              this.extractParameterTypes(childNode, result.nodes).forEach(paramType => {
                const targetType = nodeMap.get(paramType);
                if (targetType) {
                  const targetNodeId = Object.entries(targetType.result.nodes)
                    .find(([id, n]) => n === targetType.node)?.[0];
                  
                  if (targetNodeId) {
                    relationships.push({
                      type: 'dependency',
                      from: nodeId,
                      to: targetNodeId,
                      metadata: {
                        kind: 'interface_method_parameter_type',
                        path: result.filePath,
                        sourceCode: childNode.metadata?.nodeText || '',
                        projectName: result.projectPath ? path.basename(result.projectPath) : '',
                        fileName: result.filePath ? path.basename(result.filePath) : '',
                        position: {
                          line: childNode.range?.start?.row || 0,
                          column: childNode.range?.start?.column || 0
                        }
                      }
                    });
                  }
                }
              });
            }
          }
          
          // 查找属性签名
          if (childNode.type === 'property_signature') {
            // 提取属性类型
            const propType = this.extractTypeFromProperty(childNode, result.nodes);
            if (propType) {
              // 查找对应的类型
              const targetType = nodeMap.get(propType);
              if (targetType) {
                const targetNodeId = Object.entries(targetType.result.nodes)
                  .find(([id, n]) => n === targetType.node)?.[0];
                
                if (targetNodeId) {
                  relationships.push({
                    type: 'dependency',
                    from: nodeId,
                    to: targetNodeId,
                    metadata: {
                      kind: 'interface_property_type',
                      path: result.filePath,
                      sourceCode: childNode.metadata?.nodeText || '',
                      projectName: result.projectPath ? path.basename(result.projectPath) : '',
                      fileName: result.filePath ? path.basename(result.filePath) : '',
                      position: {
                        line: childNode.range?.start?.row || 0,
                        column: childNode.range?.start?.column || 0
                      }
                    }
                  });
                }
              }
            }
          }
        });
        
        // 查找接口继承
        const extendsClause = this.findExtendsClause(node, result.nodes);
        if (extendsClause) {
          const extendedInterface = result.nodes[extendsClause];
          if (extendedInterface && extendedInterface.name) {
            // 查找被继承的接口
            const targetInterface = nodeMap.get(extendedInterface.name);
            if (targetInterface) {
              const targetNodeId = Object.entries(targetInterface.result.nodes)
                .find(([id, n]) => n === targetInterface.node)?.[0];
              
              if (targetNodeId) {
                relationships.push({
                  type: 'inheritance',
                  from: nodeId,
                  to: targetNodeId,
                  metadata: {
                    kind: 'interface_extends',
                    path: result.filePath,
                    sourceCode: node.metadata?.nodeText || '',
                    projectName: result.projectPath ? path.basename(result.projectPath) : '',
                    fileName: result.filePath ? path.basename(result.filePath) : '',
                    position: {
                      line: node.range?.start?.row || 0,
                      column: node.range?.start?.column || 0
                    }
                  }
                });
              }
            }
          }
        }
      }
    });
    
    return relationships;
  }
  
  // 提取方法返回类型
  private extractReturnType(node: ParsedNode, allNodes: Record<string, ParsedNode>): string | null {
  // 查找返回类型注解
  const returnType = node.children?.find(childId => {
    const child = allNodes[childId];
    return child.type === 'type_annotation' || child.type === 'return_type';
  });
  
  if (returnType) {
    const typeNode = allNodes[returnType].children?.[0];
    if (typeNode) {
      const typeIdentifier = allNodes[typeNode].type === 'type_identifier' ? 
        typeNode : // 修改这里：直接使用 typeNode 作为 ID
        allNodes[typeNode].children?.find(childId => {
          const child = allNodes[childId];
          return child.type === 'type_identifier' || child.type === 'identifier';
        });
      
      if (typeIdentifier) {
        // 修改这里：确保使用字符串 ID 访问 allNodes
        return allNodes[typeIdentifier].name;
      }
    }
  }
  
  return null;
  }
  
  // 提取方法参数类型
  private extractParameterTypes(node: ParsedNode, allNodes: Record<string, ParsedNode>): string[] {
    const types: string[] = [];
    
    // 查找参数列表
    const paramList = node.children?.find(childId => {
      const child = allNodes[childId];
      return child.type === 'formal_parameters' || child.type === 'parameter_list';
    });
    
    if (paramList) {
      // 遍历参数
      allNodes[paramList].children?.forEach(paramId => {
        const param = allNodes[paramId];
        if (param.type === 'required_parameter' || param.type === 'parameter') {
          // 查找参数类型注解
          const typeAnnotation = param.children?.find(childId => {
            const child = allNodes[childId];
            return child.type === 'type_annotation';
          });
          
          if (typeAnnotation) {
            const typeNodeId = allNodes[typeAnnotation].children?.[0];
            if (typeNodeId) {
              const typeNode = allNodes[typeNodeId];
              
              if (typeNode.type === 'type_identifier') {
                types.push(typeNode.name);
              } else {
                // 查找子节点中的类型标识符
                const typeIdentifierId = typeNode.children?.find(childId => {
                  const child = allNodes[childId];
                  return child.type === 'type_identifier' || child.type === 'identifier';
                });
                
                if (typeIdentifierId) {
                  // 修复：确保使用字符串ID访问allNodes
                  types.push(allNodes[typeIdentifierId].name);
                }
              }
            }
          }
        }
      });
    }
    
    return types;
  }
  
  // 新增方法：分析参数类型依赖关系
  private analyzeParameterTypeDependencies(result: ParseResult, nodeMap: Map<string, {node: ParsedNode, result: ParseResult}>): Relationship[] {
    const relationships: Relationship[] = [];
    
    Object.entries(result.nodes).forEach(([nodeId, node]) => {
      // 查找函数声明和方法定义
      if (node.type === 'function_declaration' || 
          node.type === 'method_definition' || 
          node.type === 'arrow_function') {
        
        // 提取参数类型
        const paramTypes = this.extractParameterTypes(node, result.nodes);
        
        // 为每个参数类型创建依赖关系
        paramTypes.forEach(paramType => {
          // 查找对应的类型定义
          const targetType = nodeMap.get(paramType);
          if (targetType) {
            const targetNodeId = Object.entries(targetType.result.nodes)
              .find(([id, n]) => n === targetType.node)?.[0];
            
            if (targetNodeId) {
              relationships.push({
                type: 'dependency',
                from: nodeId,
                to: targetNodeId,
                metadata: {
                  kind: 'parameter_type',
                  path: result.filePath,
                  sourceCode: node.metadata?.nodeText || '',
                  projectName: result.projectPath ? path.basename(result.projectPath) : '',
                  fileName: result.filePath ? path.basename(result.filePath) : '',
                  position: {
                    line: node.range?.start?.row || 0,
                    column: node.range?.start?.column || 0
                  }
                }
              });
            }
          }
        });
        
        // 提取返回类型
        const returnType = this.extractReturnType(node, result.nodes);
        if (returnType) {
          // 查找对应的类型定义
          const targetType = nodeMap.get(returnType);
          if (targetType) {
            const targetNodeId = Object.entries(targetType.result.nodes)
              .find(([id, n]) => n === targetType.node)?.[0];
            
            if (targetNodeId) {
              relationships.push({
                type: 'dependency',
                from: nodeId,
                to: targetNodeId,
                metadata: {
                  kind: 'return_type',
                  path: result.filePath,
                  sourceCode: node.metadata?.nodeText || '',
                  projectName: result.projectPath ? path.basename(result.projectPath) : '',
                  fileName: result.filePath ? path.basename(result.filePath) : '',
                  position: {
                    line: node.range?.start?.row || 0,
                    column: node.range?.start?.column || 0
                  }
                }
              });
            }
          }
        }
      }
    });
    
    return relationships;
  }
}