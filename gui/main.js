const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      webviewTag: true,
      nativeWindowOpen: false, // 禁用原生窗口打开，使用webview
      nodeIntegrationInSubFrames: false // 禁止在子框架中使用node集成
    },
    titleBarStyle: 'default',
    show: false
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  // 拦截webview中的特殊协议导航
  mainWindow.webContents.on('will-navigate', (event, url, isInPlace, isMainFrame, frameProcessId, frameRoutingId) => {
    if (url.startsWith('electron-create-tab://')) {
      event.preventDefault();
      const targetUrl = decodeURIComponent(url.replace('electron-create-tab://', ''));
      mainWindow.webContents.send('load-url', targetUrl);
    } else if (url.startsWith('electron-navigate://')) {
      event.preventDefault();
      const targetUrl = decodeURIComponent(url.replace('electron-navigate://', ''));
      mainWindow.webContents.send('navigate-current-tab', targetUrl);
    }
  });

  // 也监听子frame的导航
  mainWindow.webContents.on('will-frame-navigate', (event, url, isInPlace, isMainFrame, frameProcessId, frameRoutingId) => {
    if (url.startsWith('electron-create-tab://')) {
      event.preventDefault();
      const targetUrl = decodeURIComponent(url.replace('electron-create-tab://', ''));
      mainWindow.webContents.send('load-url', targetUrl);
    } else if (url.startsWith('electron-navigate://')) {
      event.preventDefault();
      const targetUrl = decodeURIComponent(url.replace('electron-navigate://', ''));
      mainWindow.webContents.send('navigate-current-tab', targetUrl);
    }
  });

  // 拦截所有新窗口，确保在客户端内打开
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    // 发送消息到渲染进程，在客户端内打开新标签页
    mainWindow.webContents.send('load-url', url);
    return { action: 'deny' }; // 阻止默认行为
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// 处理URL导航请求
ipcMain.on('navigate-to-url', (event, url) => {
  if (mainWindow) {
    mainWindow.webContents.send('load-url', url);
  }
});

