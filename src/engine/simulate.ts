import { getFaction, getUnitStats } from './data/factions';
import { createRng, d10, type Rng } from './rng';
import {
  ALL_UNIT_TYPES,
  SHIP_TYPES,
  type Faction,
  type Role,
  type Roll,
  type SideInput,
  type SimulationInput,
  type SimulationResult,
  type SpecialEffect,
  type TechId,
  type UnitCounts,
  type UnitStats,
  type UnitType,
} from './types';

interface Unit {
  stats: UnitStats;
  dead: boolean;
  damaged: boolean;
  sustainedThisRound: boolean;
  /** On the contested planet: defender ground forces and structures, or committed attacker forces. */
  onPlanet: boolean;
}

interface Side {
  role: Role;
  faction: Faction;
  techs: Set<TechId>;
  units: Unit[];
  yinTriggered: boolean;
}

interface Hits {
  normal: number;
  /** Hits that must be assigned to non-fighter ships if able. */
  nonFighter: number;
}

export type SpaceOutcome = 'attacker' | 'defender' | 'draw' | 'noCombat';
export type InvasionOutcome = 'captured' | 'repelled' | 'draw' | 'notAttempted';

export interface BattleOutcome {
  winner: 'attacker' | 'defender' | 'draw';
  space: SpaceOutcome;
  invasion: InvasionOutcome;
  spaceRounds: number;
  groundRounds: number;
  survivors: Record<Role, UnitCounts>;
}

/** Lower values are destroyed first when assigning hits. */
export const DESTROY_ORDER: Record<UnitType, number> = {
  fighter: 1,
  infantry: 2,
  destroyer: 3,
  cruiser: 4,
  carrier: 5,
  dreadnought: 6,
  warsun: 7,
  flagship: 8,
  pds: 9,
  spacedock: 10,
};

/** Lower values absorb hits with Sustain Damage first. */
export const SUSTAIN_ORDER: Partial<Record<UnitType, number>> = {
  dreadnought: 1,
  carrier: 2,
  warsun: 3,
  flagship: 4,
};

const MAX_ROUNDS = 100;

// ---------------------------------------------------------------------------
// Unit queries

const isShipType = (type: UnitType) => SHIP_TYPES.includes(type);
const alive = (side: Side) => side.units.filter((u) => !u.dead);
const shipsInSpace = (side: Side) => alive(side).filter((u) => isShipType(u.stats.type) && !u.onPlanet);
const nonFighterShips = (side: Side) => shipsInSpace(side).filter((u) => u.stats.type !== 'fighter');
const hasSpecial = (side: Side, special: SpecialEffect) => alive(side).some((u) => u.stats.special === special);
const hasStructureOnPlanet = (side: Side) =>
  alive(side).some((u) => u.onPlanet && (u.stats.type === 'pds' || u.stats.type === 'spacedock'));

/** Infantry, plus fighters committed to the planet by the Naalu flagship. */
const groundForcesOnPlanet = (side: Side) =>
  alive(side).filter((u) => u.onPlanet && (u.stats.type === 'infantry' || u.stats.type === 'fighter'));

function combatModifier(side: Side): number {
  let mod = 0;
  if (side.faction.abilities.includes('unrelenting')) mod += 1;
  if (side.faction.abilities.includes('fragile')) mod -= 1;
  return mod;
}

// ---------------------------------------------------------------------------
// Dice

interface RollResult {
  hits: number;
  /** Natural 9s and 10s, for the Jol-Nar flagship. */
  highRolls: number;
}

function rollDice(rng: Rng, roll: Roll, modifier: number, dice = roll.dice): RollResult {
  let hits = 0;
  let highRolls = 0;
  for (let i = 0; i < dice; i++) {
    const natural = d10(rng);
    if (natural + modifier >= roll.hitOn) hits++;
    if (natural >= 9) highRolls++;
  }
  return { hits, highRolls };
}

