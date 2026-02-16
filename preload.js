const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('api', {
  selectFolder: (settings) => ipcRenderer.invoke('select-folder', settings),
  optimizeFiles: (filePaths, settings) => ipcRenderer.invoke('optimize-dropped-files', filePaths, settings),
  getFilePath: (file) => webUtils.getPathForFile(file),
});
