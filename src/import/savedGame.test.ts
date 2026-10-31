import { describe, expect, it } from 'vitest';
import combatLogs from './fixtures/bga_combat_logs.txt?raw';
import fullLog from '/samples/games/sample-1/log.txt?raw';
import { gameCombats } from './savedGame';


describe('gameCombats', () => {
  it('lists the fixture combats oldest first, each with its own lines', () => {
    const combats = gameCombats(combatLogs);
    expect(combats).toHaveLength(29);
    expect(combats.map((c) => c.number)).toEqual(combats.map((_, i) => i + 1));
    for (const { combat, lines } of combats) {
      const activation = lines.findIndex((l) => / activated \( .+ \) to start a tactical action/.test(l));
      const finish = lines.findIndex((l) => / finished a tactical action/.test(l));
      // Oldest first: the activation opens the combat and the finish (when there is one) closes it.
      expect(activation).toBeLessThanOrEqual(1);
      if (finish >= 0) expect(finish).toBe(lines.length - 1);
      expect(lines.some((l) => l.includes(combat.players.attacker))).toBe(true);
    }
  });

  it('gives each combat of a full game its round, never going back', () => {
    const combats = gameCombats(fullLog);
    expect(combats.length).toBeGreaterThan(0);
    const rounds = combats.map((c) => c.round);
    expect(rounds.every((r) => r !== null && r >= 1)).toBe(true);
    expect(rounds).toEqual([...rounds].sort((a, b) => a! - b!));
  });
});
