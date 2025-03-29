// src/services/tree-sitter/queries/index.ts  
import { getTypeScriptQueries } from './typescript';  
import { getJavaScriptQueries } from './javascript';  
// import other language queries...  

export const languageQueries = {  
  typescript: getTypeScriptQueries,  
  javascript: getJavaScriptQueries,  
  // other languages...  
}; 