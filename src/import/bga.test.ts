import { describe, expect, it } from 'vitest';
import logs from './fixtures/bga_combat_logs.txt?raw';
import { parseBgaLog, type ImportedCombat, type SideFlags } from './bga';

// The fixture is one 4-player BGA game, newest line first. Its "=== Combat N ===" headers were added by
// hand; real pastes have none, so each block is parsed without its header.
const blocks = logs
  .split(/^=== /m)
  .slice(1)
  .map((block) => {
    const [header, ...rest] = block.split(/\r?\n/);
    return { header, text: rest.join('\n') };
  });

const block = (n: number) => blocks[n - 1].text;
const only = (text: string): ImportedCombat => {
  const { combats } = parseBgaLog(text);
  expect(combats).toHaveLength(1);
  return combats[0];
};
const warnings = (flags: SideFlags) =>
  [...flags.faction, ...Object.values(flags.units), ...Object.values(flags.upgrades), ...Object.values(flags.techs)]
    .flat()
    .filter((f) => f!.level === 'warn')
    .map((f) => f!.message);

const FACTIONS = { Thamsi: 'jolnar', Webbly: 'saar', Amynta: 'letnev', Sacrimantius: 'mentak' };

describe('parseBgaLog on the whole game log', () => {
  const all = parseBgaLog(logs);

  it('finds all 29 combats, newest first', () => {
    expect(all.combats).toHaveLength(29);
    expect(all.combats[0].title).toBe('Webbly attacks Thamsi at ( NAR / JOL )');
    expect(all.combats[28].title).toBe('Webbly invades Sacrimantius at ( ARINAM / MEER )');
  });

  it("points at each combat's lines in the pasted text", () => {
    all.combats.forEach((c, i) => {
      // The selection is exactly the block under its hand-written header.
      expect(logs.slice(c.source.start, c.source.end).trim()).toBe(blocks[i].text.trim());
    });
  });

  it("works out every player's faction", () => {
    expect(all.factions).toEqual(FACTIONS);
  });

  it('explains every roll with some mix of base and upgraded units', () => {
    for (const c of all.combats) {
      for (const role of ['attacker', 'defender'] as const) {
        expect(warnings(c.flags[role]).filter((w) => w.includes("don't match"))).toEqual([]);
      }
    }
  });

  it('carries upgrades and techs seen in earlier combats forward', () => {
    // Combat 1's dice can't tell PDS from PDS II, but Thamsi's PDS II hit on a 5 in combat 16.
    const latest = all.combats[0];
    expect(latest.defender.upgrades.pds).toBe(true);
    expect(latest.flags.defender.upgrades.pds?.[0].message).toContain('earlier combat');
  });
});