/**
 * Roll an ability (Space Cannon, Bombardment) for a group of units.
 * With Plasma Scoring, the unit with the best value rolls one extra die.
 */
function rollAbility(
  rng: Rng,
  units: Unit[],
  getRoll: (s: UnitStats) => Roll | undefined,
  modifier: number,
  plasmaScoring: boolean,
): number {
  let hits = 0;
  let best: Roll | undefined;
  for (const unit of units) {
    const roll = getRoll(unit.stats);
    if (!roll) continue;
    hits += rollDice(rng, roll, modifier).hits;
    if (!best || roll.hitOn < best.hitOn) best = roll;
  }
  if (plasmaScoring && best) hits += rollDice(rng, best, modifier, 1).hits;
  return hits;
}

// ---------------------------------------------------------------------------
// Hit assignment

type Restriction = 'nonFighter' | 'fightersOnly' | undefined;

function pickSustainer(pool: Unit[]): Unit | undefined {
  let best: Unit | undefined;
  for (const u of pool) {
    if (!u.stats.sustainDamage || u.damaged) continue;
    const order = SUSTAIN_ORDER[u.stats.type] ?? 5;
    if (!best || order < (SUSTAIN_ORDER[best.stats.type] ?? 5)) best = u;
  }
  return best;
}

function pickVictim(pool: Unit[]): Unit {
  let victim = pool[0];
  for (const u of pool) {
    const a = DESTROY_ORDER[u.stats.type];
    const b = DESTROY_ORDER[victim.stats.type];
    if (a < b || (a === b && u.damaged && !victim.damaged)) victim = u;
  }
  return victim;
}

/** Whether a side's units may use Sustain Damage right now (blocked by the Mentak flagship). */
const canSustainAgainst = (opponent: Side) => !hasSpecial(opponent, 'mentakFlagship');

/**
 * The owner assigns hits to minimise losses: absorb with Sustain Damage first,
 * then lose the cheapest units.
 *
 * Pass `canSustain` when both sides assign hits at the same time, so that it reflects the
 * units present when the hits were rolled, not losses already applied to the other side.
 */
function assignHits(
  side: Side,
  opponent: Side,
  targets: Unit[],
  hits: number,
  restriction?: Restriction,
  canSustain = canSustainAgainst(opponent),
): void {
  const cancelPerSustain = side.techs.has('nonEuclideanShielding') ? 2 : 1;
  let remaining = hits;
  while (remaining > 0) {
    let pool = targets.filter((u) => !u.dead);
    if (restriction === 'fightersOnly') {
      pool = pool.filter((u) => u.stats.type === 'fighter');
    } else if (restriction === 'nonFighter') {
      const nonFighters = pool.filter((u) => u.stats.type !== 'fighter');
      if (nonFighters.length > 0) pool = nonFighters;
    }
    if (pool.length === 0) return;

    const sustainer = canSustain ? pickSustainer(pool) : undefined;
    if (sustainer) {
      sustainer.damaged = true;
      sustainer.sustainedThisRound = true;
      remaining -= cancelPerSustain;
    } else {
      pickVictim(pool).dead = true;
      remaining--;
    }
  }
}

function applyHits(side: Side, opponent: Side, targets: Unit[], hits: Hits, canSustain: boolean): void {
  assignHits(side, opponent, targets, hits.nonFighter, 'nonFighter', canSustain);
  assignHits(side, opponent, targets, hits.normal, undefined, canSustain);
}

/** Yin flagship: when destroyed, destroy all ships in the system. */
function checkYinFlagship(a: Side, b: Side): void {
  for (const side of [a, b]) {
    if (side.yinTriggered) continue;
    const flagship = side.units.find((u) => u.stats.special === 'yinFlagship');
    if (flagship?.dead) {
      side.yinTriggered = true;
      for (const s of [a, b]) for (const u of shipsInSpace(s)) u.dead = true;
    }
  }
}

// ---------------------------------------------------------------------------
// Combat steps

