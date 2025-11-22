// 在文件顶部添加screen模块
const { app, BrowserWindow, ipcMain, globalShortcut, screen } = require('electron');
const path = require('path');
const fs = require('fs');
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
  return;
}

let mainWindow;
let overlayWindow = null;

// 配置文件路径判断
function getConfigPath() {
  if (process.platform === 'win32') {
    return 'D:/RNPconfig.json'; // Windows使用D盘
  } else {
    return path.join(app.getPath('userData'), 'RNPconfig.json'); // 非Windows使用userData
  }
}

app.on('second-instance', () => {
  if (mainWindow) {
    // 如果主窗口最小化则恢复
    if (mainWindow.isMinimized()) mainWindow.restore()
    // 将主窗口带到最前
    mainWindow.show()
    mainWindow.focus()
  }
})

app.whenReady().then(() => {
  createWindow();

  // 注册 Ctrl+L/Command+L 快捷键（控制台）
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

//创建悬浮窗
function createOverlayWindow() {
  overlayWindow = new BrowserWindow({
    width: 124,
    height: 99,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    webPreferences: {
      contextIsolation: true, // 启用上下文隔离
      nodeIntegration: false, // 禁用nodeIntegration
      preload: path.join(__dirname, 'preload.js')// 加载preload.js
    }
  });

  overlayWindow.loadFile('new-overlay.html');
  overlayWindow.setIgnoreMouseEvents(false);

  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.workAreaSize;
  
  // 设置窗口到右下角
  overlayWindow.setPosition(
    width - 124,
    height - 99
  );
  //打开开发者工具
  //overlayWindow.webContents.openDevTools();
}


function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1080,
    height: 640,
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
  //mainWindow.maximize();
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

// 添加处理悬浮窗请求抽取学生的IPC消息
ipcMain.on('overlay-pick-one', () => {
  if (mainWindow) {
    mainWindow.webContents.send('overlay-pick-one');
  }
});

// 添加处理主窗口发送的学生姓名更新
ipcMain.on('update-student-name', (event, name) => {
  if (overlayWindow) {
    overlayWindow.webContents.send('student-name-update', name);
  }
});

// main.js 中添加
const os = require('os');

ipcMain.handle('get-system-info', () => {
  return {
    platform: os.platform(),
    type: os.type(),
    version: os.release(),
    arch: os.arch(),
    totalMem: (os.totalmem() / 1024 ** 3).toFixed(2) + ' GB',
    freeMem: (os.freemem() / 1024 ** 3).toFixed(2) + ' GB',
    cpus: os.cpus().length,

    homedir: os.homedir(),
    tmpdir: os.tmpdir(),
    hostname: os.hostname(),
    uptime: (os.uptime() / 3600).toFixed(2) + ' 小时'
  };
});