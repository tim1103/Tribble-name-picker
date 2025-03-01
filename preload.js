// 暴露必要的API给渲染进程
const { contextBridge, ipcRenderer } = require('electron');

// 暴露必要的 API 给渲染进程
contextBridge.exposeInMainWorld('electron', {
    send: (channel, data) => ipcRenderer.send(channel, data),
    on: (channel, func) => ipcRenderer.on(channel, (event, ...args) => func(...args)),
});

//版本显示相关API
contextBridge.exposeInMainWorld('versions', {
  node: () => process.versions.node,
  chrome: () => process.versions.chrome,
  electron: () => process.versions.electron
});

//保存配置相关API
contextBridge.exposeInMainWorld('electronAPI', {
    saveConfig: (className) => ipcRenderer.invoke('save-config', className),
    loadConfig: () => ipcRenderer.invoke('load-config')
});

//悬浮窗相关API
contextBridge.exposeInMainWorld('overlayAPI', {
  restoreMain: () => ipcRenderer.send('restore-main-window')
});

// preload.js 中添加
contextBridge.exposeInMainWorld('systemInfo', {
  get: () => ipcRenderer.invoke('get-system-info')
});