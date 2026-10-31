import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { defineConfig, type Plugin } from 'vitest/config';
import react from '@vitejs/plugin-react';

/**
 * Serves games/ read-only at /api/games while developing, so the Games tab works in a plain browser tab too.
 * Only the dev server has it: built files never contain saved games. Electron reads them in electron/main.cts.
 */
function savedGames(): Plugin {
  const dir = path.resolve('games');
  return {
    name: 'saved-games',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/api/games', async (req, res) => {
        const send = (status: number, body: unknown) => {
          res.statusCode = status;
          res.setHeader('Content-Type', status === 200 ? 'application/json' : 'text/plain');
          res.end(status === 200 ? JSON.stringify(body) : String(body));
        };
        const id = decodeURIComponent((req.url ?? '/').replace(/^\//, '').replace(/[?#].*$/, ''));
        try {
          if (!id) {
            const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
            const records = await Promise.all(
              entries
                .filter((e) => e.isDirectory())
                .map((e) => readFile(path.join(dir, e.name, 'game.json'), 'utf8').then(JSON.parse).catch(() => null)),
            );
            send(
              200,
              records.filter(Boolean).sort((a, b) => (b.startDate ?? '').localeCompare(a.startDate ?? '')),
            );
          } else if (/^[\w-]+$/.test(id)) {
            const [record, log] = await Promise.all([
              readFile(path.join(dir, id, 'game.json'), 'utf8').then(JSON.parse),
              readFile(path.join(dir, id, 'log.txt'), 'utf8'),
            ]);
            send(200, { record, log });
          } else {
            send(400, 'Bad game number');
          }
        } catch (e) {
          send(404, e instanceof Error ? e.message : String(e));
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), savedGames()],
  // Relative asset paths so the built app loads from file:// inside Electron.
  base: './',
  server: { port: 5173, strictPort: true },
  test: { include: ['src/**/*.test.ts'] },
});
