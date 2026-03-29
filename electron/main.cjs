const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');

let autoUpdater = null;
try {
  ({ autoUpdater } = require('electron-updater'));
} catch {
  autoUpdater = null;
}

const initialCwd = process.cwd();
const DESKTOP_PORT = Number.parseInt(
  process.env.DESKTOP_DASHBOARD_PORT || process.env.DASHBOARD_PORT || '3210',
  10
);
const DASHBOARD_URL = `http://127.0.0.1:${DESKTOP_PORT}`;

let runtimeDir = initialCwd;
let mainWindow = null;
let backendBootPromise = null;
let updaterInterval = null;
let updateState = {
  status: 'idle',
  message: 'No update check yet.',
  version: null,
  available: false,
  downloaded: false,
  checkedAt: null
};

function createLoadingMarkup(message) {
  return `<!doctype html>
<html>
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1.0" />
    <title>QBZ Downloader</title>
    <style>
      html, body { height: 100%; margin: 0; }
      body {
        display: grid;
        place-items: center;
        background: radial-gradient(circle at top, #11253b 0%, #05070c 62%);
        color: #e8f1ff;
        font-family: "Segoe UI", sans-serif;
      }
      .panel {
        width: min(520px, 86vw);
        padding: 28px;
        border: 1px solid rgba(255, 255, 255, 0.16);
        border-radius: 18px;
        background: rgba(3, 9, 17, 0.76);
        backdrop-filter: blur(8px);
      }
      .title { margin: 0 0 8px; font-size: 22px; }
      .message { margin: 0; color: #bad0ea; line-height: 1.6; }
      .pulse {
        width: 12px;
        height: 12px;
        border-radius: 999px;
        background: #2dd4bf;
        box-shadow: 0 0 0 0 rgba(45, 212, 191, 0.75);
        animation: pulse 1.8s infinite;
        margin-bottom: 18px;
      }
      @keyframes pulse {
        0% { box-shadow: 0 0 0 0 rgba(45, 212, 191, 0.75); }
        70% { box-shadow: 0 0 0 14px rgba(45, 212, 191, 0); }
        100% { box-shadow: 0 0 0 0 rgba(45, 212, 191, 0); }
      }
      code {
        color: #f9c46b;
        background: rgba(255, 255, 255, 0.08);
        padding: 2px 8px;
        border-radius: 6px;
      }
    </style>
  </head>
  <body>
    <section class="panel">
      <div class="pulse"></div>
      <h1 class="title">QBZ Downloader Desktop</h1>
      <p class="message">${message}</p>
    </section>
  </body>
</html>`;
}

function ensureDir(targetPath) {
  fs.mkdirSync(targetPath, { recursive: true });
}

function copyIfMissing(sourcePath, targetPath) {
  if (!fs.existsSync(sourcePath) || fs.existsSync(targetPath)) return false;
  ensureDir(path.dirname(targetPath));
  fs.copyFileSync(sourcePath, targetPath);
  return true;
}

function uniqueExisting(paths) {
  const unique = [];
  for (const p of paths) {
    if (!p) continue;
    const normalized = path.resolve(p);
    if (!unique.includes(normalized) && fs.existsSync(normalized)) {
      unique.push(normalized);
    }
  }
  return unique;
}

function resolveRuntimeDir() {
  if (process.env.PORTABLE_EXECUTABLE_DIR) {
    return path.join(process.env.PORTABLE_EXECUTABLE_DIR, 'QBZ-Data');
  }

  if (app.isPackaged) {
    return app.getPath('userData');
  }

  return initialCwd;
}

function migrateLegacyState(targetDir) {
  const markerPath = path.join(targetDir, '.desktop-migrated');
  if (fs.existsSync(markerPath)) return;

  const home = app.getPath('home');
  const docs = app.getPath('documents');
  const exeDir = path.dirname(app.getPath('exe'));
  const candidates = uniqueExisting([
    process.env.QBZ_MIGRATE_FROM,
    initialCwd,
    exeDir,
    path.join(home, 'Project', 'QBZ-Downloader'),
    path.join(docs, 'QBZ-Downloader')
  ]);

  const migrated = [];

  for (const candidate of candidates) {
    const dbSrc = path.join(candidate, 'data', 'qbz.db');
    const dbDst = path.join(targetDir, 'data', 'qbz.db');
    if (copyIfMissing(dbSrc, dbDst)) {
      migrated.push(`data/qbz.db <= ${candidate}`);
      copyIfMissing(path.join(candidate, 'data', 'qbz.db-wal'), path.join(targetDir, 'data', 'qbz.db-wal'));
      copyIfMissing(path.join(candidate, 'data', 'qbz.db-shm'), path.join(targetDir, 'data', 'qbz.db-shm'));
    }

    if (copyIfMissing(path.join(candidate, 'history.json'), path.join(targetDir, 'history.json'))) {
      migrated.push(`history.json <= ${candidate}`);
    }

    if (copyIfMissing(path.join(candidate, 'settings.json'), path.join(targetDir, 'settings.json'))) {
      migrated.push(`settings.json <= ${candidate}`);
    }

    if (migrated.length > 0) {
      break;
    }
  }

  const summary = {
    migratedAt: new Date().toISOString(),
    runtimeDir: targetDir,
    items: migrated
  };

  fs.writeFileSync(markerPath, JSON.stringify(summary, null, 2), 'utf8');
}

