// 解析文件
async function parseFiles() {
  const files = document.getElementById('files').files;
  const granularity = document.getElementById('granularity').value;
  const formData = new FormData();
  
  for (const file of files) {
    formData.append('files', file);
  }
  
  try {
    const response = await fetch('/api/parse', {
      method: 'POST',
      body: formData
    });
    
    const data = await response.json();
    parsedResults = data;
    saveSnippets(data);
    renderASTTree(data);
  } catch (error) {
    console.error('解析错误:', error);
    document.getElementById('ast-tree').innerHTML = `<div class="alert alert-danger">解析错误: ${error.message}</div>`;
  }
}

// 保存代码片段
function saveSnippets(data) {
  data.results.forEach(result => {
    Object.values(result.nodes).forEach(node => {
      const snippetKey = `${node.type}_${node.name}_${Date.now()}`;
      savedSnippets[snippetKey] = {
        type: node.type,
        name: node.name,
        content: node.metadata.nodeText,
        language: result.language,
        granularity: document.getElementById('granularity').value
      };
    });
  });
  renderSavedSnippets();
}

// 渲染AST树
function renderASTTree(data) {
  const treeContainer = document.getElementById('ast-tree');
  treeContainer.innerHTML = '';
  
  data.results.forEach(result => {
    const fileNode = document.createElement('div');
    fileNode.className = 'tree-view';
    fileNode.innerHTML = `<h5>${result.filename}</h5>`;
    
    result.rootNodes.forEach(rootId => {
      fileNode.appendChild(createNodeElement(result.nodes[rootId], result.nodes));
    });
    
    treeContainer.appendChild(fileNode);
  });
}

// 创建节点元素
function createNodeElement(node, allNodes) {
  const elem = document.createElement('div');
  elem.className = 'node-item';
  elem.innerHTML = `${node.type}: ${node.name}`;
  
  if (node.children && node.children.length > 0) {
    const childContainer = document.createElement('div');
    childContainer.className = 'tree-view';
    node.children.forEach(childId => {
      childContainer.appendChild(createNodeElement(allNodes[childId], allNodes));
    });
    elem.appendChild(childContainer);
  }
  
  return elem;
}

// 渲染保存的代码片段
function renderSavedSnippets() {
  const container = document.getElementById('saved-snippets');
  container.innerHTML = '';
  
  Object.entries(savedSnippets).forEach(([key, snippet]) => {
    const snippetElem = document.createElement('div');
    snippetElem.className = 'code-snippet';
    snippetElem.innerHTML = `
      <div class="snippet-header">
        <div>
          <span class="type-badge">${snippet.type}</span>
          <span>${snippet.name}</span>
        </div>
        <div>
          <small>语言: ${snippet.language} | 粒度: ${snippet.granularity}</small>
        </div>
      </div>
      <pre><code>${snippet.content}</code></pre>
    `;
    container.appendChild(snippetElem);
  });
}