import { describe, expect, it } from 'vitest';
import { runSimulation, simulateOnce } from './simulate';
import type { ScenarioOptions, SideInput, SimulationInput } from './types';

const side = (factionId: string, counts: SideInput['counts'], extra: Partial<SideInput> = {}): SideInput => ({
  factionId,
  counts,
  upgrades: {},
  techs: [],
  ...extra,
});

const options = (o: Partial<ScenarioOptions> = {}): ScenarioOptions => ({
  iterations: 20000,
  invade: false,
  wormhole: false,
  seed: 12345,
  ...o,
});

const input = (attacker: SideInput, defender: SideInput, o?: Partial<ScenarioOptions>): SimulationInput => ({
  attacker,
  defender,
  options: options(o),
});

/** Every die rolls a 10. */
const alwaysTen = () => 0.95;

describe('runSimulation', () => {
  it('matches the analytic odds for a single 50% duel', () => {
    // Cruiser II hits on 6+: each side wins 1/3, draws 1/3.
    const cruiser = side('arborec', { cruiser: 1 }, { upgrades: { cruiser: true } });
    const result = runSimulation(input(cruiser, cruiser));
    expect(result.overall.attacker).toBeCloseTo(1 / 3, 1);
    expect(result.overall.defender).toBeCloseTo(1 / 3, 1);
    expect(result.overall.draw).toBeCloseTo(1 / 3, 1);
  });

  it('gives identical fleets roughly even odds', () => {
    const fleet = side('hacan', { dreadnought: 2, carrier: 1, fighter: 3 });
    const result = runSimulation(input(fleet, fleet));
    expect(Math.abs(result.overall.attacker - result.overall.defender)).toBeLessThan(0.03);
  });

  it('is reproducible with a seed', () => {
    const a = side('sol', { carrier: 2, fighter: 4 });
    const d = side('xxcha', { cruiser: 2, destroyer: 2 });
    expect(runSimulation(input(a, d)).overall).toEqual(runSimulation(input(a, d)).overall);
  });

  it('lets a war sun beat two basic fighters almost always', () => {
    const result = runSimulation(input(side('muaat', { warsun: 1 }), side('hacan', { fighter: 2 })));
    expect(result.overall.attacker).toBeGreaterThan(0.95);
  });

  it('reports invasion odds only when invading', () => {
    const a = side('sardakk', { carrier: 1, infantry: 4 });
    const d = side('arborec', { infantry: 2 });
    expect(runSimulation(input(a, d)).invasion).toBeNull();
    const invaded = runSimulation(input(a, d, { invade: true }));
    expect(invaded.invasion).not.toBeNull();
    expect(invaded.space.noCombat).toBe(1);
    expect(invaded.overall.attacker).toBeGreaterThan(0.6);
  });
});

