import { cleanLine, isNewestFirst, parseBgaLog, type ImportedCombat } from './bga';

/** One combat of a saved game, in the order the game played them. */
export interface GameCombat {
  /** 1 for the game's first combat. */
  number: number;
  /** The game round it was fought in, or null when the log has no "Round N, …" lines. */
  round: number | null;
  combat: ImportedCombat;
  /** The combat's log lines, oldest first, timestamps removed. */
  lines: string[];
}

/**
 * Every combat in a whole game log, oldest first, with its round and its own lines. Tactical actions with no combat
 * step (moving into an empty system, landing on an undefended planet) are left out.
 */
export function gameCombats(log: string): GameCombat[] {
  const newestFirst = isNewestFirst(log.split('\n').map(cleanLine).filter(Boolean));
  const rounds = [...log.matchAll(/^[ \t]*Round (\d+), /gm)].map((m) => ({ at: m.index, round: Number(m[1]) }));
  const combats = [...parseBgaLog(log).combats].reverse().filter((c) => c.summary);
  return combats.map((combat, i) => {
    const { start, end } = combat.source;
    // A round's header is its oldest line: below the round's lines when BGA shows them newest first.
    const header = newestFirst
      ? rounds.find((r) => r.at >= end)
      : [...rounds].reverse().find((r) => r.at < start);
    const lines = log.slice(start, end).split('\n').map(cleanLine).filter(Boolean);
    return { number: i + 1, round: header?.round ?? null, combat, lines: newestFirst ? lines.reverse() : lines };
  });
}
