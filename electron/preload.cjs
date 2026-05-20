const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  saveImage:      (data) => ipcRenderer.invoke('save-image', data),
  autoSave:       (data) => ipcRenderer.invoke('auto-save', data),
  loadAutosave:   ()     => ipcRenderer.invoke('load-autosave'),
  getAutosaveDir: ()     => ipcRenderer.invoke('get-autosave-dir'),
})
