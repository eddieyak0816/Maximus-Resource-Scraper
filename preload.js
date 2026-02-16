const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  dbQuery: (query, params) => ipcRenderer.invoke('db-query', query, params),
  dbRun: (query, params) => ipcRenderer.invoke('db-run', query, params),
  processContent: (contentData) => ipcRenderer.invoke('process-content', contentData)
});