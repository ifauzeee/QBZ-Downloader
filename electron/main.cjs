const { app, BrowserWindow, ipcMain, shell, Notification, nativeTheme } = require('electron');
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

const baseAppPath = app.isPackaged ? app.getAppPath() : path.join(__dirname, '..');
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
    <meta http-equiv="Content-Security-Policy" content="default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline';">
    <title>QBZ Downloader</title>
    <style>
      :root {
        --bg: #05070a;
        --accent: #2dd4bf;
        --accent-glow: rgba(45, 212, 191, 0.35);
        --text: #e8f1ff;
        --text-dim: #94a3b8;
        --glass: rgba(255, 255, 255, 0.03);
        --border: rgba(255, 255, 255, 0.08);
      }

      html, body { 
        height: 100%; 
        margin: 0; 
        overflow: hidden;
        background: var(--bg);
        color: var(--text);
        font-family: "Inter", "Segoe UI", system-ui, -apple-system, sans-serif;
      }

      body {
        display: grid;
        place-items: center;
        position: relative;
      }

      /* Mesh Gradients */
      body::before, body::after {
        content: "";
        position: absolute;
        width: 60vmax;
        height: 60vmax;
        border-radius: 50%;
        filter: blur(80px);
        opacity: 0.15;
        z-index: -1;
        animation: drift 20s infinite alternate linear;
      }

      body::before {
        background: radial-gradient(circle, #2dd4bf, transparent 70%);
        top: -10%;
        left: -10%;
      }

      body::after {
        background: radial-gradient(circle, #6366f1, transparent 70%);
        bottom: -10%;
        right: -10%;
        animation-delay: -10s;
      }

      @keyframes drift {
        from { transform: translate(0, 0) rotate(0deg) scale(1); }
        to { transform: translate(10%, 10%) rotate(180deg) scale(1.2); }
      }

      .panel {
        width: min(500px, 88vw);
        padding: 48px;
        border: 1px solid var(--border);
        border-radius: 32px;
        background: var(--glass);
        backdrop-filter: blur(24px);
        box-shadow: 0 20px 50px rgba(0, 0, 0, 0.4);
        text-align: center;
        animation: slideUp 0.8s cubic-bezier(0.2, 0.8, 0.2, 1);
      }

      @keyframes slideUp {
        from { opacity: 0; transform: translateY(30px); }
        to { opacity: 1; transform: translateY(0); }
      }

      .loader-wrap {
        position: relative;
        width: 64px;
        height: 64px;
        margin: 0 auto 32px;
      }

      .pulse {
        position: absolute;
        top: 0; left: 0; right: 0; bottom: 0;
        border-radius: 50%;
        background: var(--accent);
        box-shadow: 0 0 30px var(--accent-glow);
        animation: pulseRing 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
      }

      .pulse-inner {
        position: absolute;
        top: 20px; left: 20px; right: 20px; bottom: 20px;
        border-radius: 50%;
        background: #fff;
        box-shadow: 0 0 20px #fff;
        z-index: 2;
      }

      @keyframes pulseRing {
        0% { transform: scale(0.8); opacity: 0.5; }
        50% { transform: scale(1); opacity: 1; }
        100% { transform: scale(0.8); opacity: 0.5; }
      }

      .title { 
        margin: 0 0 12px; 
        font-size: 28px; 
        font-weight: 800;
        letter-spacing: -0.02em;
        background: linear-gradient(to bottom, #fff, #94a3b8);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
      }

      .message { 
        margin: 0; 
        color: var(--text-dim); 
        line-height: 1.6;
        font-size: 16px;
      }

      .project-copy {
        margin: 24px 0 0;
        color: rgba(148, 163, 184, 0.6);
        line-height: 1.6;
        font-size: 13px;
        padding-top: 24px;
        border-top: 1px solid var(--border);
      }

      .project-links {
        margin-top: 24px;
        display: flex;
        justify-content: center;
      }

      .project-link {
        display: inline-flex;
        align-items: center;
        gap: 10px;
        padding: 12px 24px;
        border-radius: 14px;
        background: #fff;
        color: #000;
        text-decoration: none;
        font-size: 14px;
        font-weight: 700;
        transition: all 0.3s ease;
      }

      .project-link:hover {
        transform: translateY(-2px);
        box-shadow: 0 10px 20px rgba(0, 0, 0, 0.2);
        background: var(--accent);
      }

      code {
        color: var(--accent);
        background: rgba(45, 212, 191, 0.1);
        padding: 2px 6px;
        border-radius: 4px;
        font-family: monospace;
      }
    </style>
  </head>
  <body>
    <section class="panel">
      <div class="loader-wrap">
        <div class="pulse"></div>
        <div class="pulse-inner"></div>
      </div>
      <h1 class="title">QBZ Downloader</h1>
      <p class="message">${message}</p>
      <p class="project-copy">
        Premium desktop downloader for Qobuz with Hi-Res audio, metadata automation,
        synchronized lyrics, and local-first settings.
      </p>
      <div class="project-links">
        <a
          class="project-link"
          href="https://github.com/ifauzeee/QBZ-Downloader"
          target="_blank"
          rel="noreferrer noopener"
        >
          View on GitHub
        </a>
      </div>
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

    const serverEntry = path.join(baseAppPath, 'dist', 'index.js');
    await import(pathToFileURL(serverEntry).href);

    // Setup Native Notifications Bridge
    try {
      const notifServicePath = path.join(baseAppPath, 'dist', 'services', 'notifications.js');
      const { notificationService } = await import(pathToFileURL(notifServicePath).href);
      
      notificationService.on('notification', (notif) => {
        if (!Notification.isSupported()) return;
        
        const iconPath = path.join(baseAppPath, 'assets', 'desktop', 'icon.png');
        new Notification({
          title: notif.title || 'QBZ Downloader',
          body: notif.message,
          icon: fs.existsSync(iconPath) ? iconPath : undefined,
          silent: false
        }).show();
      });
    } catch (err) {
      console.error('Failed to bridge notification service:', err);
    }
  })();

  return backendBootPromise;
}

