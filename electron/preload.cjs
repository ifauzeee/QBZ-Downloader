const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('qbzDesktop', {
  isDesktop: true,
  app: {
    getVersion: () => ipcRenderer.invoke('desktop:app-version')
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
  miniPlayer: {
    toggle: () => ipcRenderer.invoke('desktop:mini-player:toggle'),
    isOpen: () => ipcRenderer.invoke('desktop:mini-player:is-open'),
    sendPlayerEvent: (type, data) => ipcRenderer.send('desktop:player:event', type, data),
    onPlayerEvent: (callback) => {
      const listener = (_event, type, data) => callback(type, data);
      ipcRenderer.on('desktop:player:event', listener);
      return () => ipcRenderer.removeListener('desktop:player:event', listener);
    }
  }
});