describe('parseBgaLog on single combats', () => {
  it('reads every block on its own, attacker first', () => {
    for (const { header, text } of blocks) {
      const combat = only(text);
      const attacker = header.split('|')[2].trim().split(' ')[0];
      expect(combat.players.attacker, header).toBe(attacker);
      expect(combat.players.defender, header).not.toBe('');
      expect(combat.attacker.factionId === '' || combat.attacker.factionId === FACTIONS[attacker as keyof typeof FACTIONS]).toBe(true);
    }
  });

  it('reads the same combat in oldest-first order', () => {
    const reversed = block(1).trim().split(/\r?\n/).reverse().join('\n');
    const a = only(block(1));
    const b = only(reversed);
    expect(b.attacker).toEqual(a.attacker);
    expect(b.defender).toEqual(a.defender);
  });

  it('reads a paste that starts after the activation', () => {
    const lines = block(3).trim().split(/\r?\n/);
    const combat = only(lines.slice(0, -2).join('\n'));
    expect(combat.players).toEqual({ attacker: 'Thamsi', defender: 'Webbly' });
  });

  it('ignores BGA timestamps', () => {
    const stamped = block(2)
      .split(/\r?\n/)
      .map((l) => (l ? `12:34 ${l}` : l))
      .join('\n');
    expect(only(stamped).attacker).toEqual(only(block(2)).attacker);
  });

  it('imports combat 1: space cannon on both sides, assault cannon, AFB and 3 rounds', () => {
    const c = only(block(1));
    expect(c.players).toEqual({ attacker: 'Webbly', defender: 'Thamsi' });
    expect(c.invade).toBe(false);
    expect(c.attacker.counts).toEqual({ dreadnought: 1, carrier: 1, cruiser: 6, fighter: 2, infantry: 3, pds: 2 });
    expect(c.defender.factionId).toBe('jolnar');
    expect(c.defender.counts).toEqual({ dreadnought: 1, carrier: 1, destroyer: 4, fighter: 6, pds: 1 });
    // Destroyer [ 8 ] hit with Fragile's -1 already applied, so they hit on 8: Destroyer II.
    expect(c.defender.upgrades.destroyer).toBe(true);
    expect(c.defender.techs).toEqual(
      expect.arrayContaining(['plasmaScoring', 'antimassDeflectors', 'duraniumArmor', 'assaultCannon', 'magenDefenseGrid']),
    );
    // Webbly's faction isn't visible in this block alone.
    expect(c.attacker.factionId).toBe('');
    expect(c.flags.attacker.faction[0].level).toBe('warn');
    expect(c.flags.attacker.units.pds?.[0].level).toBe('warn');
  });

  it('imports combat 2 and notes the planet that was taken without a fight', () => {
    const c = only(block(2));
    expect(c.attacker.counts).toEqual({ warsun: 1, destroyer: 1, infantry: 2 });
    expect(c.defender.counts).toEqual({ destroyer: 1 });
    expect(c.planet).toBe('LISIS II');
    expect(c.invade).toBe(true);
    expect(c.notes.map((n) => n.message)).toContain("Fighting on RAGH isn't simulated; only LISIS II is.");
  });

  it('leaves out a third player firing Space Cannon, with a warning (combat 3)', () => {
    const c = only(block(3));
    expect(c.players).toEqual({ attacker: 'Thamsi', defender: 'Webbly' });
    expect(c.notes.some((n) => n.level === 'warn' && n.message.startsWith('Amynta fired Space Cannon Offense'))).toBe(true);
    expect(c.defender.counts).toEqual({ flagship: 1, dreadnought: 4, cruiser: 1, destroyer: 1, fighter: 4 });
    // Saar's flagship is the only one with Anti-Fighter Barrage, but that is weaker evidence than a named ability.
    expect(c.defender.factionId).toBe('saar');
    expect(c.flags.defender.faction[0].level).toBe('warn');
  });

  it('reads ambush to-hit values and AFB dice as upgrade evidence (combat 13)', () => {
    const c = only(block(13));
    expect(c.attacker.counts).toMatchObject({ flagship: 1, warsun: 2, dreadnought: 2, destroyer: 2, fighter: 9, pds: 1 });
    expect(c.attacker.upgrades.destroyer).toBe(true); // 3 AFB dice per destroyer
    expect(c.defender.factionId).toBe('mentak');
    expect(c.defender.upgrades.cruiser).toBe(true); // Ambush "to hit on 6-10"
    expect(c.defender.counts).toEqual({ flagship: 1, dreadnought: 2, cruiser: 3, destroyer: 1, fighter: 3 });
    expect(c.invade).toBe(false); // Infantry landed on Amynta's own planet.
  });

  it('sees a base cruiser in an earlier ambush (combat 21)', () => {
    expect(only(block(21)).attacker.upgrades.cruiser).toBe(false); // "to hit on 7-10"
  });

  it('subtracts fleet-limit removals and finds space cannon support (combat 16)', () => {
    const c = only(block(16));
    expect(c.attacker.counts).toEqual({ flagship: 1, dreadnought: 5, carrier: 1, destroyer: 1, fighter: 11, infantry: 1, pds: 3 });
    expect(c.attacker.upgrades.pds).toBe(true);
    expect(c.defender.counts).toEqual({ flagship: 1, dreadnought: 2, carrier: 1, destroyer: 1, fighter: 5, infantry: 2, pds: 2, spacedock: 1 });
    expect(c.summary).toContain('Bombardment blocked by Planetary Shield');
  });

  it("doesn't count ships produced during the combat (combat 10)", () => {
    const c = only(block(10));
    expect(c.attacker.counts.dreadnought).toBe(1);
    expect(c.defender.techs).toEqual(expect.arrayContaining(['gravitonLaserSystem', 'nonEuclideanShielding', 'plasmaScoring']));
    expect(c.flags.defender.faction[0].level).toBe('warn'); // Only a faction tech points to Letnev here.
  });

  it('counts infantry placed by Magen Defense Grid before combat (combat 20)', () => {
    const c = only(block(20));
    expect(c.defender.counts.infantry).toBe(1);
    expect(c.defender.techs).toContain('magenDefenseGrid');
  });

  it('finds units that start damaged (combat 8)', () => {
    // Sacrimantius retreated a damaged dreadnought; it was damaged during this combat, so it started undamaged.
    const c = only(block(8));
    expect(c.defender.damaged).toEqual({});
    expect(c.defender.counts).toMatchObject({ flagship: 1, dreadnought: 2, carrier: 1, destroyer: 2 });
  });

  it('loads the action cards each side played, leaving out cancelled ones', () => {
    const one = only(block(1));
    expect(one.defender.actionCards).toEqual(['shieldsHolding']);
    expect(one.attacker.actionCards).toEqual([]); // Webbly's Shields Holding was cancelled by Sabotage.
    expect(one.notes.map((n) => n.message)).toContain('Cancelled by Sabotage, so left out: SHIELDS HOLDING (Webbly).');
    expect(one.notes.map((n) => n.message)).toContain("Action cards played that aren't simulated: SABOTAGE (Thamsi).");

    expect(only(block(9)).defender.actionCards).toEqual(['bunker']);
    const thirteen = only(block(13));
    expect(thirteen.attacker.actionCards).toEqual(['shieldsHolding']);
    expect(thirteen.defender.actionCards).toEqual(expect.arrayContaining(['maneuveringJets', 'courageousToTheEnd']));
    expect(only(block(21)).attacker.actionCards).toEqual(['fighterPrototype']); // Morale Boost was cancelled.
  });

  it('loads each copy of a card played more than once (combat 18)', () => {
    const c = only(block(18));
    const webbly = c.players.attacker === 'Webbly' ? 'attacker' : 'defender';
    expect(c[webbly].actionCards).toEqual(['maneuveringJets', 'maneuveringJets']);
    expect(c.flags[webbly].actionCards.maneuveringJets).toHaveLength(2);
  });

  it('marks unit upgrades the dice cannot settle', () => {
    const c = only(block(29));
    expect(c.flags.defender.upgrades.fighter?.[0].level).toBe('warn');
    expect(c.defender.upgrades.fighter).toBe(false);
  });
});