function createWindow() {
  const iconPath = path.join(baseAppPath, 'assets', 'desktop', 'icon.png');

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
      spellcheck: false,
      webSecurity: true,
      allowRunningInsecureContent: false
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

function setupSecurityHeaders() {
  const { session } = require('electron');
  
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    // Only apply to our dashboard
    if (details.url.startsWith(DASHBOARD_URL) || details.url.startsWith('data:')) {
      const existingCsp = details.responseHeaders['content-security-policy'] || details.responseHeaders['Content-Security-Policy'];
      
      // If we already have a CSP (from Express), we might want to ensure media-src is there
      // But actually, it's cleaner to just set a unified one here for Electron
      details.responseHeaders['Content-Security-Policy'] = [
        "default-src 'self'; " +
        "script-src 'self' 'unsafe-inline' 'unsafe-eval'; " +
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
        "img-src 'self' data: https: http: blob:; " +
        "media-src 'self' data: blob: https: http:; " +
        "connect-src 'self' ws: wss: http: https:; " +
        "font-src 'self' data: https: https://fonts.gstatic.com;"
      ];
    }
    
    callback({ responseHeaders: details.responseHeaders });
  });
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







  // Proxy player events between windows
  ipcMain.on('desktop:player:event', (event, type, data) => {
    const windows = BrowserWindow.getAllWindows();
    for (const win of windows) {
      if (win.webContents !== event.sender) {
        win.webContents.send('desktop:player:event', type, data);
      }
    }
  });

  ipcMain.on('desktop:show-notification', (event, { title, body }) => {
    if (!Notification.isSupported()) return;
    const iconPath = path.join(baseAppPath, 'assets', 'desktop', 'icon.png');
    new Notification({
      title: title || 'QBZ Downloader',
      body: body,
      icon: fs.existsSync(iconPath) ? iconPath : undefined
    }).show();
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
      setupEventBridge().catch(err => console.error('Failed to setup event bridge:', err));
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

async function setupEventBridge() {
  try {
    const eventsPath = path.join(baseAppPath, 'dist', 'utils', 'events.js');
    if (!fs.existsSync(eventsPath)) return;

    const { eventBus, EVENTS } = await import(pathToFileURL(eventsPath).href);
    
    eventBus.on(EVENTS.DOWNLOAD.PROGRESS, (progress) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.setProgressBar(progress);
      }
    });

    console.log('Event bridge established: Taskbar progress enabled.');
  } catch (error) {
    console.error('Event bridge failure:', error);
  }
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.setAppUserModelId('com.ifauze.qbzdownloader');

  // Disable Autofill features to prevent "Autofill.enable not found" errors in console
  app.commandLine.appendSwitch('disable-features', 'AutofillServerCommunication');

  app.on('second-instance', () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  });

  app.whenReady().then(async () => {
    setupSecurityHeaders();
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
