const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow;
// 在文件顶部添加配置文件路径
const configPath = 'D:/RNPconfig.json';

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1280,
        height: 720,
        minWidth: 1080,
        minHeight: 180,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'), // 加载preload.js
            nodeIntegration: false, // 禁用 nodeIntegration
            contextIsolation: true, // 启用上下文隔离
        },
        frame: false, // 隐藏默认的窗口边框
        titleBarStyle: 'hidden', // 隐藏标题栏
        icon: path.join(__dirname, 'ico.ico'), ...(process.platform === 'linux' ? { icon } : {}),
    });

    mainWindow.loadFile('index.html'); // 加载HTML文件
    mainWindow.maximize();
    // 打开开发者工具（可选）
    mainWindow.webContents.openDevTools();

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

app.on('ready', createWindow);

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

// 修改保存配置的handler
ipcMain.handle('save-config', async (event, className) => {
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