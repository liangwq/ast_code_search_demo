// 刷新关系图
async function refreshGraph() {
  const graphType = document.getElementById('graph-type').value;
  const container = document.getElementById('graph-container');
  
  try {
    container.innerHTML = '<div class="text-center p-5">加载中...</div>';
    
    // 获取关系数据
    const response = await fetch(`/api/relationships?type=${graphType}`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('关系图数据:', data); // 添加日志以便调试
    
    // 验证数据结构
    if (!data.relationships || !data.nodes) {
      throw new Error('无效的数据结构');
    }
    
    if (data.relationships.length === 0) {
      container.innerHTML = '<div class="alert alert-info text-center">没有找到相关的关系数据</div>';
      return;
    }
    
    // 使用简化的表格方式显示关系
    renderSimpleRelationshipTable(data.relationships, data.nodes, container);
  } catch (error) {
    console.error('获取关系数据失败:', error);
    container.innerHTML = `<div class="alert alert-danger">加载关系图失败: ${error.message}</div>`;
  }
}

// 使用简单表格渲染关系
function renderSimpleRelationshipTable(relationships, nodes, container) {
  // 清空容器
  container.innerHTML = '';
  
  // 创建表格
  const table = document.createElement('table');
  table.className = 'table table-striped table-bordered';
  
  // 创建表头
  const thead = document.createElement('thead');
  thead.innerHTML = `
    <tr>
      <th>源节点</th>
      <th>关系类型</th>
      <th>目标节点</th>
      <th>源文件</th>
      <th>目标文件</th>
      <th>操作</th>
    </tr>
  `;
  table.appendChild(thead);
  
  // 创建表体
  const tbody = document.createElement('tbody');
  
  // 添加关系行
  relationships.forEach(rel => {
    const sourceNode = nodes[rel.from] || { type: '未知', name: '未知', fileName: '未知' };
    const targetNode = nodes[rel.to] || { type: '未知', name: '未知', fileName: '未知' };
    
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${sourceNode.type || '未知'}: ${sourceNode.name || '未知'}</td>
      <td>${rel.type || '未知关系'}</td>
      <td>${targetNode.type || '未知'}: ${targetNode.name || '未知'}</td>
      <td>${sourceNode.fileName || '未知'}</td>
      <td>${targetNode.fileName || '未知'}</td>
      <td>
        <button class="btn btn-sm btn-info view-source-btn" data-from="${rel.from}" data-to="${rel.to}">查看源码</button>
      </td>
    `;
    
    tbody.appendChild(row);
  });
  
  table.appendChild(tbody);
  container.appendChild(table);
  
  // 添加简单统计信息
  const stats = document.createElement('div');
  stats.className = 'alert alert-info mt-3';
  stats.innerHTML = `共找到 ${relationships.length} 个关系`;
  container.appendChild(stats);
  
  // 添加查看源码的事件处理
  document.querySelectorAll('.view-source-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const fromId = btn.getAttribute('data-from');
      const toId = btn.getAttribute('data-to');
      showSourceCode(fromId, toId, nodes);
    });
  });
}

// 显示源码对话框
function showSourceCode(fromId, toId, nodes) {
  const sourceNode = nodes[fromId];
  const targetNode = nodes[toId];
  
  if (!sourceNode || !targetNode) {
    alert('无法获取节点信息');
    return;
  }
  
  // 创建模态对话框
  const modal = document.createElement('div');
  modal.className = 'modal fade';
  modal.id = 'sourceCodeModal';
  modal.setAttribute('tabindex', '-1');
  modal.innerHTML = `
    <div class="modal-dialog modal-lg">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title">关系源码</h5>
          <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
        </div>
        <div class="modal-body">
          <div class="row">
            <div class="col-md-6">
              <h6>源节点: ${sourceNode.type}: ${sourceNode.name}</h6>
              <pre><code class="language-${sourceNode.language || 'plaintext'}">${sourceNode.content || '无内容'}</code></pre>
              <p>文件: ${sourceNode.fileName || '未知'} (${sourceNode.relativePath || '未知路径'})</p>
            </div>
            <div class="col-md-6">
              <h6>目标节点: ${targetNode.type}: ${targetNode.name}</h6>
              <pre><code class="language-${targetNode.language || 'plaintext'}">${targetNode.content || '无内容'}</code></pre>
              <p>文件: ${targetNode.fileName || '未知'} (${targetNode.relativePath || '未知路径'})</p>
            </div>
          </div>
          <div class="row mt-3">
            <div class="col-12">
              <h6>关系说明</h6>
              <div id="relationship-explanation"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  // 显示模态框
  const modalInstance = new bootstrap.Modal(modal);
  // 在 showSourceCode 函数中，模态框显示后添加
  modalInstance.show();
  
  // 应用语法高亮
  setTimeout(() => {
    if (window.hljs) {
      document.querySelectorAll('pre code').forEach((block) => {
        hljs.highlightBlock(block);
      });
    }
  }, 100);
  
  // 获取关系详情并显示解释
  fetchRelationshipExplanation(fromId, toId);
  
  // 模态框关闭后移除DOM
  modal.addEventListener('hidden.bs.modal', () => {
    document.body.removeChild(modal);
  });
}

// 获取关系解释
async function fetchRelationshipExplanation(fromId, toId) {
  try {
    const response = await fetch(`/api/relationship-explanation?from=${fromId}&to=${toId}`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    const explanationDiv = document.getElementById('relationship-explanation');
    
    if (data.explanation) {
      explanationDiv.innerHTML = `<div class="alert alert-info">${data.explanation}</div>`;
    } else {
      explanationDiv.innerHTML = '<div class="alert alert-warning">无法获取关系解释</div>';
    }
  } catch (error) {
    console.error('获取关系解释失败:', error);
    document.getElementById('relationship-explanation').innerHTML = 
      `<div class="alert alert-danger">获取关系解释失败: ${error.message}</div>`;
  }
}

// 保留原来的图形渲染函数，但不默认使用
function renderGraph(relationships, nodes) {
  const container = document.getElementById('graph-container');
  
  // 准备数据
  const graphNodes = [];
  const graphEdges = [];
  
  // 处理节点
  Object.entries(nodes).forEach(([id, node]) => {
    graphNodes.push({
      id: id,
      label: `${node.type}\n${node.name}`,
      title: `${node.fileName || ''}\n${node.relativePath || node.filePath || ''}`,
      shape: 'box'
    });
  });
  
  // 处理边
  relationships.forEach(rel => {
    graphEdges.push({
      from: rel.from,
      to: rel.to,
      arrows: 'to',
      label: rel.type,
      title: JSON.stringify(rel.metadata || {})
    });
  });
  
  // 配置选项
  const options = {
    nodes: {
      font: { size: 12 }
    },
    edges: {
      font: { size: 10, align: 'middle' },
      smooth: { type: 'cubicBezier' }
    },
    physics: {
      enabled: true,
      hierarchicalRepulsion: { nodeDistance: 150 }
    }
  };
  
  // 创建网络图
  if (network) {
    network.destroy();
  }
  
  network = new vis.Network(container, {
    nodes: new vis.DataSet(graphNodes),
    edges: new vis.DataSet(graphEdges)
  }, options);
}