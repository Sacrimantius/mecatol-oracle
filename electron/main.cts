import { app, BrowserWindow, ipcMain } from 'electron';
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const devServerArg = process.argv.find((arg) => arg.startsWith('--dev-server='));
const devServerUrl = devServerArg?.slice('--dev-server='.length);

/** games/ in the repo while developing; the app's data folder once installed. */
const gamesDir = () => path.join(app.isPackaged ? app.getPath('userData') : process.cwd(), 'games');

// Writes games/<id>/game.json and log.txt. Won't replace an existing game unless asked to.
ipcMain.handle('games:save', async (_event, record: { id?: unknown }, log: string, overwrite: boolean) => {
  const id = typeof record?.id === 'string' ? record.id : '';
  if (!/^[\w-]+$/.test(id)) throw new Error('The game number may only contain letters, digits, - and _.');
  const dir = path.join(gamesDir(), id);
  if (existsSync(dir) && !overwrite) return { status: 'exists', dir };
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, 'game.json'), `${JSON.stringify(record, null, 2)}\n`, 'utf8');
  await writeFile(path.join(dir, 'log.txt'), log, 'utf8');
  return { status: 'saved', dir };
});

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
      preload: path.join(__dirname, 'preload.cjs'),
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