describe('simulateOnce with fixed dice', () => {
  it('blocks bombardment with a planetary shield', () => {
    const a = side('letnev', { dreadnought: 1, infantry: 1 }, { techs: ['l4Disruptors'] });
    const d = side('arborec', { infantry: 1, pds: 1 });
    const result = simulateOnce(input(a, d, { invade: true }), alwaysTen);
    // No bombardment, so the infantry trade hits and both die.
    expect(result.invasion).toBe('draw');
  });

  it('lets a war sun bombard through the planetary shield', () => {
    const a = side('letnev', { warsun: 1, infantry: 1 }, { techs: ['l4Disruptors'] });
    const d = side('arborec', { infantry: 1, pds: 1 });
    const result = simulateOnce(input(a, d, { invade: true }), alwaysTen);
    expect(result.invasion).toBe('captured');
    expect(result.survivors.defender.pds).toBeUndefined();
  });

  it('gives the Jol-Nar flagship 2 extra hits per natural 9 or 10', () => {
    // 2 dice, both natural 10s: 2 + 4 = 6 hits.
    const result = simulateOnce(input(side('jolnar', { flagship: 1 }), side('naalu', { fighter: 7 })), alwaysTen);
    expect(result.survivors.defender.fighter).toBe(1);
  });

  it('stops Sustain Damage with the Mentak flagship', () => {
    // The dreadnought would survive one hit by sustaining, but Mentak's flagship prevents it.
    const d = side('hacan', { dreadnought: 1 });
    const withMentak = simulateOnce(input(side('mentak', { flagship: 1 }), d), alwaysTen);
    expect(withMentak.survivors.defender.dreadnought).toBeUndefined();
  });

  it('blocks Sustain Damage in the round the Mentak flagship is destroyed', () => {
    // Letnev attacks and destroys the defending Fourth Moon, whose 2 simultaneous hits must still
    // land without Sustain Damage, so both dreadnoughts die.
    const letnev = side('letnev', { dreadnought: 2 });
    const mentak = side('mentak', { flagship: 1 });
    const result = simulateOnce(input(letnev, mentak), alwaysTen);
    expect(result.survivors.attacker).toEqual({});
    expect(result.survivors.defender).toEqual({});
  });

  it('starts damaged units without Sustain Damage', () => {
    // An undamaged dreadnought absorbs the cruiser's hit and wins; a damaged one dies with it.
    const cruiser = side('hacan', { cruiser: 1 });
    const fresh = side('arborec', { dreadnought: 1 });
    const damaged = side('arborec', { dreadnought: 1 }, { damaged: { dreadnought: 1 } });
    expect(simulateOnce(input(fresh, cruiser), alwaysTen).winner).toBe('attacker');
    expect(simulateOnce(input(damaged, cruiser), alwaysTen).winner).toBe('draw');
  });

  it("fires the attacker's PDS during Space Cannon Offense", () => {
    // The PDS kills the lone defending fighter before space combat starts.
    const a = side('arborec', { cruiser: 1, pds: 1 });
    const d = side('hacan', { fighter: 1 });
    const result = simulateOnce(input(a, d), alwaysTen);
    expect(result.space).toBe('noCombat');
    expect(result.winner).toBe('attacker');
    expect(result.survivors.attacker).toEqual({ cruiser: 1, pds: 1 });
  });

  it("keeps the attacker's supporting PDS when its fleet is destroyed", () => {
    const a = side('arborec', { fighter: 1, infantry: 2, pds: 1 });
    const d = side('hacan', { dreadnought: 2 });
    const result = simulateOnce(input(a, d, { invade: true }), alwaysTen);
    expect(result.winner).toBe('defender');
    expect(result.survivors.attacker).toEqual({ pds: 1 });
  });

  it('only lets Anti-Fighter Barrage hit fighters', () => {
    const a = side('arborec', { destroyer: 1 });
    const d = side('hacan', { cruiser: 1 });
    // AFB has no fighters to hit; the destroyer and cruiser then trade hits.
    expect(simulateOnce(input(a, d), alwaysTen).winner).toBe('draw');
  });

  it('ignores action cards meant for the other side', () => {
    // Bunker only protects the defender's planets.
    const a = side('letnev', { warsun: 1, infantry: 1 }, { actionCards: ['bunker'] });
    const d = side('arborec', { infantry: 1 });
    expect(simulateOnce(input(a, d, { invade: true }), alwaysTen).invasion).toBe('captured');
  });

  it('destroys all ships when the Yin flagship dies', () => {
    const a = side('yin', { flagship: 1 }, { counts: { flagship: 1, carrier: 2 } });
    const d = side('hacan', { dreadnought: 4 });
    const result = simulateOnce(input(a, d), alwaysTen);
    expect(result.survivors.attacker).toEqual({});
    expect(result.survivors.defender).toEqual({});
  });
});

/** Every die rolls this natural value. */
const always = (n: number) => () => (n - 1) / 10 + 0.05;
/** Dice in this order, then 1s. */
const sequence = (...dice: number[]) => {
  let i = 0;
  return () => ((dice[i++] ?? 1) - 1) / 10 + 0.05;
};
const cards = (actionCards: SideInput['actionCards']) => ({ actionCards });

