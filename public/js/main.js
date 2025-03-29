// 全局变量
let parsedResults = null;
let savedSnippets = {};
let network = null;

// DOM 加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
  initializeEventListeners();
  initializeFilters();
});

// 初始化事件监听器
function initializeEventListeners() {
  document.getElementById('parse-btn').addEventListener('click', parseFiles);
  document.getElementById('search-btn').addEventListener('click', searchSnippets);
  document.getElementById('refresh-graph-btn').addEventListener('click', refreshGraph);
  document.getElementById('import-btn').addEventListener('click', importProject);
  document.getElementById('export-btn').addEventListener('click', exportSnippets);
  
  // 标签页切换事件
  document.querySelectorAll('#main-tabs a').forEach(tab => {
    tab.addEventListener('click', (e) => {
      e.preventDefault();
      document.querySelectorAll('.tab-pane').forEach(pane => pane.classList.remove('show', 'active'));
      document.querySelector(tab.getAttribute('href')).classList.add('show', 'active');
      document.querySelectorAll('#main-tabs a').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      
      // 切换到图形视图时自动刷新
      if (tab.getAttribute('href') === '#graph-view') {
        refreshGraph();
      }
    });
  });
}

// 初始化过滤器
async function initializeFilters() {
  try {
    const response = await fetch('/api/metadata');
    const data = await response.json();
    
    const projectFilter = document.getElementById('project-filter');
    projectFilter.innerHTML = '<option value="">所有项目</option>';
    data.projects.forEach(project => {
      projectFilter.innerHTML += `<option value="${project}">${project}</option>`;
    });
    
    const fileTypeFilter = document.getElementById('file-type-filter');
    fileTypeFilter.innerHTML = '<option value="">所有文件类型</option>';
    data.fileTypes.forEach(type => {
      fileTypeFilter.innerHTML += `<option value="${type}">.${type}</option>`;
    });
  } catch (error) {
    console.error('获取元数据失败:', error);
  }
}

// 导入项目
async function importProject() {
  const projectPath = document.getElementById('project-path').value;
  
  if (!projectPath) {
    alert('请输入项目路径');
    return;
  }
  
  try {
    const response = await fetch('/api/import-project', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ projectPath })
    });
    
    const result = await response.json();
    
    if (result.success) {
      alert('项目导入成功！');
      await initializeFilters();
    } else {
      alert(`项目导入失败: ${result.error}`);
    }
  } catch (error) {
    console.error('项目导入错误:', error);
    alert('项目导入失败，请查看控制台了解详情');
  }
}

// HTML 转义
function escapeHtml(unsafe) {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}