function pushUpdateState(partialState) {
  updateState = {
    ...updateState,
    ...partialState,
    checkedAt: new Date().toISOString()
  };

  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('desktop:update-status', updateState);
  }
}

async function loadInlinePage(win, message) {
  const content = createLoadingMarkup(message);
  const dataUri = `data:text/html;charset=UTF-8,${encodeURIComponent(content)}`;
  await win.loadURL(dataUri);
}

async function waitForDashboard(timeoutMs = 45000) {
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    try {
      const response = await fetch(`${DASHBOARD_URL}/api/status`);
      if (response.ok) {
        return true;
      }
    } catch {
    }

    await new Promise((resolve) => setTimeout(resolve, 400));
  }

  return false;
}

async function startBackend() {
  if (backendBootPromise) return backendBootPromise;

  backendBootPromise = (async () => {
    runtimeDir = resolveRuntimeDir();
    ensureDir(runtimeDir);
    ensureDir(path.join(runtimeDir, 'data'));
    ensureDir(path.join(runtimeDir, 'downloads'));

    migrateLegacyState(runtimeDir);
    process.chdir(runtimeDir);

    process.env.DASHBOARD_PORT = String(DESKTOP_PORT);
    process.env.QBZ_DESKTOP = '1';
    process.env.NODE_ENV = process.env.NODE_ENV || (app.isPackaged ? 'production' : 'development');
    process.env.DOWNLOADS_PATH = process.env.DOWNLOADS_PATH || path.join(runtimeDir, 'downloads');

    const serverEntry = path.join(app.getAppPath(), 'dist', 'index.js');
    await import(pathToFileURL(serverEntry).href);
  })();

  return backendBootPromise;
}

function createWindow() {
  const iconPath = path.join(app.getAppPath(), 'assets', 'desktop', 'icon.png');

  const win = new BrowserWindow({
    width: 1480,
    height: 940,
    minWidth: 1120,
    minHeight: 700,
    frame: false,
    icon: fs.existsSync(iconPath) ? iconPath : undefined,
    backgroundColor: '#04070d',
    title: 'QBZ Downloader Desktop',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      spellcheck: false
    }
  });

  win.on('maximize', () => {
    win.webContents.send('desktop:maximize-changed', true);
  });

  win.on('unmaximize', () => {
    win.webContents.send('desktop:maximize-changed', false);
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: 'deny' };
  });

  return win;
}

