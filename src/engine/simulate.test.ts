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

  it('only lets Anti-Fighter Barrage hit fighters', () => {
    const a = side('arborec', { destroyer: 1 });
    const d = side('hacan', { cruiser: 1 });
    // AFB has no fighters to hit; the destroyer and cruiser then trade hits.
    expect(simulateOnce(input(a, d), alwaysTen).winner).toBe('draw');
  });

  it('destroys all ships when the Yin flagship dies', () => {
    const a = side('yin', { flagship: 1 }, { counts: { flagship: 1, carrier: 2 } });
    const d = side('hacan', { dreadnought: 4 });
    const result = simulateOnce(input(a, d), alwaysTen);
    expect(result.survivors.attacker).toEqual({});
    expect(result.survivors.defender).toEqual({});
  });
});
