import { app, BrowserWindow, ipcMain } from 'electron';
import { existsSync } from 'node:fs';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const devServerArg = process.argv.find((arg) => arg.startsWith('--dev-server='));
const devServerUrl = devServerArg?.slice('--dev-server='.length);

/** games/ in the repo while developing; the app's data folder once installed. */
const gamesDir = () => path.join(app.isPackaged ? app.getPath('userData') : process.cwd(), 'games');

/** The folder of game `id`, refusing anything that could step outside games/. */
function gameDir(id: unknown): string {
  if (typeof id !== 'string' || !/^[\w-]+$/.test(id)) {
    throw new Error('The game number may only contain letters, digits, - and _.');
  }
  return path.join(gamesDir(), id);
}

// Every saved game's record (not its log), newest first. Folders without a readable game.json are skipped.
ipcMain.handle('games:list', async () => {
  const entries = await readdir(gamesDir(), { withFileTypes: true }).catch(() => []);
  const records = await Promise.all(
    entries
      .filter((e) => e.isDirectory())
      .map((e) =>
        readFile(path.join(gamesDir(), e.name, 'game.json'), 'utf8')
          .then((text) => JSON.parse(text) as { startDate?: string })
          .catch(() => null),
      ),
  );
  return records
    .filter((r) => r !== null)
    .sort((a, b) => (b.startDate ?? '').localeCompare(a.startDate ?? ''));
});

// A saved game's record and the log it was built from.
ipcMain.handle('games:load', async (_event, id: unknown) => {
  const dir = gameDir(id);
  const [record, log] = await Promise.all([
    readFile(path.join(dir, 'game.json'), 'utf8').then((text) => JSON.parse(text)),
    readFile(path.join(dir, 'log.txt'), 'utf8'),
  ]);
  return { record, log };
});

// Writes games/<id>/game.json and log.txt. Won't replace an existing game unless asked to.
ipcMain.handle('games:save', async (_event, record: { id?: unknown }, log: string, overwrite: boolean) => {
  const dir = gameDir(record?.id);
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
