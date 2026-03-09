const { app, BrowserWindow, Tray, Menu, nativeTheme, ipcMain, shell, session } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const log = require('electron-log');

log.transports.file.level = 'info';
log.transports.console.level = 'debug';

let mainWindow = null;
let tray = null;
let backendProcess = null;

const isDev = !app.isPackaged;
const BACKEND_URL = 'http://localhost:8080';

function startBackend() {
  let serverPath;
  
  if (isDev) {
    serverPath = path.join(__dirname, '..', 'gateway-core', 'server', 'src', 'index.js');
  } else {
    serverPath = path.join(process.resourcesPath, 'server', 'src', 'index.js');
  }

  log.info('Starting backend from:', serverPath);
  
  try {
    backendProcess = spawn('node', [serverPath], {
      cwd: path.join(__dirname, '..', 'gateway-core', 'server'),
      stdio: 'inherit',
      shell: true
    });
    
    backendProcess.on('error', (err) => {
      log.error('Backend process error:', err);
    });
    
    backendProcess.on('close', (code) => {
      log.info('Backend process closed with code:', code);
      if (mainWindow) {
        mainWindow.close();
      }
    });
  } catch (err) {
    log.error('Failed to start backend:', err);
  }
}

function setupProxy() {
  session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
    if (details.url.startsWith('/api/')) {
      callback({ redirectURL: BACKEND_URL + details.url });
    } else {
      callback({});
    }
  });
}

function createWindow() {
  // Determine icon path
  let iconPath = path.join(__dirname, 'build', 'icon.png');
  if (!require('fs').existsSync(iconPath)) {
    iconPath = path.join(__dirname, '..', 'gateway-core', 'src', 'main', 'resources', 'icon.png');
  }
  
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  if (require('fs').existsSync(iconPath)) {
    mainWindow.setIcon(iconPath);
  }

  let startUrl;
  if (isDev) {
    startUrl = 'http://localhost:3000';
  } else {
    const uiPath = path.join(__dirname, 'src', 'ui', 'index.html');
    startUrl = `file://${uiPath}`;
  }

  log.info('Loading URL:', startUrl);
  mainWindow.loadURL(startUrl);

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    log.info('Main window ready');
  });

  mainWindow.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  if (isDev) {
    mainWindow.webContents.openDevTools();
  }
}

function createTray() {
  let iconPath = path.join(__dirname, 'build', 'icon.png');
  if (!require('fs').existsSync(iconPath)) {
    iconPath = path.join(__dirname, '..', 'gateway-core', 'src', 'main', 'resources', 'icon.png');
  }
  
  // Use default icon if custom not found
  if (!require('fs').existsSync(iconPath)) {
    log.warn('Tray icon not found, skipping tray creation');
    return;
  }
  
  tray = new Tray(iconPath);
  
  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Open Dashboard',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      }
    },
    {
      label: 'Health Check',
      click: () => {
        shell.openExternal(BACKEND_URL + '/actuator/health');
      }
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        app.isQuitting = true;
        app.quit();
      }
    }
  ]);
  
  tray.setToolTip('Gateway Core');
  tray.setContextMenu(contextMenu);
  
  tray.on('double-click', () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

nativeTheme.on('updated', () => {
  if (mainWindow) {
    mainWindow.webContents.send('theme-changed', nativeTheme.shouldUseDarkColors);
  }
});

app.whenReady().then(() => {
  log.info('App starting...');
  
  if (!isDev) {
    setupProxy();
  }
  
  startBackend();
  
  // Wait for backend to start
  setTimeout(() => {
    createWindow();
    createTray();
  }, 8000);
  
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    } else if (mainWindow) {
      mainWindow.show();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  app.isQuitting = true;
  if (backendProcess) {
    backendProcess.kill();
  }
});

ipcMain.handle('get-theme', () => {
  return nativeTheme.shouldUseDarkColors ? 'dark' : 'light';
});

ipcMain.handle('open-external', (event, url) => {
  shell.openExternal(url);
});
