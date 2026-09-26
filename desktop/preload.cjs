const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('carboniqDesktop', {
  saveConfig: (config) => ipcRenderer.invoke('desktop:save-config', config),
});
