const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getTheme: () => ipcRenderer.invoke('get-theme'),
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  onThemeChanged: (callback) => {
    ipcRenderer.on('theme-changed', (event, isDark) => callback(isDark));
  }
});
