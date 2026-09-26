const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('carboniqDesktop', {
  openSetup: () => ipcRenderer.invoke('desktop:open-setup'),
  listProfiles: () => ipcRenderer.invoke('desktop:list-profiles'),
  testAndSave: (config) => ipcRenderer.invoke('desktop:test-and-save', config),
  selectProfile: (id) => ipcRenderer.invoke('desktop:select-profile', id),
  onProfileChanged: (callback) => {
    const handler = (_event, details) => callback(details);
    ipcRenderer.on('desktop:profile-changed', handler);
    return () => ipcRenderer.removeListener('desktop:profile-changed', handler);
  },
});
