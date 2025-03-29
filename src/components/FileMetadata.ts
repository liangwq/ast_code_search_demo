interface FileMetadata {
  projectName: string;
  projectPath: string;
  fileName: string;
  filePath: string;
}

// 添加响应数据的接口定义
interface MetadataResponse {
  snippets: {
    projectName: string;
    projectPath: string;
    fileName: string;
    filePath: string;
  }[];
}

export async function fetchFileMetadata(): Promise<FileMetadata[]> {
  try {
    const response = await fetch('/api/metadata');
    const data = await response.json() as MetadataResponse;
    return data.snippets.map(snippet => ({
      projectName: snippet.projectName,
      projectPath: snippet.projectPath,
      fileName: snippet.fileName,
      filePath: snippet.filePath
    }));
  } catch (error) {
    console.error('获取文件元数据失败:', error);
    return [];
  }
}

export function renderFileMetadata(container: HTMLElement, metadata: FileMetadata[]) {
  const html = `
    <div class="file-metadata">
      <h3>文件信息</h3>
      <table>
        <thead>
          <tr>
            <th>项目名称</th>
            <th>项目路径</th>
            <th>文件名</th>
            <th>文件路径</th>
          </tr>
        </thead>
        <tbody>
          ${metadata.map(item => `
            <tr>
              <td>${item.projectName}</td>
              <td>${item.projectPath}</td>
              <td>${item.fileName}</td>
              <td>${item.filePath}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
  
  container.innerHTML = html;
}