function spaceCannonOffense(rng: Rng, shooter: Side, target: Side): void {
  const targets = shipsInSpace(target);
  if (targets.length === 0) return;
  const shooters = alive(shooter).filter((u) => u.stats.spaceCannon);
  const modifier = target.techs.has('antimassDeflectors') ? -1 : 0;
  const hits = rollAbility(rng, shooters, (s) => s.spaceCannon, modifier, shooter.techs.has('plasmaScoring'));
  const restriction = shooter.techs.has('gravitonLaserSystem') ? 'nonFighter' : undefined;
  assignHits(target, shooter, targets, hits, restriction);
}

function combatHits(rng: Rng, side: Side, combatants: Unit[], opponent: Side, inSpace: boolean): Hits {
  const hits: Hits = { normal: 0, nonFighter: 0 };
  const baseMod = combatModifier(side);
  const sardakkFlagship = inSpace && combatants.some((u) => u.stats.special === 'sardakkFlagship');
  const l1z1xFlagship = inSpace && combatants.some((u) => u.stats.special === 'l1z1xFlagship');

  for (const unit of combatants) {
    const roll = unit.stats.combat;
    if (!roll) continue;
    let mod = baseMod;
    if (sardakkFlagship && isShipType(unit.stats.type) && unit.stats.special !== 'sardakkFlagship') mod += 1;
    const dice = unit.stats.special === 'winnuFlagship' ? nonFighterShips(opponent).length : roll.dice;
    const result = rollDice(rng, roll, mod, dice);
    let produced = result.hits;
    if (unit.stats.special === 'jolnarFlagship') produced += 2 * result.highRolls;

    const restricted =
      l1z1xFlagship && (unit.stats.type === 'flagship' || unit.stats.type === 'dreadnought');
    if (restricted) hits.nonFighter += produced;
    else hits.normal += produced;
  }
  return hits;
}

function startOfSpaceCombat(rng: Rng, att: Side, def: Side, wormhole: boolean): void {
  // Assault Cannon: the opponent destroys (not hits) one non-fighter ship.
  for (const [side, opponent] of [[att, def], [def, att]] as const) {
    if (side.techs.has('assaultCannon') && nonFighterShips(side).length >= 3) {
      const options = nonFighterShips(opponent);
      if (options.length > 0) pickVictim(options).dead = true;
    }
  }
  checkYinFlagship(att, def);

  for (const [side, opponent] of [[att, def], [def, att]] as const) {
    let hits = 0;
    if (wormhole && side.techs.has('dimensionalSplicer') && shipsInSpace(side).length > 0) hits++;
    if (side.faction.abilities.includes('ambush')) {
      // Roll for up to two cruisers/destroyers, best combat value first. Not a combat roll: no modifiers.
      const ambushers = shipsInSpace(side)
        .filter((u) => u.stats.type === 'cruiser' || u.stats.type === 'destroyer')
        .sort((a, b) => a.stats.combat!.hitOn - b.stats.combat!.hitOn)
        .slice(0, 2);
      for (const u of ambushers) hits += rollDice(rng, u.stats.combat!, 0, 1).hits;
    }
    if (hits > 0) assignHits(opponent, side, shipsInSpace(opponent), hits);
  }
  checkYinFlagship(att, def);
}

function antiFighterBarrage(rng: Rng, att: Side, def: Side): void {
  const volley = (side: Side) =>
    shipsInSpace(side).reduce(
      (sum, u) => sum + (u.stats.antiFighterBarrage ? rollDice(rng, u.stats.antiFighterBarrage, 0).hits : 0),
      0,
    );
  const attHits = volley(att);
  const defHits = volley(def);
  assignHits(def, att, shipsInSpace(def), attHits, 'fightersOnly');
  assignHits(att, def, shipsInSpace(att), defHits, 'fightersOnly');
}

