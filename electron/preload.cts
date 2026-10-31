import { contextBridge, ipcRenderer } from 'electron';

// The renderer's only way to touch the disk: saving and reading game records and their logs under games/.
contextBridge.exposeInMainWorld('mecatol', {
  saveGame: (record: unknown, log: string, overwrite: boolean) => ipcRenderer.invoke('games:save', record, log, overwrite),
  listGames: () => ipcRenderer.invoke('games:list'),
  loadGame: (id: string) => ipcRenderer.invoke('games:load', id),
});
