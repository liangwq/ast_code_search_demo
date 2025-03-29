import { IndexedNode } from './indexer';

export class CodeExporter {
  exportToMarkdown(nodes: IndexedNode[]) {
    return nodes.map(node => `
### ${node.type}: ${node.name}
\`\`\`${node.language}
${node.content}
\`\`\`
    `).join('\n');
  }

  exportToJSON(nodes: IndexedNode[]) {
    return JSON.stringify(nodes, null, 2);
  }

  exportToHTML(nodes: IndexedNode[]) {
    // 生成可视化 HTML 报告
  }
}