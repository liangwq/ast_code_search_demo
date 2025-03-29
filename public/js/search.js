// 搜索代码片段 - 使用 GET 方法
async function searchSnippets() {
  const searchText = document.getElementById('search-input').value;
  const searchType = document.getElementById('search-type').value;
  
  if (!searchText) return;
  
  try {
    // 构建查询参数
    const params = new URLSearchParams();
    params.append(searchType, searchText);
    
    // 添加过滤条件
    const projectName = document.getElementById('project-filter').value;
    const fileName = document.getElementById('file-type-filter').value;
    const relativePath = document.getElementById('path-filter').value;
    
    if (projectName) params.append('projectName', projectName);
    if (fileName) params.append('fileName', fileName);
    if (relativePath) params.append('relativePath', relativePath);
    
    // 发送 GET 请求
    const response = await fetch(`/api/search?${params.toString()}`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('搜索结果:', data); // 添加日志以便调试
    
    if (data.error) {
      throw new Error(data.error);
    }
    
    renderSearchResults(data.results || []);
  } catch (error) {
    console.error('搜索错误:', error);
    document.getElementById('search-results').innerHTML = 
      `<div class="alert alert-danger">搜索失败: ${error.message}</div>`;
  }
}

// 渲染搜索结果
function renderSearchResults(nodes) {
  const container = document.getElementById('search-results');
  container.innerHTML = '';
  
  if (!nodes || nodes.length === 0) {
    container.innerHTML = '<div class="alert alert-info">没有找到匹配的结果</div>';
    return;
  }
  
  nodes.forEach(node => {
    // 确保所有字段都有默认值，防止undefined错误
    const content = node.content || node.metadata?.nodeText || '';
    
    const snippetElem = document.createElement('div');
    snippetElem.className = 'code-snippet';
    snippetElem.innerHTML = `
      <div class="snippet-header">
        <div class="snippet-title">
          <span class="type-badge">${node.type || '未知类型'}</span>
          <span class="name">${node.name || '未命名'}</span>
        </div>
        <div class="snippet-meta">
          <div class="meta-row">
            <span class="meta-label">项目:</span>
            <span class="meta-value">${node.projectName || '未知'}</span>
          </div>
          <div class="meta-row">
            <span class="meta-label">文件:</span>
            <span class="meta-value">${node.fileName || '未知'}</span>
          </div>
          <div class="meta-row">
            <span class="meta-label">路径:</span>
            <span class="meta-value">${node.relativePath || node.filePath || '未知'}</span>
          </div>
        </div>
      </div>
      <pre><code>${content}</code></pre>
    `;
    container.appendChild(snippetElem);
  });
}