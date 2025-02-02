/**
 * The preload script runs before `index.html` is loaded
 * in the renderer. It has access to web APIs as well as
 * Electron's renderer process modules and some polyfilled
 * Node.js functions.
 *
 * https://www.electronjs.org/docs/latest/tutorial/sandbox
 */

// 暴露必要的API给渲染进程
const { contextBridge, ipcRenderer } = require('electron');

// 暴露必要的 API 给渲染进程
contextBridge.exposeInMainWorld('electron', {
    send: (channel, data) => ipcRenderer.send(channel, data),
    on: (channel, func) => ipcRenderer.on(channel, (event, ...args) => func(...args)),
});


contextBridge.exposeInMainWorld('versions', {
  node: () => process.versions.node,
  chrome: () => process.versions.chrome,
  electron: () => process.versions.electron
});


contextBridge.exposeInMainWorld('electronAPI', {
    saveConfig: (className) => ipcRenderer.invoke('save-config', className),
    loadConfig: () => ipcRenderer.invoke('load-config')
});
  
contextBridge.exposeInMainWorld('overlayAPI', {
  restoreMain: () => ipcRenderer.send('restore-main-window')
});