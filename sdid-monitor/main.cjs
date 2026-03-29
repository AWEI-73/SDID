'use strict';

const { app, BrowserWindow, Tray, Menu, dialog, nativeImage, shell } = require('electron');
const path  = require('path');
const http  = require('http');
const fs    = require('fs');

const PORT  = process.env.PORT || 3737;
const LOCK  = app.requestSingleInstanceLock();

// ── Single instance ────────────────────────────────────────────
if (!LOCK) { app.quit(); process.exit(0); }

let win  = null;
let tray = null;

app.on('second-instance', () => {
  if (win) { if (win.isMinimized()) win.restore(); win.focus(); }
});

// ── Wait for server to be ready ────────────────────────────────
function waitForServer(retries = 30) {
  return new Promise((resolve, reject) => {
    function attempt(n) {
      const req = http.get(`http://localhost:${PORT}/api/projects`, res => {
        res.destroy();
        resolve();
      });
      req.on('error', () => {
        if (n <= 0) return reject(new Error('Server did not start in time'));
        setTimeout(() => attempt(n - 1), 300);
      });
      req.setTimeout(500, () => { req.destroy(); setTimeout(() => attempt(n - 1), 300); });
    }
    attempt(retries);
  });
}

// ── Window state persistence ───────────────────────────────────
const STATE_FILE = path.join(app.getPath('userData'), 'window-state.json');

function loadWinState() {
  try { return JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8')); } catch { return null; }
}

function saveWinState(w) {
  if (w.isMaximized() || w.isMinimized()) return;
  const b = w.getBounds();
  try { fs.writeFileSync(STATE_FILE, JSON.stringify(b), 'utf-8'); } catch {}
}

// ── App ready ─────────────────────────────────────────────────
app.whenReady().then(async () => {
  // Workspace selection
  if (!process.env.WORKSPACE_ROOT) {
    const selected = dialog.showOpenDialogSync({
      title: 'Select SDID Workspace Directory',
      properties: ['openDirectory'],
    });
    if (!selected?.length) { app.quit(); return; }
    process.env.WORKSPACE_ROOT = selected[0];
  }

  // Start embedded server
  require('./server.cjs');

  // Wait for it to be ready
  try {
    await waitForServer();
  } catch {
    dialog.showErrorBox('SDID Monitor', 'Server failed to start.');
    app.quit();
    return;
  }

  // Create window
  const saved = loadWinState();
  win = new BrowserWindow({
    width:  saved?.width  || 1400,
    height: saved?.height || 900,
    x: saved?.x,
    y: saved?.y,
    minWidth:  900,
    minHeight: 600,
    title: 'SDID Monitor',
    autoHideMenuBar: true,
    backgroundColor: '#0d0d0f',
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  win.loadURL(`http://localhost:${PORT}`);
  win.once('ready-to-show', () => win.show());

  win.on('resize',  () => saveWinState(win));
  win.on('move',    () => saveWinState(win));

  win.on('close', (e) => {
    if (process.platform !== 'darwin' && tray) {
      e.preventDefault();
      win.hide();
    }
  });

  // Tray
  tray = new Tray(nativeImage.createEmpty());
  tray.setToolTip('SDID Monitor');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Show',       click: () => { win.show(); win.focus(); } },
    { label: 'Open in Browser', click: () => shell.openExternal(`http://localhost:${PORT}`) },
    { type: 'separator' },
    { label: 'Quit SDID Monitor', click: () => { win.destroy(); app.quit(); } },
  ]));
  tray.on('double-click', () => { win.show(); win.focus(); });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    // Don't quit — tray keeps it alive
  }
});

app.on('before-quit', () => {
  if (tray) { tray.destroy(); tray = null; }
});
