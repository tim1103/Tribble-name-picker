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