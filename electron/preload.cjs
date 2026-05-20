const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  saveImage: (data) => ipcRenderer.invoke('save-image', data),
})
