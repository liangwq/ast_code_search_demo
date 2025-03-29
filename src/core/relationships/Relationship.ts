import * as path from 'path';

export interface RelationshipPosition {
  line: number;
  column: number;
}

export interface RelationshipMetadata {
  kind: string;
  path?: string;
  sourceCode?: string;
  projectName?: string;
  fileName?: string;
  position?: RelationshipPosition;
  description?: string; // 添加描述字段，用于显示关系说明
}

export interface Relationship {
  type: 'inheritance' | 'dependency' | 'call' | 'style';
  from: string;
  to: string;
  metadata?: RelationshipMetadata;
}

// 创建关系的辅助函数
export function createRelationship(
  type: 'inheritance' | 'dependency' | 'call' | 'style',
  from: string,
  to: string,
  kind: string,
  result: any,
  node: any,
  sourceCode?: string,
  description?: string
): Relationship {
  return {
    type,
    from,
    to,
    metadata: {
      kind,
      path: result.filePath,
      sourceCode: sourceCode || node.metadata?.nodeText || '',
      projectName: result.projectPath ? path.basename(result.projectPath) : '',
      fileName: result.filePath ? path.basename(result.filePath) : '',
      description,
      position: {
        line: node.range?.start?.row || 0,
        column: node.range?.start?.column || 0
      }
    }
  };
}