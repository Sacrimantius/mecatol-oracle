import { describe, expect, it } from 'vitest';
import combatLogs from './fixtures/bga_combat_logs.txt?raw';
import fullLog from '/samples/games/sample-1/log.txt?raw';
import { parseBgaGame } from './bgaGame';

describe('parseBgaGame on a full game (the anonymized example sample-1)', () => {
  const game = parseBgaGame(fullLog);
  const player = (name: string) => game.players.find((p) => p.name === name)!;

  it('finds the players, their factions and the winner', () => {
    expect(game.players.map((p) => [p.name, p.factionId])).toEqual(
      expect.arrayContaining([
        ['Player 1', 'jolnar'],
        ['Player 3', 'saar'],
        ['Player 2', 'letnev'],
        ['Player 4', 'mentak'],
      ]),
    );
    expect(game.winner).toBe('Player 1');
    expect(game.lastActionDate).toBe('2026-10-30');
    expect(game.rounds).toBeGreaterThanOrEqual(8);
  });

  it('adds up the score, with the winner ahead', () => {
    // This game was played to 14 points.
    const scores = game.players.map((p) => p.score);
    expect(player('Player 1').score).toBe(14);
    expect(scores.filter((s) => s >= 14)).toHaveLength(1);
    expect(scores.every((s) => s >= 0)).toBe(true);
  });

  it('never spends or loses more trade goods than it gained', () => {
    for (const p of game.players) {
      expect(p.tradeGoods.gained, p.name).toBeGreaterThan(0);
      expect(p.tradeGoods.spent + p.tradeGoods.lost, p.name).toBeLessThanOrEqual(p.tradeGoods.gained);
    }
  });

  it('counts units produced and lost, with their cost', () => {
    for (const p of game.players) {
      expect(p.unitTotals.produced, p.name).toBeGreaterThan(0);
      expect(p.unitTotals.lost, p.name).toBeGreaterThan(0);
    }
    const dreads = player('Player 2').units.dreadnought!;
    expect(dreads.producedCost).toBe(dreads.produced * 4);
    expect(player('Player 3').units.cruiser).toMatchObject({ starting: 1, produced: 10, placed: 1, lost: 12 }); // War Effort
  });

  it('never loses more of a unit than it had', () => {
    for (const p of game.players) {
      for (const [type, t] of Object.entries(p.units)) {
        expect(t!.lost, `${p.name} ${type}`).toBeLessThanOrEqual(t!.starting + t!.produced + t!.placed);
      }
    }
  });

  it('explains every roll with the to-hit values it worked out', () => {
    expect(game.notes.filter((n) => n.includes("don't match"))).toEqual([]);
  });

  it('splits dice luck by space combat and invasion', () => {
    for (const p of game.players) {
      const { space, invasion, total } = p.dice;
      expect(space.dice + invasion.dice, p.name).toBe(total.dice);
      expect(total.hitPercentile, p.name).toBeGreaterThanOrEqual(0);
      expect(total.hitPercentile, p.name).toBeLessThanOrEqual(100);
      expect(total.averageFace, p.name).toBeGreaterThan(1);
    }
  });
});

describe('parseBgaGame on a partial log', () => {
  it('finds players without setup lines and leaves the game unfinished', () => {
    const game = parseBgaGame(combatLogs);
    expect(game.players.map((p) => p.name).sort()).toEqual(['Player 1', 'Player 2', 'Player 3', 'Player 4']);
    expect(game.winner).toBeNull();
  });

  it('works out hit luck from the dice', () => {
    const text = [
      'Ann and Bob started space combat round 1 on ( HOPE ).',
      'Ann rolled 2 dice for 2 hits: Cruiser [ 9 ] [ 10 ] Details',
      'Ann rolled 2 dice for 2 hits: Cruiser [ 7 ] [ 8 ] Details',
      'Ann rolled 1 die for 0 hits: Cruiser [ 2 ] Details',
      'Ann gained 1 trade good(s).',
      'Bob rolled 1 die for 0 hits: Cruiser [ 1 ] Details',
      'Bob gained 1 trade good(s).',
      'Bob rolled 1 die for 0 hits: Cruiser [ 3 ] Details',
    ].join('\n');
    const ann = parseBgaGame(text).players.find((p) => p.name === 'Ann')!;
    // Cruisers hit on 7 (40%): 4 hits from 5 dice beats almost every outcome.
    expect(ann.dice.space).toMatchObject({ dice: 5, hits: 4, expectedHits: 2 });
    expect(ann.dice.space.hitPercentile).toBeGreaterThan(90);
    expect(ann.dice.invasion.dice).toBe(0);
  });
});
