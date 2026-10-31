import type { GameRecord } from '../import/bgaGame';

export interface SavedGame {
  record: GameRecord;
  log: string;
}

/** Exposed by electron/preload.cts. Missing in a plain browser (the Vite dev server on its own). */
export interface DesktopBridge {
  saveGame(record: GameRecord, log: string, overwrite: boolean): Promise<{ status: 'saved' | 'exists'; dir: string }>;
  listGames(): Promise<GameRecord[]>;
  loadGame(id: string): Promise<SavedGame>;
}

export const desktop = (window as unknown as { mecatol?: DesktopBridge }).mecatol;

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(await res.text());
  return (await res.json()) as T;
}

/**
 * Reads saved games: through Electron, or in a browser tab on the dev server through its read-only /api/games
 * (vite.config.ts). Null in a built app opened outside Electron, where there's nothing to read from.
 */
export const gameReader: Pick<DesktopBridge, 'listGames' | 'loadGame'> | null = desktop
  ? desktop
  : import.meta.env.DEV
    ? {
        listGames: () => getJson<GameRecord[]>('/api/games'),
        loadGame: (id) => getJson<SavedGame>(`/api/games/${encodeURIComponent(id)}`),
      }
    : null;
