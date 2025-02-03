const { app, BrowserWindow, ipcMain, globalShortcut } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow;
// 在文件顶部添加配置文件路径
//const configPath = 'D:/RNPconfig.json';

function getConfigPath() {
  if (process.platform === 'win32') {
    return 'D:/RNPconfig.json'; // Windows仍使用D盘
  } else {
    return path.join(app.getPath('userData'), 'RNPconfig.json'); // 非Windows使用userData
  }
}



//app.on('ready', createWindow);

app.whenReady().then(() => {
  createWindow();

  // 注册 Ctrl+L/Command+L 快捷键
  globalShortcut.register('CommandOrControl+L', () => {
    if (mainWindow) {
      mainWindow.webContents.openDevTools();
    }
  });
});

// 应用退出时注销快捷键
app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

// 处理窗口操作
ipcMain.on('window-minimize', () => {
  mainWindow.minimize();
});

ipcMain.on('window-maximize', () => {
  if (mainWindow.isMaximized()) {
    mainWindow.unmaximize();
  } else {
    mainWindow.maximize();
  }
});

ipcMain.on('window-close', () => {
  mainWindow.close();
});



ipcMain.handle('load-config', () => {
  const configPath = getConfigPath(); // 动态获取路径
  try {
    if (fs.existsSync(configPath)) {
      const data = fs.readFileSync(configPath, 'utf8');
      return JSON.parse(data);
    }
    return null;
  } catch (error) {
    console.error('读取配置失败:', error);
    return null;
  }
});

const sudo = require('sudo-prompt');

ipcMain.handle('save-config', async (event, className) => {
  const configPath = getConfigPath(); // 动态获取路径
  const configData = JSON.stringify({ className });
  // 普通写入尝试
  try {
    fs.writeFileSync(configPath, configData);
    return { success: true, isElevated: false };
  } catch (error) {
    if (error.code !== 'EACCES') {
      console.error('非权限错误:', error);
      return { success: false, error: error.message };
    }

    // 权限不足时请求提升
    return new Promise((resolve) => {
      const elevatedCommand = `echo '${configData}' > "${configPath}"`;

      sudo.exec(
        elevatedCommand,
        { name: '随机点名配置保存' },
        (error) => {
          if (error) {
            console.error('管理员写入失败:', error);
            resolve({ success: false, error: error.message });
          } else {
            resolve({ success: true, isElevated: true });
          }
        }
      );
    });
  }
});

let overlayWindow = null;
function createOverlayWindow() {
  overlayWindow = new BrowserWindow({
    width: 90,
    height: 60,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    webPreferences: {
      contextIsolation: true, // 启用上下文隔离
      nodeIntegration: false, // 禁用nodeIntegration
      preload: path.join(__dirname, 'preload.js'),// 加载preload.js
    }
  });

  overlayWindow.loadFile('overlay.html');
  overlayWindow.setIgnoreMouseEvents(false);
  //打开开发者工具
  //overlayWindow.webContents.openDevTools();
  // 修改点击事件处理逻辑
  const position = mainWindow.getPosition();
  overlayWindow.setPosition(position[0] + 100, position[1] + 50);
}


function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 720,
    minWidth: 520,
    minHeight: 180,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'), // 加载preload.js
      nodeIntegration: false, // 禁用 nodeIntegration
      contextIsolation: true, // 启用上下文隔离
    },
    frame: false, // 隐藏默认的窗口边框
    titleBarStyle: 'hidden', // 隐藏标题栏
    icon: path.join(__dirname, 'ico.ico'), ...(process.platform === 'linux' ? { icon: path.join(__dirname, 'linux-icon.png') } : {}),
  });

  mainWindow.loadFile('index.html'); // 加载HTML文件
  mainWindow.maximize();
  // 打开开发者工具（可选）
  //mainWindow.webContents.openDevTools();

  mainWindow.on('closed', () => {
    mainWindow = null;

  });

  // 添加窗口焦点监听
  mainWindow.on('focus', () => {
    if (overlayWindow) {
      overlayWindow.hide();
    }
  });

  mainWindow.on('blur', () => {
    if (!overlayWindow) {
      createOverlayWindow();
    }
    overlayWindow.show();
  });

  // 窗口移动时更新悬浮窗位置
  mainWindow.on('moved', () => {
    if (overlayWindow) {
      const position = mainWindow.getPosition();
      overlayWindow.setPosition(position[0] + 100, position[1] + 50);
    }
  });

  // 窗口关闭时销毁悬浮窗
  mainWindow.on('closed', () => {
    if (overlayWindow) {
      overlayWindow.close();
      overlayWindow = null;
    }
  });
}
// 删除重复的ipcMain.on('restore-main-window')，只保留以下版本
ipcMain.on('restore-main-window', () => {
  if (!mainWindow) return;
  
  if (mainWindow.isMinimized()) {
    mainWindow.restore();
  }
  
  if (!mainWindow.isVisible()) {
    mainWindow.show();
  }

  // Windows专用聚焦逻辑
  if (process.platform === 'win32') {
    mainWindow.setAlwaysOnTop(true);
    mainWindow.focus();
    mainWindow.setAlwaysOnTop(false);
  } else {
    mainWindow.focus();
  }
  
  mainWindow.moveTop();
});