function duraniumRepair(side: Side): void {
  if (!side.techs.has('duraniumArmor')) return;
  const candidates = alive(side).filter((u) => u.damaged && !u.sustainedThisRound);
  if (candidates.length === 0) return;
  candidates.sort((a, b) => DESTROY_ORDER[b.stats.type] - DESTROY_ORDER[a.stats.type]);
  candidates[0].damaged = false;
}

function resolveSpaceCombat(rng: Rng, att: Side, def: Side, wormhole: boolean): { outcome: SpaceOutcome; rounds: number } {
  // Nekro flagship: that side's ground forces fight as ships for the whole combat.
  const nekro = { attacker: hasSpecial(att, 'nekroFlagship'), defender: hasSpecial(def, 'nekroFlagship') };
  const combatants = (side: Side) => {
    const ships = shipsInSpace(side);
    return nekro[side.role] ? [...ships, ...alive(side).filter((u) => u.stats.type === 'infantry')] : ships;
  };

  if (combatants(att).length === 0 || combatants(def).length === 0) return { outcome: 'noCombat', rounds: 0 };

  startOfSpaceCombat(rng, att, def, wormhole);

  let rounds = 0;
  while (rounds < MAX_ROUNDS && combatants(att).length > 0 && combatants(def).length > 0) {
    rounds++;
    for (const side of [att, def]) {
      const letnev = alive(side).find((u) => u.stats.special === 'letnevFlagship');
      if (letnev) letnev.damaged = false;
    }
    if (rounds === 1) {
      antiFighterBarrage(rng, att, def);
      if (combatants(att).length === 0 || combatants(def).length === 0) break;
    }

    const attUnits = combatants(att);
    const defUnits = combatants(def);
    const attHits = combatHits(rng, att, attUnits, def, true);
    const defHits = combatHits(rng, def, defUnits, att, true);
    // Hits are assigned simultaneously: decide Sustain Damage eligibility before either side loses units.
    const defCanSustain = canSustainAgainst(att);
    const attCanSustain = canSustainAgainst(def);
    applyHits(def, att, defUnits, attHits, defCanSustain);
    applyHits(att, def, attUnits, defHits, attCanSustain);
    checkYinFlagship(att, def);

    duraniumRepair(att);
    duraniumRepair(def);
    for (const u of [...att.units, ...def.units]) u.sustainedThisRound = false;
  }

  const attLeft = combatants(att).length > 0;
  const defLeft = combatants(def).length > 0;
  const outcome: SpaceOutcome = attLeft && !defLeft ? 'attacker' : defLeft && !attLeft ? 'defender' : 'draw';
  return { outcome, rounds };
}

function planetaryShieldUp(att: Side, def: Side): boolean {
  const shield = alive(def).some((u) => u.onPlanet && u.stats.planetaryShield);
  const stripped = shipsInSpace(att).some((u) => u.stats.removesPlanetaryShield);
  return shield && !stripped;
}

function bombard(rng: Rng, att: Side, def: Side): void {
  if (planetaryShieldUp(att, def)) return;
  const targets = groundForcesOnPlanet(def);
  if (targets.length === 0) return;
  const hits = rollAbility(rng, shipsInSpace(att), (s) => s.bombardment, 0, att.techs.has('plasmaScoring'));
  assignHits(def, att, targets, hits);
}

