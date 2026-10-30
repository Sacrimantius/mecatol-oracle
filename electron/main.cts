import { app, BrowserWindow } from 'electron';
import path from 'node:path';

const devServerArg = process.argv.find((arg) => arg.startsWith('--dev-server='));
const devServerUrl = devServerArg?.slice('--dev-server='.length);

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1360,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    title: 'Mecatol Oracle',
    backgroundColor: '#0a0e1a',
    webPreferences: {
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    },
  });
  win.setMenuBarVisibility(false);

  if (devServerUrl && !app.isPackaged) {
    void win.loadURL(devServerUrl);
  } else {
    void win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
