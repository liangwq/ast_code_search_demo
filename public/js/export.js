// 导出代码片段
async function exportSnippets() {
  const format = document.getElementById('export-format').value;
  
  try {
    const response = await fetch('/api/search');
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('导出数据:', data); // 添加日志以便调试
    
    if (!data.results || data.results.length === 0) {
      document.getElementById('export-preview').innerHTML = '<div class="alert alert-info">没有可导出的数据</div>';
      return;
    }
    
    let exportContent = '';
    
    switch (format) {
      case 'markdown':
        exportContent = data.results.map(node => {
          const content = node.content || node.metadata?.nodeText || '';
          return `
### ${node.type}: ${node.name}
\`\`\`${node.language || 'text'}
${content}
\`\`\`
`;
        }).join('\n');
        break;
        
      case 'json':
        exportContent = JSON.stringify(data.results, null, 2);
        break;
        
      case 'html':
        exportContent = `<!DOCTYPE html>
<html>
<head>
  <title>代码片段导出</title>
  <style>
    body { font-family: sans-serif; max-width: 1200px; margin: 0 auto; padding: 20px; }
    .snippet { margin-bottom: 20px; border: 1px solid #eee; padding: 15px; border-radius: 5px; }
    pre { background: #f5f5f5; padding: 10px; overflow: auto; }
  </style>
</head>
<body>
  <h1>代码片段导出</h1>
  ${data.results.map(node => {
    const content = node.content || node.metadata?.nodeText || '';
    return `
  <div class="snippet">
    <h3>${node.type}: ${node.name}</h3>
    <p>项目: ${node.projectName || '未知'} | 文件: ${node.fileName || '未知'}</p>
    <pre><code>${content}</code></pre>
  </div>
  `;
  }).join('')}
</body>
</html>`;
        break;
    }
    
    // 显示预览
    const previewElem = document.getElementById('export-preview');
    previewElem.innerHTML = `<pre>${escapeHtml(exportContent.substring(0, 1000))}${exportContent.length > 1000 ? '...' : ''}</pre>
    <button id="download-btn" class="btn btn-success mt-3">下载</button>`;
    
    // 添加下载按钮事件
    document.getElementById('download-btn').addEventListener('click', () => {
      const blob = new Blob([exportContent], { type: format === 'json' ? 'application/json' : 'text/plain' });
      const url = URL.createObjectURL(blob);
      const downloadLink = document.createElement('a');
      downloadLink.href = url;
      downloadLink.download = `code-snippets.${format === 'html' ? 'html' : format === 'json' ? 'json' : 'md'}`;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
      URL.revokeObjectURL(url);
    });
  } catch (error) {
    console.error('导出错误:', error);
    document.getElementById('export-preview').innerHTML = `<div class="alert alert-danger">导出失败: ${error.message}</div>`;
  }
}