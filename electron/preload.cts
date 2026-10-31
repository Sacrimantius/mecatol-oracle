import { contextBridge, ipcRenderer } from 'electron';

// The renderer's only way to touch the disk: saving a game record and its log under games/.
contextBridge.exposeInMainWorld('mecatol', {
  saveGame: (record: unknown, log: string, overwrite: boolean) => ipcRenderer.invoke('games:save', record, log, overwrite),
});