describe('action cards', () => {
  it('Bunker: -4 to Bombardment against the defender', () => {
    // War sun bombardment hits on 3, so a 6 hits, but not with -4.
    const a = side('letnev', { warsun: 1, infantry: 1 });
    const plain = side('arborec', { infantry: 1 });
    const bunker = side('arborec', { infantry: 1 }, cards(['bunker']));
    expect(simulateOnce(input(a, plain, { invade: true }), always(6)).invasion).toBe('captured');
    // The bombardment misses, and infantry rolling 6s never hit each other.
    expect(simulateOnce(input(a, bunker, { invade: true }), always(6)).invasion).toBe('repelled');
  });

  it('Morale Boost: +1 to combat rolls in the first round', () => {
    const cruiser = side('hacan', { cruiser: 1 });
    const boosted = side('arborec', { cruiser: 1 }, cards(['moraleBoost']));
    expect(simulateOnce(input(side('arborec', { cruiser: 1 }), cruiser), always(6)).winner).toBe('draw');
    expect(simulateOnce(input(boosted, cruiser), always(6)).winner).toBe('attacker');
  });

  it('Fighter Prototype: +2 to fighters in the first round', () => {
    const cruiser = side('hacan', { cruiser: 1 });
    expect(simulateOnce(input(side('arborec', { fighter: 1 }), cruiser), always(7)).winner).toBe('defender');
    const prototype = side('arborec', { fighter: 1 }, cards(['fighterPrototype']));
    expect(simulateOnce(input(prototype, cruiser), always(7)).winner).toBe('draw');
  });

  it('Shields Holding: cancels 2 hits in a space combat round', () => {
    const cruisers = side('hacan', { cruiser: 2 });
    expect(simulateOnce(input(side('arborec', { dreadnought: 1 }), cruisers), alwaysTen).winner).toBe('defender');
    const shielded = side('arborec', { dreadnought: 1 }, cards(['shieldsHolding']));
    expect(simulateOnce(input(shielded, cruisers), alwaysTen).survivors.attacker).toEqual({ dreadnought: 1 });
  });

  it('Direct Hit: destroys a ship that sustains damage', () => {
    const dread = side('hacan', { dreadnought: 1 });
    expect(simulateOnce(input(side('arborec', { cruiser: 1 }), dread), alwaysTen).winner).toBe('defender');
    const direct = side('arborec', { cruiser: 1 }, cards(['directHit']));
    expect(simulateOnce(input(direct, dread), alwaysTen).survivors.defender).toEqual({});
  });

  it('Courageous to the End: a lost ship takes enemy ships with it', () => {
    const destroyers = side('hacan', { destroyer: 2 });
    expect(simulateOnce(input(side('arborec', { cruiser: 1 }), destroyers), alwaysTen).winner).toBe('defender');
    const brave = side('arborec', { cruiser: 1 }, cards(['courageousToTheEnd']));
    expect(simulateOnce(input(brave, destroyers), alwaysTen).survivors.defender).toEqual({});
  });

  it('Emergency Repairs: repairs damaged ships between rounds', () => {
    // Round 1: 2 cruisers die; 3 hits leave one damaged dreadnought. Repaired, it survives round 2.
    const cruisers = side('hacan', { cruiser: 3 });
    expect(simulateOnce(input(side('arborec', { dreadnought: 2 }), cruisers), alwaysTen).winner).toBe('draw');
    const repairs = side('arborec', { dreadnought: 2 }, cards(['emergencyRepairs']));
    expect(simulateOnce(input(repairs, cruisers), alwaysTen).survivors.attacker).toEqual({ dreadnought: 1 });
  });

  it('Maneuvering Jets: cancels a Space Cannon hit', () => {
    const pds = side('hacan', { pds: 1 });
    expect(simulateOnce(input(side('arborec', { cruiser: 1 }), pds), alwaysTen).survivors.attacker).toEqual({});
    const jets = side('arborec', { cruiser: 1 }, cards(['maneuveringJets']));
    expect(simulateOnce(input(jets, pds), alwaysTen).winner).toBe('attacker');
  });

  it("Disable: the defender's PDS can't fire", () => {
    const disable = side('arborec', { cruiser: 1 }, cards(['disable']));
    expect(simulateOnce(input(disable, side('hacan', { pds: 1 })), alwaysTen).winner).toBe('attacker');
  });

  it('Experimental Battlestation: adds Space Cannon 5 x3 for the defender', () => {
    const a = side('arborec', { cruiser: 1 });
    expect(simulateOnce(input(a, side('hacan', { infantry: 1 }), { invade: true }), alwaysTen).winner).toBe('attacker');
    const station = side('hacan', { infantry: 1 }, cards(['experimentalBattlestation']));
    expect(simulateOnce(input(a, station, { invade: true }), alwaysTen).winner).toBe('defender');
  });

  it('Scramble Frequency: rerolls an above-average Space Cannon roll', () => {
    // The PDS rolls a 10, the reroll a 1.
    const pds = side('hacan', { pds: 1 });
    expect(simulateOnce(input(side('arborec', { cruiser: 1 }), pds), sequence(10, 1)).survivors.attacker).toEqual({});
    const scramble = side('arborec', { cruiser: 1 }, cards(['scrambleFrequency']));
    expect(simulateOnce(input(scramble, pds), sequence(10, 1)).winner).toBe('attacker');
  });

  it('Fire Team: rerolls misses in the first ground combat round', () => {
    // Attacker misses (1), rerolls a 10; the defender's die is the 1 after it.
    const d = side('hacan', { infantry: 1 });
    const a = side('arborec', { carrier: 1, infantry: 1 });
    expect(simulateOnce(input(a, d, { invade: true }), sequence(1, 10, 1)).invasion).toBe('repelled');
    const team = side('arborec', { carrier: 1, infantry: 1 }, cards(['fireTeam']));
    expect(simulateOnce(input(team, d, { invade: true }), sequence(1, 10, 1)).invasion).toBe('captured');
  });
});
