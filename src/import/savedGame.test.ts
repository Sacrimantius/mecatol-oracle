import { describe, expect, it } from 'vitest';
import combatLogs from './fixtures/bga_combat_logs.txt?raw';
import fullLog from '/samples/games/sample-1/log.txt?raw';
import { gameCombats } from './savedGame';
import { getFaction, getUnitDefinition } from '../engine/data/factions';
import { TECHS } from '../engine/data/techs';
import type { UnitType } from '../engine/types';

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

describe('tech state in a full game', () => {
  const researchLines = [...fullLog.matchAll(/^(.+?) researched (.+?)(?: and used:.*)?\.?\r?$/gm)];
  /** What a player had researched before a combat. The sample is newest first, so earlier lines come later. */
  const researchedBefore = (player: string, end: number) =>
    researchLines.filter((m) => m[1] === player && m.index! > end).map((m) => m[2].toUpperCase());
  const techName = (id: string) => TECHS.find((t) => t.id === id)!.name.toUpperCase().replace(/ Ω$/, '');

  it('gives each side exactly its starting techs and the techs and upgrades researched before the combat', () => {
    for (const { number, combat } of gameCombats(fullLog)) {
      for (const role of ['attacker', 'defender'] as const) {
        const side = combat[role];
        const faction = getFaction(side.factionId);
        const researched = researchedBefore(combat.players[role], combat.source.end);
        const expected = TECHS.filter(
          (t) => faction.startingTechs?.includes(t.id) || researched.includes(techName(t.id)),
        ).map((t) => t.id);
        expect([...side.techs].sort(), `combat ${number} ${role}`).toEqual(expected.sort());
        for (const [type, upgraded] of Object.entries(side.upgrades)) {
          const name = getUnitDefinition(faction, type as UnitType).upgraded!.name.toUpperCase();
          expect(upgraded, `combat ${number} ${role} ${name}`).toBe(researched.includes(name));
        }
      }
    }
  });

  it('leaves no tech or upgrade warnings when the log goes back to the setup', () => {
    for (const { combat } of gameCombats(fullLog)) {
      for (const role of ['attacker', 'defender'] as const) {
        const { techs, upgrades } = combat.flags[role];
        const warns = [...Object.values(techs), ...Object.values(upgrades)].flat().filter((f) => f?.level === 'warn');
        expect(warns).toEqual([]);
      }
    }
  });

  it("still uses research lines without the setup, but doesn't treat missing ones as proof", () => {
    const partial = fullLog.slice(0, fullLog.indexOf('Round 1, Strategy Phase'));
    const combats = gameCombats(partial);
    const late = combats[combats.length - 1].combat;
    expect(late.attacker.techs.length + late.defender.techs.length).toBeGreaterThan(0);
    const warns = combats.flatMap(({ combat }) =>
      (['attacker', 'defender'] as const).flatMap((role) =>
        Object.values(combat.flags[role].upgrades).flat().filter((f) => f?.level === 'warn'),
      ),
    );
    expect(warns.length).toBeGreaterThan(0);
  });
});
