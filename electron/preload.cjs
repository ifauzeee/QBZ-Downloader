const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('qbzDesktop', {
  isDesktop: true,
  app: {
    getVersion: () => ipcRenderer.invoke('desktop:app-version'),
    selectFolder: (defaultPath) => ipcRenderer.invoke('desktop:select-folder', defaultPath),
    openFolder: (folderPath) => ipcRenderer.invoke('desktop:open-folder', folderPath),
    showItem: (filePath) => ipcRenderer.invoke('desktop:show-item', filePath)
  },
  window: {
    minimize: () => ipcRenderer.invoke('desktop:window:minimize'),
    toggleMaximize: () => ipcRenderer.invoke('desktop:window:toggle-maximize'),
    close: () => ipcRenderer.invoke('desktop:window:close'),
    isMaximized: () => ipcRenderer.invoke('desktop:window:is-maximized'),
    onMaximizeChanged: (callback) => {
      const listener = (_event, isMaximized) => callback(Boolean(isMaximized));
      ipcRenderer.on('desktop:maximize-changed', listener);
      return () => ipcRenderer.removeListener('desktop:maximize-changed', listener);
    }
  },
  updates: {
    getStatus: () => ipcRenderer.invoke('desktop:update:get-status'),
    check: () => ipcRenderer.invoke('desktop:update:check'),
    install: () => ipcRenderer.invoke('desktop:update:install'),
    onStatusChanged: (callback) => {
      const listener = (_event, status) => callback(status);
      ipcRenderer.on('desktop:update-status', listener);
      return () => ipcRenderer.removeListener('desktop:update-status', listener);
    }
  },
});