function setupAutoUpdater() {
  if (!autoUpdater || !app.isPackaged) {
    pushUpdateState({ status: 'disabled', message: 'Auto update only active in packaged builds.' });
    return;
  }

  const rawFeed = process.env.QBZ_UPDATE_URL;
  if (rawFeed) {
    const feed = rawFeed.endsWith('/') ? rawFeed : `${rawFeed}/`;
    autoUpdater.setFeedURL({ provider: 'generic', url: feed });
  }

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('checking-for-update', () => {
    pushUpdateState({ status: 'checking', message: 'Checking for update...', available: false, downloaded: false });
  });

  autoUpdater.on('update-available', (info) => {
    pushUpdateState({
      status: 'available',
      message: `Update ${info.version} found. Downloading...`,
      version: info.version,
      available: true,
      downloaded: false
    });
  });

  autoUpdater.on('update-not-available', (info) => {
    pushUpdateState({
      status: 'up-to-date',
      message: 'You are using the latest version.',
      version: info?.version || app.getVersion(),
      available: false,
      downloaded: false
    });
  });

  autoUpdater.on('download-progress', (progress) => {
    pushUpdateState({
      status: 'downloading',
      message: `Downloading update... ${Math.round(progress.percent)}%`,
      available: true,
      downloaded: false
    });
  });

  autoUpdater.on('update-downloaded', (info) => {
    pushUpdateState({
      status: 'downloaded',
      message: `Update ${info.version} is ready. Restart app to install.`,
      version: info.version,
      available: true,
      downloaded: true
    });
  });

  autoUpdater.on('error', (error) => {
    const message = (error?.message || String(error)).trim();
    const low = message.toLowerCase();
    const channelNotReady =
      low.includes('404') ||
      low.includes('status code 404') ||
      low.includes('not found') ||
      low.includes('cannot find latest') ||
      low.includes('no published versions');

    if (channelNotReady) {
      pushUpdateState({
        status: 'disabled',
        message: 'Update channel is not ready yet. Publish a release first.',
        available: false,
        downloaded: false
      });
      return;
    }

    pushUpdateState({ status: 'error', message: `Update check failed: ${message}` });
  });

  const checkNow = () => autoUpdater.checkForUpdates().catch((error) => {
    const message = (error?.message || String(error)).trim();
    const low = message.toLowerCase();
    const channelNotReady =
      low.includes('404') ||
      low.includes('status code 404') ||
      low.includes('not found') ||
      low.includes('cannot find latest') ||
      low.includes('no published versions');

    if (channelNotReady) {
      pushUpdateState({
        status: 'disabled',
        message: 'Update channel is not ready yet. Publish a release first.',
        available: false,
        downloaded: false
      });
      return;
    }

    pushUpdateState({ status: 'error', message: `Update check failed: ${message}` });
  });

  setTimeout(checkNow, 12000);
  updaterInterval = setInterval(checkNow, 6 * 60 * 60 * 1000);
}

function registerIpc() {
  ipcMain.handle('desktop:app-version', () => app.getVersion());

  ipcMain.handle('desktop:window:minimize', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) win.minimize();
  });

  ipcMain.handle('desktop:window:toggle-maximize', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return;
    if (win.isMaximized()) {
      win.unmaximize();
    } else {
      win.maximize();
    }
  });

  ipcMain.handle('desktop:window:close', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) win.close();
  });

  ipcMain.handle('desktop:window:is-maximized', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    return win ? win.isMaximized() : false;
  });

  ipcMain.handle('desktop:update:get-status', () => updateState);

  ipcMain.handle('desktop:update:check', async () => {
    if (!autoUpdater || !app.isPackaged) {
      return { ok: false, reason: 'disabled' };
    }

    try {
      await autoUpdater.checkForUpdates();
      return { ok: true };
    } catch (error) {
      const message = (error?.message || String(error)).trim();
      const low = message.toLowerCase();
      const channelNotReady =
        low.includes('404') ||
        low.includes('status code 404') ||
        low.includes('not found') ||
        low.includes('cannot find latest') ||
        low.includes('no published versions');

      if (channelNotReady) {
        pushUpdateState({
          status: 'disabled',
          message: 'Update channel is not ready yet. Publish a release first.',
          available: false,
          downloaded: false
        });
        return { ok: false, reason: 'channel-not-ready' };
      }

      pushUpdateState({ status: 'error', message: `Manual update check failed: ${message}` });
      return { ok: false, reason: message };
    }
  });

  ipcMain.handle('desktop:update:install', () => {
    if (!autoUpdater || !app.isPackaged) return { ok: false, reason: 'disabled' };

    setImmediate(() => {
      autoUpdater.quitAndInstall(true, true);
    });

    return { ok: true };
  });
}

async function bootstrap() {
  mainWindow = createWindow();
  await loadInlinePage(mainWindow, 'Starting local backend and loading dashboard...');

  try {
    await startBackend();
    const online = await waitForDashboard();

    if (!mainWindow || mainWindow.isDestroyed()) return;

    if (online) {
      await mainWindow.loadURL(DASHBOARD_URL);
      setupAutoUpdater();
    } else {
      await loadInlinePage(
        mainWindow,
        `Dashboard is not responding on <code>${DASHBOARD_URL}</code>. Please restart the app.`
      );
    }
  } catch (error) {
    if (!mainWindow || mainWindow.isDestroyed()) return;

    const message = error instanceof Error ? error.message : String(error);
    await loadInlinePage(mainWindow, `Failed to start service: <code>${message}</code>`);
  }
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.setAppUserModelId('com.ifauze.qbzdownloader');

  app.on('second-instance', () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  });

  app.whenReady().then(async () => {
    registerIpc();
    await bootstrap();
  });
}

app.on('before-quit', () => {
  if (updaterInterval) {
    clearInterval(updaterInterval);
    updaterInterval = null;
  }
});

app.on('window-all-closed', () => {
  app.quit();
});