describe('starting damage from the log', () => {
  it('reads damaged ships moved in', () => {
    const text = [
      'Ann finished a tactical action in ( HOPE ).',
      "Ann destroyed 1 of Bob's cruiser(s) in ( HOPE ).",
      'Bob rolled 1 die for 0 hits: Cruiser [ 2 ] Details',
      'Ann rolled 1 die for 1 hit: Dreadnought [ 8 ] Details',
      'Ann and Bob started space combat round 1 on ( HOPE ).',
      'Ann added 1 damaged dreadnought(s) to ( HOPE ).',
      'Ann removed 1 damaged dreadnought(s) from ( HOME ).',
      'Ann activated ( HOPE ) to start a tactical action.',
    ].join('\n');
    const c = only(text);
    expect(c.attacker.counts).toEqual({ dreadnought: 1 });
    expect(c.attacker.damaged).toEqual({ dreadnought: 1 });
    expect(c.defender.counts).toEqual({ cruiser: 1 });
  });

  it('infers damage when a ship dies as damaged without being hit first', () => {
    const text = [
      "Ann destroyed 1 of Bob's damaged dreadnought(s) in ( HOPE ).",
      'Bob rolled 1 die for 0 hits: Dreadnought [ 2 ] Details',
      'Ann rolled 1 die for 1 hit: Cruiser [ 8 ] Details',
      'Ann and Bob started space combat round 1 on ( HOPE ).',
      'Ann activated ( HOPE ) to start a tactical action.',
    ].join('\n');
    expect(only(text).defender.damaged).toEqual({ dreadnought: 1 });
  });
});
