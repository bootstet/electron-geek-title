const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('gt', {
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  listImages: (dir) => ipcRenderer.invoke('list-images', dir),
  previewImage: (file) => ipcRenderer.invoke('preview-image', file),
  compressImage: (file, opts) => ipcRenderer.invoke('compress-image', file, opts),
  getSettings: () => ipcRenderer.invoke('get-settings'),
  setSettings: (obj) => ipcRenderer.invoke('set-settings', obj),
  generateTitles: (payload) => ipcRenderer.invoke('generate-titles', payload),
  renameByTitle: (items, pattern) => ipcRenderer.invoke('rename-by-title', items, pattern),
  saveCSV: (rows, filePath) => ipcRenderer.invoke('save-csv', rows, filePath),
  saveExcel: (data) => ipcRenderer.invoke('save-excel', data),
  checkFileExists: (filePath) => ipcRenderer.invoke('check-file-exists', filePath)
});
