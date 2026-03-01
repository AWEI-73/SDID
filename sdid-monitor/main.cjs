const { app, BrowserWindow, dialog } = require('electron');
const path = require('path');

app.whenReady().then(() => {
    // if no WORKSPACE_ROOT via env, prompt user
    if (!process.env.WORKSPACE_ROOT) {
        const selected = dialog.showOpenDialogSync({
            title: 'Select SDID Workspace Directory (e.g. Desktop/SDID)',
            properties: ['openDirectory']
        });

        if (!selected || selected.length === 0) {
            app.quit();
            return;
        }
        process.env.WORKSPACE_ROOT = selected[0];
    }

    // start server
    require('./server.cjs');

    const win = new BrowserWindow({
        width: 1200,
        height: 800,
        title: 'SDID Monitor',
        autoHideMenuBar: true,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true
        }
    });

    win.loadURL(`http://localhost:${process.env.PORT || 3737}`);
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});