function resolveInvasion(rng: Rng, att: Side, def: Side): { outcome: InvasionOutcome; rounds: number } {
  const naaluFighters = hasSpecial(att, 'naaluFlagship');
  const invaders = alive(att).filter(
    (u) => !u.onPlanet && (u.stats.type === 'infantry' || (naaluFighters && u.stats.type === 'fighter')),
  );
  if (invaders.length === 0) return { outcome: 'notAttempted', rounds: 0 };

  bombard(rng, att, def);

  for (const u of invaders) u.onPlanet = true;

  // Space Cannon Defense against the landing forces.
  if (!att.techs.has('l4Disruptors')) {
    const pds = alive(def).filter((u) => u.onPlanet && u.stats.spaceCannon);
    const modifier = att.techs.has('antimassDeflectors') ? -1 : 0;
    const hits = rollAbility(rng, pds, (s) => s.spaceCannon, modifier, def.techs.has('plasmaScoring'));
    assignHits(att, def, groundForcesOnPlanet(att), hits);
  }

  let rounds = 0;
  if (groundForcesOnPlanet(att).length > 0 && groundForcesOnPlanet(def).length > 0) {
    if (def.techs.has('magenDefenseGrid') && hasStructureOnPlanet(def)) {
      assignHits(att, def, groundForcesOnPlanet(att), 1);
    }
    while (rounds < MAX_ROUNDS && groundForcesOnPlanet(att).length > 0 && groundForcesOnPlanet(def).length > 0) {
      rounds++;
      const attUnits = groundForcesOnPlanet(att);
      const defUnits = groundForcesOnPlanet(def);
      const attHits = combatHits(rng, att, attUnits, def, false).normal;
      const defHits = combatHits(rng, def, defUnits, att, false).normal;
      const attTotal = attHits + (att.techs.has('valkyrieParticleWeave') && defHits > 0 ? 1 : 0);
      const defTotal = defHits + (def.techs.has('valkyrieParticleWeave') && attHits > 0 ? 1 : 0);
      assignHits(def, att, defUnits, attTotal);
      assignHits(att, def, attUnits, defTotal);
      if (att.faction.abilities.includes('harrow')) bombard(rng, att, def);
    }
  }

  // Naalu fighters return to the space area.
  for (const u of att.units) if (u.stats.type === 'fighter') u.onPlanet = false;

  const attLeft = groundForcesOnPlanet(att).length > 0;
  const defLeft = groundForcesOnPlanet(def).length > 0;
  if (attLeft && !defLeft) {
    for (const u of alive(def)) if (u.onPlanet) u.dead = true; // Structures are destroyed.
    return { outcome: 'captured', rounds };
  }
  return { outcome: !attLeft && !defLeft ? 'draw' : 'repelled', rounds };
}

// ---------------------------------------------------------------------------
// Setup and aggregation

interface SideTemplate {
  role: Role;
  faction: Faction;
  techs: Set<TechId>;
  units: { stats: UnitStats; onPlanet: boolean }[];
}

function buildTemplate(role: Role, input: SideInput): SideTemplate {
  const faction = getFaction(input.factionId);
  const units: SideTemplate['units'] = [];
  for (const type of ALL_UNIT_TYPES) {
    const count = Math.max(0, Math.floor(input.counts[type] ?? 0));
    if (count === 0) continue;
    const stats = getUnitStats(faction, type, input.upgrades[type] ?? false);
    // The defender's ground forces and structures start on the planet; the attacker's are carried in space.
    const onPlanet = role === 'defender' && !isShipType(type);
    for (let i = 0; i < count; i++) units.push({ stats, onPlanet });
  }
  return { role, faction, techs: new Set(input.techs), units };
}

function instantiate(t: SideTemplate): Side {
  return {
    role: t.role,
    faction: t.faction,
    techs: t.techs,
    yinTriggered: false,
    units: t.units.map((u) => ({ ...u, dead: false, damaged: false, sustainedThisRound: false })),
  };
}

function countSurvivors(side: Side): UnitCounts {
  const counts: UnitCounts = {};
  for (const u of alive(side)) counts[u.stats.type] = (counts[u.stats.type] ?? 0) + 1;
  return counts;
}

