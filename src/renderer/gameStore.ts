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

type GameReader = Pick<DesktopBridge, 'listGames' | 'loadGame'>;

// Anonymized example games committed in samples/games/, bundled into every build so the web app has something to
// open. The logs are lazy chunks, fetched only when a game is opened.
const sampleRecords = Object.values(
  import.meta.glob<GameRecord>('/samples/games/*/game.json', { eager: true, import: 'default' }),
);
const sampleLogs = import.meta.glob<string>('/samples/games/*/log.txt', { query: '?raw', import: 'default' });

export const isSample = (id: string) => sampleRecords.some((r) => r.id === id);

/** "Table 123456789" for a BGA game, "Example game sample-1" for a bundled one. */
export const gameTitle = (id: string) => (isSample(id) ? `Example game ${id}` : `Table ${id}`);

/** Saved games: through Electron, or in a browser tab on the dev server through its read-only /api/games
 * (vite.config.ts). Null in a built app opened outside Electron, where only the examples are available. */
const localReader: GameReader | null = desktop
  ? desktop
  : import.meta.env.DEV
    ? {
        listGames: () => getJson<GameRecord[]>('/api/games'),
        loadGame: (id) => getJson<SavedGame>(`/api/games/${encodeURIComponent(id)}`),
      }
    : null;

/** Local saved games first, then the bundled examples. */
export const gameReader: GameReader = {
  listGames: async () => [...((await localReader?.listGames()) ?? []), ...sampleRecords],
  loadGame: async (id) => {
    const record = sampleRecords.find((r) => r.id === id);
    if (!record) {
      if (!localReader) throw new Error('Saved games open in the desktop app (npm run dev), or on the dev server.');
      return localReader.loadGame(id);
    }
    return { record, log: await sampleLogs[`/samples/games/${id}/log.txt`]() };
  },
};