function fight(rng: Rng, att: Side, def: Side, invade: boolean, wormhole: boolean): BattleOutcome {
  // Space Cannon Offense: the active player fires first.
  spaceCannonOffense(rng, att, def);
  spaceCannonOffense(rng, def, att);
  checkYinFlagship(att, def);

  const space = resolveSpaceCombat(rng, att, def, wormhole);

  // Ground forces carried by a fleet that no longer exists are lost. Supporting PDS are elsewhere and survive.
  if (shipsInSpace(att).length === 0) {
    for (const u of alive(att)) if (!u.onPlanet && u.stats.type === 'infantry') u.dead = true;
  }

  let invasion: { outcome: InvasionOutcome; rounds: number } = { outcome: 'notAttempted', rounds: 0 };
  if (invade && shipsInSpace(att).length > 0 && shipsInSpace(def).length === 0) {
    invasion = resolveInvasion(rng, att, def);
  }

  let winner: BattleOutcome['winner'];
  if (invasion.outcome === 'captured') winner = 'attacker';
  else if (invasion.outcome === 'repelled') winner = 'defender';
  else if (invasion.outcome === 'draw') winner = 'draw';
  else {
    const attShips = shipsInSpace(att).length > 0;
    const defShips = shipsInSpace(def).length > 0;
    winner = attShips && !defShips ? 'attacker' : defShips && !attShips ? 'defender' : 'draw';
    // An invasion that never happened because the attacker was beaten in space is a defender win.
    if (invade && winner === 'draw' && groundForcesOnPlanet(def).length > 0) winner = 'defender';
  }

  return {
    winner,
    space: space.outcome,
    invasion: invasion.outcome,
    spaceRounds: space.rounds,
    groundRounds: invasion.rounds,
    survivors: { attacker: countSurvivors(att), defender: countSurvivors(def) },
  };
}

/** Run a single combat. Exposed for tests. */
export function simulateOnce(input: SimulationInput, rng: Rng = createRng(input.options.seed)): BattleOutcome {
  const att = instantiate(buildTemplate('attacker', input.attacker));
  const def = instantiate(buildTemplate('defender', input.defender));
  return fight(rng, att, def, input.options.invade, input.options.wormhole);
}

export function runSimulation(input: SimulationInput): SimulationResult {
  const started = performance.now();
  const rng = createRng(input.options.seed);
  const attTemplate = buildTemplate('attacker', input.attacker);
  const defTemplate = buildTemplate('defender', input.defender);
  const n = Math.max(1, Math.floor(input.options.iterations));

  const overall = { attacker: 0, defender: 0, draw: 0 };
  const space = { attacker: 0, defender: 0, draw: 0, noCombat: 0 };
  const invasion = { captured: 0, repelled: 0, draw: 0, notAttempted: 0 };
  const survivors: Record<Role, UnitCounts> = { attacker: {}, defender: {} };
  let spaceRounds = 0;
  let groundRounds = 0;
  let spaceCombats = 0;
  let groundCombats = 0;

  for (let i = 0; i < n; i++) {
    const result = fight(rng, instantiate(attTemplate), instantiate(defTemplate), input.options.invade, input.options.wormhole);
    overall[result.winner]++;
    space[result.space]++;
    invasion[result.invasion]++;
    spaceRounds += result.spaceRounds;
    groundRounds += result.groundRounds;
    if (result.spaceRounds > 0) spaceCombats++;
    if (result.groundRounds > 0) groundCombats++;
    for (const role of ['attacker', 'defender'] as const) {
      for (const [type, count] of Object.entries(result.survivors[role]) as [UnitType, number][]) {
        survivors[role][type] = (survivors[role][type] ?? 0) + count;
      }
    }
  }

  const share = <T extends Record<string, number>>(o: T) =>
    Object.fromEntries(Object.entries(o).map(([k, v]) => [k, v / n])) as T;
  for (const role of ['attacker', 'defender'] as const) {
    for (const type of Object.keys(survivors[role]) as UnitType[]) {
      survivors[role][type] = (survivors[role][type] ?? 0) / n;
    }
  }

  return {
    iterations: n,
    overall: share(overall),
    space: share(space),
    invasion: input.options.invade ? share(invasion) : null,
    averageSpaceRounds: spaceCombats > 0 ? spaceRounds / spaceCombats : 0,
    averageGroundRounds: groundCombats > 0 ? groundRounds / groundCombats : 0,
    averageSurvivors: survivors,
    durationMs: performance.now() - started,
  };
}
