import { actionCardsFor } from '../engine/data/actionCards';
import { FACTIONS, getFaction, getUnitDefinition } from '../engine/data/factions';
import { TECHS, techsForFaction } from '../engine/data/techs';
import type { InvasionOutcome, SpaceOutcome } from '../engine/simulate';
import {
  ALL_UNIT_TYPES,
  SHIP_TYPES,
  type ActionCardId,
  type Faction,
  type Role,
  type Roll,
  type SideInput,
  type TechId,
  type UnitCounts,
  type UnitDefinition,
  type UnitStats,
  type UnitType,
} from '../engine/types';

// ---------------------------------------------------------------------------
// Public types

/** "info" explains where an imported value came from; "warn" means the user should check it. */
export type FlagLevel = 'info' | 'warn';

export interface ImportFlag {
  level: FlagLevel;
  message: string;
}

export interface SideFlags {
  faction: ImportFlag[];
  units: Partial<Record<UnitType, ImportFlag[]>>;
  upgrades: Partial<Record<UnitType, ImportFlag[]>>;
  techs: Partial<Record<TechId, ImportFlag[]>>;
  actionCards: Partial<Record<ActionCardId, ImportFlag[]>>;
}

export interface ImportedCombat {
  /** e.g. "Player 3 attacks Player 1 at ( NAR / JOL )". */
  title: string;
  /** The combat steps seen, e.g. "Space Cannon Offense · 3 space combat rounds". */
  summary: string;
  system: string;
  /** The planet the simulator's invasion is fought over, if there was one. */
  planet: string | null;
  players: Record<Role, string>;
  attacker: SideInput;
  defender: SideInput;
  invade: boolean;
  wormhole: boolean;
  flags: Record<Role, SideFlags>;
  /** Things about the whole combat: third parties, action cards, ignored planets. */
  notes: ImportFlag[];
  /** Where this combat's lines are in the pasted text, as character offsets (end exclusive). */
  source: { start: number; end: number };
  /** What happened in the game, in the simulator's terms. */
  actual: ActualResult;
}

export interface ActualResult {
  /** Same rule as the simulator: with an invasion, the attacker wins only by capturing the planet. */
  winner: Role | 'draw';
  space: SpaceOutcome;
  invasion: InvasionOutcome;
  spaceRounds: number;
  groundRounds: number;
  /** Units destroyed, among those the simulator fights with (defender infantry only on the invaded planet). */
  lost: Record<Role, UnitCounts>;
  /** The imported units minus those destroyed. Units that retreated count as survivors. */
  survivors: Record<Role, UnitCounts>;
  retreated: Role | null;
}

export interface BgaImport {
  /** Newest combat first, like the BGA log. */
  combats: ImportedCombat[];
  /** Faction guessed for each player name seen in the log. */
  factions: Record<string, string>;
}

// ---------------------------------------------------------------------------
// Names

const GENERIC_UNIT_NAMES: Record<string, UnitType> = {
  flagship: 'flagship',
  'war sun': 'warsun',
  dreadnought: 'dreadnought',
  carrier: 'carrier',
  cruiser: 'cruiser',
  destroyer: 'destroyer',
  fighter: 'fighter',
  infantry: 'infantry',
  pds: 'pds',
  'space dock': 'spacedock',
};

/** Faction-specific unit names ("Spec Ops", "Hil Colish"...) and the faction they prove. */
const FACTION_UNIT_NAMES = new Map<string, { type: UnitType; faction: string }>();
for (const f of FACTIONS) {
  for (const [type, def] of Object.entries(f.units) as [UnitType, NonNullable<Faction['units'][UnitType]>][]) {
    for (const stats of [def.base, def.upgraded]) {
      if (!stats) continue;
      const name = stats.name.toLowerCase().replace(/ (i|ii)$/, '');
      if (!GENERIC_UNIT_NAMES[name]) FACTION_UNIT_NAMES.set(name, { type, faction: f.id });
    }
  }
}

function normalizeUnitName(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/\(s\)/g, '')
    .replace(/^damaged /, '')
    .replace(/ (i|ii)$/, '')
    .trim();
}

/** Maps a BGA unit name ("war sun(s)", "PDS(s)", "Spec Ops II") to a unit type. */
export function unitFromName(raw: string): UnitType | null {
  const name = normalizeUnitName(raw);
  const generic = GENERIC_UNIT_NAMES[name] ?? GENERIC_UNIT_NAMES[name.replace(/s$/, '')];
  return generic ?? FACTION_UNIT_NAMES.get(name)?.type ?? null;
}

/** Ability, technology and unit names that only one base-game faction has. Weight 3 = ability or unit, 2 = tech. */
const FACTION_KEYWORDS: Record<string, { faction: string; weight: number }> = {};
const keywords = (faction: string, weight: number, names: string[]) =>
  names.forEach((n) => (FACTION_KEYWORDS[n] = { faction, weight }));
keywords('arborec', 3, ['MITOSIS']);
keywords('arborec', 2, ['BIOPLASMOSIS']);
keywords('letnev', 3, ['MUNITIONS RESERVES', 'ARMADA']);
keywords('letnev', 2, ['NON-EUCLIDEAN SHIELDING', 'L4 DISRUPTORS']);
keywords('saar', 3, ['SCAVENGE', 'NOMADIC']);
keywords('saar', 2, ['CHAOS MAPPING']);
keywords('muaat', 3, ['STAR FORGE', 'GASHLAI PHYSIOLOGY', 'NOVA SEED']);
keywords('muaat', 2, ['MAGMUS REACTOR']);
keywords('hacan', 3, ['MASTERS OF TRADE', 'GUILD SHIPS', 'ARBITERS']);
keywords('hacan', 2, ['QUANTUM DATAHUB NODE', 'PRODUCTION BIOMES']);
keywords('sol', 3, ['ORBITAL DROP', 'VERSATILE']);
keywords('sol', 2, ['SPEC OPS II', 'ADVANCED CARRIER II']);
keywords('creuss', 3, ['QUANTUM ENTANGLEMENT', 'SLIPSTREAM', 'CREUSS GATE']);
keywords('creuss', 2, ['DIMENSIONAL SPLICER', 'WORMHOLE GENERATOR']);
keywords('l1z1x', 3, ['ASSIMILATE', 'HARROW']);
keywords('l1z1x', 2, ['INHERITANCE SYSTEMS']);
keywords('mentak', 3, ['AMBUSH', 'PILLAGE']);
keywords('mentak', 2, ['SALVAGE OPERATIONS', 'MIRROR COMPUTING']);
keywords('naalu', 3, ['TELEPATHIC', 'FORESIGHT']);
keywords('naalu', 2, ['NEUROGLAIVE']);
keywords('nekro', 3, ['GALACTIC THREAT', 'TECHNOLOGICAL SINGULARITY', 'PROPAGATION']);
keywords('nekro', 2, ['VALEFAR ASSIMILATOR']);
keywords('sardakk', 3, ['UNRELENTING']);
keywords('sardakk', 2, ['VALKYRIE PARTICLE WEAVE']);
keywords('jolnar', 3, ['FRAGILE', 'BRILLIANT', 'ANALYTICAL']);
keywords('jolnar', 2, ['E-RES SIPHONS', 'SPACIAL CONDUIT CYLINDER']);
keywords('winnu', 3, ['BLOOD TIES', 'RECLAMATION']);
keywords('winnu', 2, ['LAZAX GATE FOLDING', 'HEGEMONIC TRADE POLICY']);
keywords('xxcha', 3, ['PEACE ACCORDS', 'QUASH']);
keywords('xxcha', 2, ['NULLIFICATION FIELD', 'INSTINCT TRAINING']);
keywords('yin', 3, ['INDOCTRINATION', 'DEVOTION']);
keywords('yin', 2, ['IMPULSE CORE', 'YIN SPINNER']);
keywords('yssaril', 3, ['STALL TACTICS', 'SCHEMING', 'CRAFTY']);
keywords('yssaril', 2, ['TRANSPARASTEEL PLATING']);
for (const f of FACTIONS) {
  const flagshipName = f.units.flagship?.base.name;
  if (flagshipName) keywords(f.id, 3, [flagshipName.toUpperCase()]);
}

const TECH_KEYWORDS: Record<string, TechId> = Object.fromEntries(
  TECHS.map((t) => [t.name.toUpperCase().replace(/ Ω$/, ''), t.id]),
);

/** Combat effects the log can show that the simulator doesn't model. */
const UNSIMULATED_EFFECTS = ['X-89 BACTERIAL WEAPON', 'MUNITIONS RESERVES', 'J.N.S. HYLARIM'];

// ---------------------------------------------------------------------------
// Line parsing

export interface DiceGroup {
  name: string;
  unit: UnitType | null;
  dice: number[];
}

export type RollKind = 'combat' | 'afb' | 'spaceCannonOffense' | 'spaceCannonDefense' | 'bombardment';

export interface RollLine {
  actor: string;
  kind: RollKind;
  reroll: boolean;
  hits: number;
  /** The player rolled against, or the owner of the bombarded planet. */
  target: string | null;
  planet: string | null;
  groups: DiceGroup[];
  effects: string[];
}

export const RE = {
  activate: /^(.+?) activated \( (.+?) \) to start a tactical action/,
  finish: /^(.+?) finished a tactical action/,
  add: /^(.+?) added (\d+) (damaged )?(.+?) to (?:\( (.+?) \)|(.+?))\.$/,
  remove: /^(.+?) removed (\d+) (damaged )?(.+?) from (?:\( (.+?) \)|([^.]+?))\.(.*)$/,
  destroyed: /^(.+?) destroyed (\d+) of (.+?)'s (damaged )?(.+?) (?:in \( (.+?) \)|on (.+?))\.$/,
  destroyedOne: /^(.+?) destroyed (.+?)'s (flagship|war sun) in \( (.+?) \)/,
  damaged: /^(.+?) damaged (\d+) (.+?) in \(/,
  repaired: /^(.+?) repaired (\d+) (.+?) in \(/,
  roll: /^(.+?) (rolled|rerolled) (\d+) (?:die|dice) for (\d+) (?:total )?hits?(.*?): (.*)$/,
  toHit: /^(.+?) rolled (\d+) (?:die|dice) to hit on (\d+)-10: \[(.*)\] Hits: (\d+)/,
  ambush: /^(.+?) used AMBUSH on (.+?) with (.+?)\.$/,
  started: /^(.+?) and (.+?) started (space|ground) combat round (\d+)(?: on (?:\( (.+?) \)|(.+?)))?\.$/,
  commit: /^(.+?) committed ground force\(s\): (.*)$/,
  shieldSkip: /^(.+?) skipped using BOMBARDMENT due to PLANETARY SHIELD/,
  cannonSkip: /^(.+?) skipped firing on (.+?) in Space Cannon/,
  assaultCannon: /^(.+?) used ASSAULT CANNON/,
  played: /^(.+?) played ([A-Z][A-Z0-9 '’.\-]+?)(?: to | on |\.|$)/,
  keyword: /^(.+?) (?:used|exhausted) ([A-Z][A-Z0-9 '’.\-]*[A-Z])(?: to | on | and | for |\.|$)/,
  sustain: /^(.+?) used SUSTAIN DAMAGE/,
  research: /^(.+?) researched (.+?)(?: and used:.*)?\.?$/,
  setup: /^Round 0, /,
};

export function parseRoll(m: RegExpMatchArray): RollLine {
  const [, actor, verb, , hits, middle, rest] = m;
  let kind: RollKind = 'combat';
  let target: string | null = null;
  let planet: string | null = null;
  const against = middle.match(/ against (.+?) in (Space Cannon Offense|ANTI-FIGHTER BARRAGE)/);
  const onPlanet = middle.match(/ on (.+?) \((.+?)\) (?:using (BOMBARDMENT)|in (Space Cannon Defense))/);
  if (against) {
    target = against[1];
    kind = against[2] === 'ANTI-FIGHTER BARRAGE' ? 'afb' : 'spaceCannonOffense';
  } else if (onPlanet) {
    planet = onPlanet[1];
    target = onPlanet[2];
    kind = onPlanet[3] ? 'bombardment' : 'spaceCannonDefense';
  }
  const cut = rest.search(/Details|Effects:/);
  const dicePart = cut < 0 ? rest : rest.slice(0, cut);
  const effects = rest.match(/Effects:\s*(.*)$/)?.[1].split(',').map((s) => s.trim()).filter(Boolean) ?? [];
  const groups: DiceGroup[] = [];
  for (const g of dicePart.matchAll(/([A-Za-z][^[\],]*?)\s*((?:\[[^\]]*\]\s*)+)/g)) {
    const name = g[1].trim();
    for (const bracket of g[2].match(/\[[^\]]*\]/g) ?? []) {
      const dice = bracket
        .slice(1, -1)
        .split(',')
        .map((s) => Number(s.trim()))
        .filter((n) => !Number.isNaN(n));
      groups.push({ name, unit: unitFromName(name), dice });
    }
  }
  return { actor, kind, reroll: verb === 'rerolled', hits: Number(hits), target, planet, groups, effects };
}

/** Removes BGA timestamps and odd whitespace. */
export function cleanLine(line: string): string {
  return line
    .replace(/[ \t]/g, ' ')
    .replace(/^\s*\[?\d{1,2}:\d{2}(?::\d{2})?\]?\s+/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * BGA shows the newest line first. Decide the order from things that always happen in sequence:
 * activation before movement and the end of the action, combat round N before round N+1.
 */
export function isNewestFirst(lines: string[]): boolean {
  let votes = 0; // > 0 means oldest first
  const vote = (earlier: number, later: number) => (votes += later > earlier ? 1 : -1);
  lines.forEach((line, i) => {
    const act = line.match(RE.activate);
    if (act) {
      const j = nearest(lines, i, (l) => l.startsWith(`${act[1]} finished a tactical action`) || l.startsWith(`${act[1]} used a tactical movement`));
      if (j >= 0) vote(i, j);
    }
    const st = line.match(RE.started);
    if (st && Number(st[4]) > 1) {
      const prev = `started ${st[3]} combat round ${Number(st[4]) - 1}`;
      const j = nearest(lines, i, (l) => l.startsWith(`${st[1]} and ${st[2]} ${prev}`));
      if (j >= 0) vote(j, i);
    }
  });
  return votes <= 0;
}

function nearest(lines: string[], i: number, test: (l: string) => boolean, reach = 120): number {
  for (let d = 1; d <= reach; d++) {
    if (i + d < lines.length && test(lines[i + d])) return i + d;
    if (i - d >= 0 && test(lines[i - d])) return i - d;
  }
  return -1;
}

// ---------------------------------------------------------------------------
// Faction inference

interface FactionGuess {
  factionId: string;
  flags: ImportFlag[];
}

interface FlagshipEvidence {
  combatDice: number[];
  afbDice: number[];
  bombardDice: number[];
  cannonDice: number[];
}

function guessFactions(lines: string[], rolls: (RollLine | null)[]): Record<string, FactionGuess> {
  const scores = new Map<string, Map<string, { score: number; why: Set<string> }>>();
  const add = (player: string, faction: string, weight: number, why: string) => {
    const byFaction = scores.get(player) ?? new Map();
    scores.set(player, byFaction);
    const entry = byFaction.get(faction) ?? { score: 0, why: new Set<string>() };
    if (!entry.why.has(why)) {
      entry.score += weight;
      entry.why.add(why);
    }
    byFaction.set(faction, entry);
  };
  const flagships = new Map<string, FlagshipEvidence>();
  const flagshipOf = (player: string) => {
    const e = flagships.get(player) ?? { combatDice: [], afbDice: [], bombardDice: [], cannonDice: [] };
    flagships.set(player, e);
    return e;
  };

  lines.forEach((line, i) => {
    const kw = line.match(RE.keyword);
    if (kw) {
      const hit = FACTION_KEYWORDS[kw[2]];
      if (hit) add(kw[1], hit.faction, hit.weight, kw[2]);
    }
    const moved = line.match(RE.add);
    if (moved) {
      const named = FACTION_UNIT_NAMES.get(normalizeUnitName(moved[4]));
      if (named) add(moved[1], named.faction, 3, moved[4]);
      // Only the Saar's Floating Factories move through space.
      if (unitFromName(moved[4]) === 'spacedock' && moved[5]) add(moved[1], 'saar', 3, 'space dock moving with the fleet');
    }
    const roll = rolls[i];
    if (!roll) return;
    for (const effect of roll.effects) {
      const hit = FACTION_KEYWORDS[effect];
      if (hit) add(roll.actor, hit.faction, hit.weight, effect);
    }
    for (const g of roll.groups) {
      const named = FACTION_UNIT_NAMES.get(normalizeUnitName(g.name));
      if (named) add(roll.actor, named.faction, 3, g.name);
      if (g.unit !== 'flagship') continue;
      const e = flagshipOf(roll.actor);
      if (roll.kind === 'combat' && !roll.reroll) e.combatDice.push(g.dice.length);
      if (roll.kind === 'afb') e.afbDice.push(g.dice.length);
      if (roll.kind === 'bombardment') e.bombardDice.push(g.dice.length);
      if (roll.kind === 'spaceCannonOffense' || roll.kind === 'spaceCannonDefense') e.cannonDice.push(g.dice.length);
    }
  });

  const players = new Set<string>([...scores.keys(), ...flagships.keys()]);
  const result: Record<string, FactionGuess> = {};
  for (const player of players) {
    const fe = flagships.get(player);
    const fits = (f: Faction) => !fe || flagshipFits(f, fe);
    const ranked = [...(scores.get(player) ?? new Map()).entries()]
      .map(([faction, e]) => ({ faction, ...e }))
      .sort((a, b) => b.score - a.score);
    const top = ranked[0];
    const evidence = (e: { why: Set<string> }) => [...e.why].join(', ');
    if (top) {
      const tied = ranked.filter((r) => r.score === top.score);
      if (tied.length > 1) {
        result[player] = {
          factionId: '',
          flags: [
            {
              level: 'warn',
              message: `Couldn't decide ${player}'s faction: ${tied
                .map((t) => `${getFaction(t.faction).name} (${evidence(t)})`)
                .join(' or ')}. Choose it.`,
            },
          ],
        };
        continue;
      }
      const flags: ImportFlag[] = [];
      const faction = getFaction(top.faction);
      const others = ranked.slice(1);
      const sure = top.score >= 3 && others.length === 0;
      flags.push({
        level: sure ? 'info' : 'warn',
        message: `${player} looks like ${faction.name}, from ${evidence(top)}.${
          others.length ? ` Also seen: ${others.map((o) => `${evidence(o)} (${getFaction(o.faction).name})`).join(', ')}.` : ''
        }${sure ? '' : ' Check this.'}`,
      });
      if (!fits(faction)) {
        flags.push({ level: 'warn', message: `${player}'s flagship dice don't match the ${faction.name} flagship.` });
      }
      result[player] = { factionId: top.faction, flags };
      continue;
    }
    const candidates = FACTIONS.filter(fits);
    result[player] =
      fe && candidates.length === 1
        ? {
            factionId: candidates[0].id,
            flags: [
              {
                level: 'warn',
                message: `Guessed ${candidates[0].name}: the only faction whose flagship matches ${player}'s dice. Check this.`,
              },
            ],
          }
        : {
            factionId: '',
            flags: [{ level: 'warn', message: `Nothing in the log shows ${player}'s faction. Choose it.` }],
          };
  }
  return result;
}

function flagshipFits(f: Faction, e: FlagshipEvidence): boolean {
  const s = f.units.flagship?.base;
  if (!s) return false;
  const sizeFits = (sizes: number[], roll: Roll | undefined, extra = 0) =>
    sizes.every((n) => roll && n >= roll.dice && n <= roll.dice + extra);
  return (
    (s.special === 'winnuFlagship' || sizeFits(e.combatDice, s.combat)) &&
    sizeFits(e.afbDice, s.antiFighterBarrage) &&
    sizeFits(e.bombardDice, s.bombardment, 1) &&
    sizeFits(e.cannonDice, s.spaceCannon, 1)
  );
}

// ---------------------------------------------------------------------------
// Upgrade inference

type UpgradeStatus = 'base' | 'upgraded';

interface DiceObservation {
  kind: RollKind;
  hits: number;
  groups: DiceGroup[];
  plasma: boolean;
  /** J.N.S. Hylarim adds up to 2 hits per natural 9 or 10, which the log doesn't separate out. */
  jolnarFlagship: boolean;
  /** X-89 Bacterial Weapon doubles Bombardment hits, so only the dice per unit can be checked. */
  hitsUnknown: boolean;
  line: string;
}

interface ThresholdObservation {
  type: UnitType;
  hitOn: number;
  line: string;
}

export const rollOf = (stats: UnitStats, kind: RollKind): Roll | undefined =>
  kind === 'combat'
    ? stats.combat
    : kind === 'afb'
      ? stats.antiFighterBarrage
      : kind === 'bombardment'
        ? stats.bombardment
        : stats.spaceCannon;

function observationFits(
  faction: Faction,
  status: Partial<Record<UnitType, UpgradeStatus>>,
  obs: DiceObservation,
): boolean {
  let hits = 0;
  let bonus = 0;
  let extraDice = 0;
  for (const g of obs.groups) {
    if (!g.unit) return true; // Unknown unit: can't check this line.
    const def = definition(faction, g.unit);
    if (!def) return true; // A faction unit we don't know without the faction: can't check this line.
    const stats = status[g.unit] === 'upgraded' && def.upgraded ? def.upgraded : def.base;
    const roll = rollOf(stats, obs.kind);
    if (!roll) return false;
    const variableDice = obs.kind === 'combat' && stats.special === 'winnuFlagship';
    if (!variableDice && g.dice.length !== roll.dice) {
      if (g.dice.length === roll.dice + 1 && obs.plasma) extraDice++;
      else return false;
    }
    hits += g.dice.filter((v) => v >= roll.hitOn).length;
    if (obs.jolnarFlagship && g.unit === 'flagship') bonus += 2 * g.dice.length;
  }
  return extraDice <= 1 && (obs.hitsUnknown || (obs.hits >= hits && obs.hits <= hits + bonus));
}

interface UpgradeResult {
  status: Partial<Record<UnitType, UpgradeStatus>>;
  evidence: Partial<Record<UnitType, string>>;
  mismatch: boolean;
}

/** Finds which base/upgraded combinations of a side's units explain every roll it made. */
function inferUpgrades(faction: Faction, dice: DiceObservation[], thresholds: ThresholdObservation[]): UpgradeResult {
  const types = new Set<UnitType>();
  for (const o of dice) for (const g of o.groups) if (g.unit) types.add(g.unit);
  for (const t of thresholds) types.add(t.type);
  const variable = [...types].filter((t) => !!definition(faction, t)?.upgraded);

  const fitsThreshold = (status: Partial<Record<UnitType, UpgradeStatus>>, t: ThresholdObservation) => {
    const def = definition(faction, t.type)!;
    const stats = status[t.type] === 'upgraded' && def.upgraded ? def.upgraded : def.base;
    return stats.combat?.hitOn === t.hitOn;
  };
  // A to-hit value no unit version has means something modified it; ignore it.
  const usableThresholds = thresholds.filter((t) => {
    const def = definition(faction, t.type);
    return !!def && [def.base, def.upgraded].some((s) => s?.combat?.hitOn === t.hitOn);
  });

  const valid: Partial<Record<UnitType, UpgradeStatus>>[] = [];
  for (let mask = 0; mask < 1 << variable.length; mask++) {
    const status: Partial<Record<UnitType, UpgradeStatus>> = {};
    variable.forEach((t, i) => (status[t] = mask & (1 << i) ? 'upgraded' : 'base'));
    if (dice.every((o) => observationFits(faction, status, o)) && usableThresholds.every((t) => fitsThreshold(status, t))) {
      valid.push(status);
    }
  }

  const result: UpgradeResult = { status: {}, evidence: {}, mismatch: valid.length === 0 && variable.length > 0 };
  if (valid.length === 0) return result;
  for (const t of variable) {
    const seen = new Set(valid.map((v) => v[t]));
    if (seen.size !== 1) continue;
    const s = [...seen][0]!;
    result.status[t] = s;
    // Explain with a line that distinguishes the two versions.
    const flipped = { ...valid[0], [t]: s === 'upgraded' ? 'base' : 'upgraded' } as Partial<Record<UnitType, UpgradeStatus>>;
    const decisive =
      dice.find((o) => o.groups.some((g) => g.unit === t) && !observationFits(faction, flipped, o))?.line ??
      usableThresholds.find((o) => o.type === t && !fitsThreshold(flipped, o))?.line;
    if (decisive) result.evidence[t] = decisive;
  }
  return result;
}

/** Used when the log doesn't show a player's faction: generic units only, no flagship. */
const UNKNOWN_FACTION: Faction = { id: '', name: 'an unknown faction', units: {}, abilities: [], abilityText: [] };

export function definition(faction: Faction, type: UnitType): UnitDefinition | undefined {
  try {
    return getUnitDefinition(faction, type);
  } catch {
    return undefined;
  }
}

/** Whether the upgraded unit fights differently from the base one in the simulator. */
function upgradeMatters(faction: Faction, type: UnitType): boolean {
  const def = definition(faction, type);
  if (!def?.upgraded) return false;
  const combatPart = (s: UnitStats) =>
    JSON.stringify([s.combat, s.sustainDamage, s.antiFighterBarrage, s.spaceCannon, s.bombardment, s.planetaryShield, s.special]);
  return combatPart(def.base) !== combatPart(def.upgraded);
}

// ---------------------------------------------------------------------------
// Combat analysis

interface Segment {
  start: number;
  end: number; // exclusive
}

interface TechEvidence {
  player: string;
  tech: TechId;
  line: number;
  seen: boolean;
  message: string;
}

interface UpgradeEvidence {
  player: string;
  type: UnitType;
  line: number;
  status: UpgradeStatus;
  message: string;
}

/** Per-combat facts, before knowledge from other combats in the same log is merged in. */
interface Analysis {
  segment: Segment;
  players: Record<Role, string>;
  system: string;
  planet: string | null;
  invade: boolean;
  summary: string;
  counts: Record<Role, UnitCounts>;
  damaged: Record<Role, UnitCounts>;
  unitFlags: Record<Role, Partial<Record<UnitType, ImportFlag[]>>>;
  dice: Record<Role, DiceObservation[]>;
  thresholds: Record<Role, ThresholdObservation[]>;
  techsSeen: Record<Role, Map<TechId, string>>;
  techsRuledOut: Record<Role, Map<TechId, string>>;
  /** Simulated action cards each side played (and that weren't cancelled), with the log line of each copy. */
  actionCards: Record<Role, Map<ActionCardId, string[]>>;
  notes: ImportFlag[];
  spaceCombat: boolean;
  actual: ActualResult;
}

const ROLES: Role[] = ['attacker', 'defender'];
const forRoles = <T>(make: () => T): Record<Role, T> => ({ attacker: make(), defender: make() });
const bump = (c: UnitCounts, t: UnitType, n: number) => (c[t] = (c[t] ?? 0) + n);
const plural = (n: number, word: string) => `${n} ${n === 1 ? word : word === 'die' ? 'dice' : `${word}s`}`;

function isCombatLine(line: string): boolean {
  return (
    RE.roll.test(line) ||
    RE.toHit.test(line) ||
    RE.started.test(line) ||
    RE.assaultCannon.test(line) ||
    RE.cannonSkip.test(line) ||
    RE.shieldSkip.test(line) ||
    RE.ambush.test(line) ||
    RE.destroyed.test(line) ||
    RE.destroyedOne.test(line) ||
    RE.sustain.test(line) ||
    RE.commit.test(line)
  );
}

function analyze(lines: string[], rolls: (RollLine | null)[], seg: Segment): Analysis | null {
  const range = lines.slice(seg.start, seg.end).map((text, k) => ({ text, i: seg.start + k }));
  const combatStartK = range.findIndex((l) => isCombatLine(l.text));
  if (combatStartK < 0) return null;
  const combatStart = range[combatStartK].i;

  // --- Who, where
  const activation = range.map((l) => l.text.match(RE.activate)).find(Boolean);
  const started = range.map((l) => l.text.match(RE.started)).filter(Boolean) as RegExpMatchArray[];
  const firstRoll = range.map((l) => rolls[l.i]).find(Boolean);
  const attacker = activation?.[1] ?? started[0]?.[1] ?? firstRoll?.actor;
  if (!attacker) return null;
  let system = activation?.[2] ?? started.find((s) => s[5])?.[5] ?? '';
  if (!system) system = range.map((l) => l.text.match(/ in \( (.+?) \)/)?.[1]).find(Boolean) ?? 'unknown system';

  const commits: { player: string; planet: string; owner: string; count: number }[] = [];
  for (const { text } of range) {
    const m = text.match(RE.commit);
    if (!m) continue;
    for (const part of m[2].matchAll(/(\d+) (.+?) to (.+?) \((.+?)\)/g)) {
      commits.push({ player: m[1], count: Number(part[1]), planet: part[3].trim(), owner: part[4].trim() });
    }
  }
  const rollsHere = range.map((l) => rolls[l.i]).filter(Boolean) as RollLine[];
  const destroyedHere = range.map((l) => l.text.match(RE.destroyed)).filter(Boolean) as RegExpMatchArray[];
  const controlLost = range.map((l) => l.text.match(/^(.+?) lost control of /)?.[1]).filter(Boolean) as string[];

  const defender =
    started.find((s) => s[1] === attacker)?.[2] ??
    started.find((s) => s[2] === attacker)?.[1] ??
    commits.find((c) => c.owner !== attacker)?.owner ??
    rollsHere.find((r) => r.actor === attacker && r.kind === 'bombardment')?.target ??
    controlLost.find((p) => p !== attacker) ??
    destroyedHere.find((d) => d[1] === attacker && d[3] !== attacker)?.[3] ??
    rollsHere.find((r) => r.actor !== attacker && r.target === attacker)?.actor ??
    '';
  const players: Record<Role, string> = { attacker, defender };
  const roleOf = (name: string): Role | null =>
    name === attacker ? 'attacker' : name === defender && defender ? 'defender' : null;

  const groundStarts = started.filter((s) => s[3] === 'ground');
  const invadedPlanets = [
    ...groundStarts.map((s) => s[6]).filter(Boolean),
    ...commits.filter((c) => c.player === attacker && c.owner === defender).map((c) => c.planet),
    ...rollsHere.filter((r) => r.actor === attacker && r.kind === 'bombardment' && r.target === defender).map((r) => r.planet),
  ] as string[];
  const planet = invadedPlanets[0] ?? null;
  const invade = planet !== null;

  // --- Replay
  const notes: ImportFlag[] = [];
  const moved: UnitCounts = {};
  const movedDamaged: UnitCounts = {};
  let anyMoved = false;
  const gone = forRoles<UnitCounts>(() => ({}));
  let defenderInfantryGone = 0;
  const lowest = forRoles<UnitCounts>(() => ({}));
  const why = forRoles<Partial<Record<UnitType, string[]>>>(() => ({}));
  const damagedNow = forRoles<UnitCounts>(() => ({}));
  const damagedStart = forRoles<UnitCounts>(() => ({}));
  const dice = forRoles<DiceObservation[]>(() => []);
  const thresholds = forRoles<ThresholdObservation[]>(() => []);
  const techsSeen = forRoles(() => new Map<TechId, string>());
  const techsRuledOut = forRoles(() => new Map<TechId, string>());
  const pdsFromCannonOnly = { value: false };
  // Every ship rolls in space combat and every infantry in ground combat, so those counts are complete.
  const rolledSpace = forRoles(() => false);
  let defenderRolledGround = false;
  let spaceRounds = 0;
  let groundRounds = 0;
  let groundPlanet: string | null = null;
  const steps = new Set<string>();
  const ambushQueue: UnitType[] = [];
  const thirdParty = new Map<string, string[]>();
  const cardsPlayed: { player: string; name: string; line: string; at: number; canceled: boolean }[] = [];
  const unsimulated = new Set<string>();
  let spaceWinner: Role | 'draw' | null = null;
  let groundWinner: Role | 'draw' | null = null;
  let retreated: Role | null = null;

  /** At this moment `role` has at least `present` units of `type`; plus those already gone, at the start. */
  const observe = (role: Role, type: UnitType, present: number, reason: string) => {
    const goneBefore = type === 'infantry' && role === 'defender' ? defenderInfantryGone : (gone[role][type] ?? 0);
    const atStart = present + goneBefore;
    if (atStart > (lowest[role][type] ?? 0)) {
      lowest[role][type] = atStart;
      (why[role][type] ??= []).push(goneBefore ? `${reason} (+${goneBefore} lost earlier)` : reason);
    }
  };
  const loseDamaged = (role: Role, type: UnitType, n: number) => {
    const fromNow = Math.min(n, damagedNow[role][type] ?? 0);
    damagedNow[role][type] = (damagedNow[role][type] ?? 0) - fromNow;
    if (n > fromNow) bump(damagedStart[role], type, n - fromNow);
  };
  const killed = forRoles<UnitCounts>(() => ({}));
  const lose = (
    role: Role,
    type: UnitType,
    n: number,
    damaged: boolean,
    onPlanet: string | null,
    reason: string,
    destroyed = false,
  ) => {
    if (type === 'infantry' && role === 'defender') {
      if (onPlanet === null || onPlanet !== planet) return; // Not on the planet the simulator fights over.
      observe(role, type, n, reason);
      defenderInfantryGone += n;
      if (destroyed) bump(killed[role], type, n);
      return;
    }
    observe(role, type, n, reason);
    bump(gone[role], type, n);
    if (damaged) loseDamaged(role, type, n);
    if (destroyed && !(type === 'infantry' && onPlanet && onPlanet !== planet)) bump(killed[role], type, n);
  };
  const techSeen = (player: string, tech: TechId, line: string) => {
    const role = roleOf(player);
    if (role && !techsSeen[role].has(tech)) techsSeen[role].set(tech, line);
  };

  for (const { text, i } of range) {
    const preCombat = i < combatStart;

    let m = text.match(RE.add);
    if (m) {
      const type = unitFromName(m[4]);
      if (preCombat && m[1] === attacker && m[5] === system) {
        if (!type) {
          notes.push({ level: 'warn', message: `Unknown unit "${m[4]}" moved in by ${attacker}; not imported.` });
        } else {
          anyMoved = true;
          bump(moved, type, Number(m[2]));
          if (m[3]) bump(movedDamaged, type, Number(m[2]));
        }
      } else if (type) {
        const role = roleOf(m[1]);
        const n = Number(m[2]);
        const onPlanet = m[6]?.trim();
        if (role === 'defender' && type === 'infantry' && onPlanet && onPlanet === planet) {
          // Infantry placed before combat (Magen Defense Grid) are there at the start; later arrivals aren't.
          if (preCombat) observe('defender', 'infantry', n, `${n} placed before combat`);
          else defenderInfantryGone -= n;
        } else if (role && !preCombat && (m[5] === system || (onPlanet && role === 'attacker'))) {
          // Produced mid-combat, or landing on a planet after a matching "removed ... from ( system )" line.
          bump(gone[role], type, -n);
        }
      }
      continue;
    }

    m = text.match(RE.remove);
    if (m) {
      const role = roleOf(m[1]);
      const type = unitFromName(m[4]);
      const inSystem = m[5] === system;
      const onPlanetName = m[6]?.trim() ?? null;
      if (!role || !type || !(inSystem || onPlanetName)) continue;
      if (preCombat) {
        if (role === 'attacker' && inSystem) bump(moved, type, -Number(m[2]));
        continue;
      }
      // Retreats, capacity, blockades and lost planets take units out of the combat.
      if (role === 'defender' && type === 'infantry' && inSystem) {
        notes.push({ level: 'info', message: `${defender}'s infantry carried in space aren't simulated.` });
        continue;
      }
      lose(role, type, Number(m[2]), !!m[3], onPlanetName, `${m[2]} removed later`, /destroyed/.test(m[7]));
      continue;
    }

    m = text.match(RE.destroyed);
    if (m) {
      const role = roleOf(m[3]);
      const type = unitFromName(m[5]);
      if (role && type) {
        const where = m[7] ?? null;
        if (role === 'defender' && type === 'infantry' && !where) {
          notes.push({ level: 'info', message: `${defender}'s infantry carried in space aren't simulated.` });
        } else {
          lose(role, type, Number(m[2]), !!m[4], where, `${m[2]} destroyed`, true);
        }
      }
      continue;
    }

    m = text.match(RE.destroyedOne);
    if (m) {
      const role = roleOf(m[2]);
      const type = unitFromName(m[3]);
      if (role && type) lose(role, type, 1, (damagedNow[role][type] ?? 0) > 0, null, `1 destroyed`, true);
      continue;
    }

    m = text.match(RE.damaged);
    if (m) {
      const role = roleOf(m[1]);
      const type = unitFromName(m[3]);
      if (role && type) {
        bump(damagedNow[role], type, Number(m[2]));
        observe(role, type, damagedNow[role][type]!, `${damagedNow[role][type]} damaged`);
      }
      continue;
    }

    m = text.match(RE.repaired);
    if (m) {
      const role = roleOf(m[1]);
      const type = unitFromName(m[3]);
      if (role && type) loseDamaged(role, type, Number(m[2]));
      continue;
    }

    m = text.match(RE.started);
    if (m) {
      if (m[3] === 'space') spaceRounds = Math.max(spaceRounds, Number(m[4]));
      else {
        if (m[6]) groundPlanet = m[6];
        if (groundPlanet === planet) groundRounds = Math.max(groundRounds, Number(m[4]));
      }
      continue;
    }

    m = text.match(/^(.+?) won (space|ground) combat against (.+?)\.$/);
    if (m) {
      const role = roleOf(m[1]);
      if (m[2] === 'space') spaceWinner = role;
      else if (groundPlanet === planet) {
        groundWinner = role;
        if (role === 'defender') observe('defender', 'infantry', 1, 'won the ground combat');
      }
      continue;
    }
    m = text.match(/^(Space|Ground) combat ended in a draw between /);
    if (m) {
      if (m[1] === 'Space') spaceWinner = 'draw';
      else if (groundPlanet === planet) groundWinner = 'draw';
      continue;
    }

    m = text.match(RE.ambush);
    if (m) {
      steps.add('Ambush');
      for (const part of m[3].matchAll(/(\d+) (cruiser|destroyer) dic?e/g)) {
        const type = part[2] as UnitType;
        for (let k = 0; k < Number(part[1]); k++) ambushQueue.push(type);
        const role = roleOf(m[1]);
        if (role) observe(role, type, Number(part[1]), `${part[1]} used for Ambush`);
      }
      continue;
    }

    m = text.match(RE.toHit);
    if (m) {
      const role = roleOf(m[1]);
      for (let k = 0; k < Number(m[2]); k++) {
        const type = ambushQueue.shift();
        if (role && type && k === 0) thresholds[role].push({ type, hitOn: Number(m[3]), line: text });
      }
      continue;
    }

    m = text.match(RE.commit);
    if (m) {
      const total = [...m[2].matchAll(/(\d+) infantry to /g)].reduce((s, p) => s + Number(p[1]), 0);
      if (roleOf(m[1]) === 'attacker' && total > 0) {
        observe('attacker', 'infantry', total, `${total} committed to ground combat`);
      }
      continue;
    }

    m = text.match(RE.shieldSkip);
    if (m) {
      steps.add('Bombardment blocked by Planetary Shield');
      if (m[1] === attacker && defender && !lowest.defender.pds) {
        observe('defender', 'pds', 1, 'Planetary Shield blocked Bombardment');
        pdsFromCannonOnly.value = true;
      }
      continue;
    }

    m = text.match(RE.cannonSkip);
    if (m) {
      if (!roleOf(m[1])) thirdParty.set(m[1], [...(thirdParty.get(m[1]) ?? []), 'could fire Space Cannon but skipped']);
      continue;
    }

    if (RE.assaultCannon.test(text)) {
      steps.add('Assault Cannon');
      techSeen(text.match(RE.assaultCannon)![1], 'assaultCannon', text);
      continue;
    }

    m = text.match(RE.played);
    if (m) {
      cardsPlayed.push({ player: m[1], name: m[2], line: text, at: i, canceled: false });
      continue;
    }

    m = text.match(/^(.+?)'s (.+?) action card was canceled\.$/);
    if (m) {
      const card = [...cardsPlayed].reverse().find((c) => c.player === m![1] && c.name === m![2]);
      if (card) card.canceled = true;
      continue;
    }

    const roll = rolls[i];
    if (roll) {
      const role = roleOf(roll.actor);
      const label = {
        combat: 'combat roll',
        afb: 'Anti-Fighter Barrage',
        spaceCannonOffense: 'Space Cannon Offense',
        spaceCannonDefense: 'Space Cannon Defense',
        bombardment: 'Bombardment',
      }[roll.kind];
      if (roll.kind !== 'combat') steps.add(label === 'Anti-Fighter Barrage' ? 'Anti-Fighter Barrage' : label);
      for (const effect of roll.effects) {
        const tech = TECH_KEYWORDS[effect];
        if (tech === 'antimassDeflectors') {
          if (roll.target) techSeen(roll.target, tech, text);
        } else if (tech) techSeen(roll.actor, tech, text);
        if (UNSIMULATED_EFFECTS.includes(effect) && effect !== 'J.N.S. HYLARIM') unsimulated.add(`${effect} (${roll.actor})`);
      }
      if (!role) {
        if (roll.kind === 'spaceCannonOffense' || roll.kind === 'spaceCannonDefense') {
          thirdParty.set(roll.actor, [
            ...(thirdParty.get(roll.actor) ?? []),
            `fired ${label} at ${roll.target}: ${plural(roll.groups.reduce((s, g) => s + g.dice.length, 0), 'die')}, ${plural(roll.hits, 'hit')}`,
          ]);
        }
        continue;
      }
      // Ruled-out techs: these always show on the roll when the player has them.
      if ((roll.kind === 'spaceCannonOffense' || roll.kind === 'spaceCannonDefense' || roll.kind === 'bombardment') && !roll.effects.includes('PLASMA SCORING')) {
        techsRuledOut[role].set('plasmaScoring', text);
      }
      if ((roll.kind === 'spaceCannonOffense' || roll.kind === 'spaceCannonDefense') && !roll.effects.includes('ANTIMASS DEFLECTORS')) {
        const targetRole = roll.target ? roleOf(roll.target) : null;
        if (targetRole) techsRuledOut[targetRole].set('antimassDeflectors', text);
      }

      const ground = roll.kind === 'combat' && inGroundCombat(range, i, lines);
      if (roll.kind === 'combat' && !ground) rolledSpace[role] = true;
      if (ground && role === 'defender' && groundPlanet === planet) defenderRolledGround = true;
      const counts = new Map<UnitType, number>();
      for (const g of roll.groups) if (g.unit) counts.set(g.unit, (counts.get(g.unit) ?? 0) + 1);
      for (const [type, n] of counts) {
        if (roll.kind === 'combat' && ground && role === 'defender' && type === 'infantry') {
          if (groundPlanet === planet) observe(role, type, n, `rolled ${n} in ground combat round ${groundRounds}`);
          continue;
        }
        if (roll.reroll) continue;
        const when =
          roll.kind === 'combat' ? (ground ? `ground combat round ${groundRounds}` : `space combat round ${spaceRounds}`) : label;
        if (type === 'pds' && role === 'defender') {
          if (roll.kind === 'spaceCannonDefense') {
            observe(role, type, n, `${n} fired Space Cannon Defense`);
            pdsFromCannonOnly.value = false;
          } else {
            const before = lowest.defender.pds ?? 0;
            observe(role, type, n, `${n} fired Space Cannon Offense`);
            if ((lowest.defender.pds ?? 0) > before) pdsFromCannonOnly.value = true;
          }
          continue;
        }
        observe(role, type, n, type === 'pds' ? `${n} PDS fired ${label}` : `${plural(n, 'unit')} rolled in ${when}`);
      }
      dice[role].push({
        kind: roll.kind,
        hits: roll.hits,
        groups: roll.groups,
        plasma: roll.effects.includes('PLASMA SCORING'),
        jolnarFlagship: roll.effects.includes('J.N.S. HYLARIM'),
        hitsUnknown: roll.effects.includes('X-89 BACTERIAL WEAPON'),
        line: text,
      });
      continue;
    }

    m = text.match(RE.keyword);
    if (m) {
      const tech = TECH_KEYWORDS[m[2]];
      if (tech) techSeen(m[1], tech, text);
      if (m[2] === 'MUNITIONS RESERVES') unsimulated.add(`MUNITIONS RESERVES rerolls (${m[1]})`);
      continue;
    }
    m = text.match(/^(.+?) retreated from space combat/);
    if (m) {
      steps.add('Retreat');
      retreated = roleOf(m[1]);
    }
  }

  // --- Counts
  const counts = forRoles<UnitCounts>(() => ({}));
  const unitFlags = forRoles<Partial<Record<UnitType, ImportFlag[]>>>(() => ({}));
  const flag = (role: Role, type: UnitType, level: FlagLevel, message: string) =>
    (unitFlags[role][type] ??= []).push({ level, message });

  for (const type of ALL_UNIT_TYPES) {
    const seen = lowest.attacker[type] ?? 0;
    const movedIn = Math.max(0, moved[type] ?? 0);
    const reasons = why.attacker[type] ?? [];
    if (type === 'spacedock') {
      if (movedIn || seen) notes.push({ level: 'info', message: `${attacker}'s space dock moving with the fleet isn't simulated.` });
      continue;
    }
    const count = type === 'pds' ? seen : Math.max(movedIn, seen);
    if (!count) continue;
    counts.attacker[type] = count;
    const shown = reasons[reasons.length - 1] ?? '';
    const complete = SHIP_TYPES.includes(type) && rolledSpace.attacker;
    if (type === 'pds') {
      flag('attacker', type, 'warn', `Space cannon support: ${shown}. PDS in range that didn't fire aren't in the log.`);
    } else if (seen > movedIn && anyMoved) {
      flag('attacker', type, complete ? 'info' : 'warn', `Moved in ${movedIn}, but ${shown}, so the rest were already in the system.`);
    } else if (movedIn) {
      flag('attacker', type, 'info', `Moved in: ${movedIn}${movedDamaged[type] ? ` (${movedDamaged[type]} damaged)` : ''}.`);
    } else if (complete) {
      flag('attacker', type, 'info', `${shown}.`);
    } else {
      flag('attacker', type, 'warn', `At least ${count}: ${shown}. Units that never rolled or died aren't in the log.`);
    }
  }
  if (!SHIP_TYPES.some((t) => counts.attacker[t])) {
    notes.push({ level: 'warn', message: `None of ${attacker}'s ships show up in the log. Add them by hand.` });
  }

  const captured = range.some((l) => l.text === `${attacker} gained control of ${planet}.`);
  if (defender) {
    for (const type of ALL_UNIT_TYPES) {
      const count = lowest.defender[type] ?? 0;
      if (!count) continue;
      counts.defender[type] = count;
      const reasons = why.defender[type]?.at(-1) ?? '';
      const complete =
        (SHIP_TYPES.includes(type) && rolledSpace.defender) ||
        (type === 'infantry' && (defenderRolledGround || captured)) ||
        type === 'spacedock';
      if (type === 'pds' && pdsFromCannonOnly.value) {
        flag('defender', type, 'warn', `${reasons}. Some may be in adjacent systems, and PDS that didn't fire aren't in the log.`);
      } else if (complete) {
        flag('defender', type, 'info', `${reasons}.`);
      } else {
        flag('defender', type, 'warn', `At least ${count}: ${reasons}. More may have survived without showing in the log.`);
      }
    }
    if (invade && !counts.defender.infantry) {
      if (captured) {
        flag('defender', 'infantry', 'info', `${attacker} took ${planet} without losing ground forces to it, so there were none.`);
      } else {
        flag('defender', 'infantry', 'warn', `No infantry on ${planet} showed up in the log, so none were imported.`);
      }
    }
    if (!counts.defender.spacedock && !counts.defender.pds && invade) {
      notes.push({ level: 'info', message: `Structures on ${planet} only show in the log when they fire or are destroyed.` });
    }
  }

  const damaged = forRoles<UnitCounts>(() => ({}));
  for (const role of ROLES) {
    for (const type of ALL_UNIT_TYPES) {
      const n = Math.min(counts[role][type] ?? 0, (damagedStart[role][type] ?? 0) + (role === 'attacker' ? (movedDamaged[type] ?? 0) : 0));
      if (n > 0) {
        damaged[role][type] = n;
        flag(role, type, 'info', `${n} already damaged when the combat started.`);
      }
    }
  }

  // Assault Cannon fires automatically, so a side with 3+ non-fighter ships that didn't use it doesn't have it.
  if (spaceRounds > 0) {
    for (const role of ROLES) {
      const nonFighters = SHIP_TYPES.filter((t) => t !== 'fighter').reduce((s, t) => s + (counts[role][t] ?? 0), 0);
      if (nonFighters >= 3 && !techsSeen[role].has('assaultCannon')) {
        techsRuledOut[role].set('assaultCannon', `${players[role]} had ${nonFighters} non-fighter ships and didn't use it.`);
      }
    }
  }

  // --- Notes
  for (const [player, what] of thirdParty) {
    notes.push({ level: 'warn', message: `${player} ${what.join('; ')}. The simulator has only two sides, so this isn't included.` });
  }
  const otherPlanets = [...new Set(invadedPlanets)].filter((p) => p !== planet);
  if (otherPlanets.length) {
    notes.push({ level: 'warn', message: `Fighting on ${otherPlanets.join(', ')} isn't simulated; only ${planet} is.` });
  }
  const otherOwners = [...new Set(commits.filter((c) => c.player === attacker && c.owner !== attacker && c.owner !== defender).map((c) => c.owner))];
  if (otherOwners.length) notes.push({ level: 'warn', message: `Planets owned by ${otherOwners.join(', ')} were also invaded; not simulated.` });
  // Cards the simulator plays are loaded into the side; the rest are listed.
  const actionCards = forRoles(() => new Map<ActionCardId, string[]>());
  const unsimulatedCards: string[] = [];
  const canceledCards: string[] = [];
  for (const played of cardsPlayed) {
    const role = roleOf(played.player);
    const card = role && actionCardsFor(role).find((c) => c.name.toUpperCase() === played.name);
    const label = `${played.name} (${played.player})`;
    if (played.canceled) canceledCards.push(label);
    else if (role && card) actionCards[role].set(card.id, [...(actionCards[role].get(card.id) ?? []), played.line]);
    else if (played.at >= combatStart) unsimulatedCards.push(label);
  }
  if (unsimulatedCards.length) {
    notes.push({ level: 'info', message: `Action cards played that aren't simulated: ${unsimulatedCards.join(', ')}.` });
  }
  if (canceledCards.length) {
    notes.push({ level: 'info', message: `Cancelled by Sabotage, so left out: ${canceledCards.join(', ')}.` });
  }
  if (unsimulated.size) notes.push({ level: 'info', message: `Effects in the log the simulator doesn't model: ${[...unsimulated].join(', ')}.` });
  if (!defender) notes.push({ level: 'warn', message: 'No defending player found in the log.' });

  const stepList = [
    ...['Space Cannon Offense', 'Assault Cannon', 'Ambush', 'Anti-Fighter Barrage'].filter((s) => steps.has(s)),
    ...(spaceRounds ? [plural(spaceRounds, 'space combat round')] : []),
    ...['Retreat', 'Bombardment', 'Bombardment blocked by Planetary Shield', 'Space Cannon Defense'].filter((s) => steps.has(s)),
    ...(groundRounds ? [plural(groundRounds, 'ground combat round')] : []),
  ];

  // --- What happened
  const survivors = forRoles<UnitCounts>(() => ({}));
  for (const role of ROLES) {
    for (const type of ALL_UNIT_TYPES) {
      const start = counts[role][type] ?? 0;
      const lost = Math.min(start, killed[role][type] ?? 0);
      if (lost) killed[role][type] = lost;
      else delete killed[role][type];
      if (start - lost > 0) survivors[role][type] = start - lost;
    }
  }
  const hasShips = (role: Role) => SHIP_TYPES.some((t) => (survivors[role][t] ?? 0) > 0);
  // As in the simulator, ground forces carried by a fleet that no longer exists are lost. The log doesn't say so.
  if (!hasShips('attacker') && survivors.attacker.infantry) {
    bump(killed.attacker, 'infantry', survivors.attacker.infantry);
    delete survivors.attacker.infantry;
  }
  let space: SpaceOutcome = 'noCombat';
  if (spaceRounds > 0) {
    if (spaceWinner) space = spaceWinner;
    else if (retreated) space = retreated === 'attacker' ? 'defender' : 'attacker';
    else if (hasShips('attacker') !== hasShips('defender')) space = hasShips('attacker') ? 'attacker' : 'defender';
    else space = 'draw';
  }
  let invasion: InvasionOutcome = 'notAttempted';
  if (invade) {
    if (groundWinner === 'attacker' || captured) invasion = 'captured';
    else if (groundWinner === 'defender') invasion = 'repelled';
    else if (groundWinner === 'draw') invasion = 'draw';
    else if (commits.some((c) => c.player === attacker && c.planet === planet)) invasion = 'repelled';
  }
  let winner: ActualResult['winner'];
  if (invasion === 'captured') winner = 'attacker';
  else if (invasion === 'repelled') winner = 'defender';
  else if (invasion === 'draw') winner = 'draw';
  else {
    // As in the simulator: whoever holds space wins, and an invasion that never landed is a defender win.
    const opponent = (role: Role): Role => (role === 'attacker' ? 'defender' : 'attacker');
    const holds = (role: Role) => space === role || (space === 'noCombat' && hasShips(role) && !hasShips(opponent(role)));
    winner = holds('attacker') ? 'attacker' : holds('defender') ? 'defender' : 'draw';
    if (invade && winner === 'draw' && (survivors.defender.infantry ?? 0) > 0) winner = 'defender';
  }
  const actual: ActualResult = {
    winner,
    space,
    invasion,
    spaceRounds,
    groundRounds,
    lost: killed,
    survivors,
    retreated,
  };

  return {
    segment: seg,
    players,
    system,
    planet,
    invade,
    summary: stepList.join(' · '),
    counts,
    damaged,
    unitFlags,
    dice,
    thresholds,
    techsSeen,
    techsRuledOut,
    actionCards,
    notes: dedupe(notes),
    spaceCombat: spaceRounds > 0,
    actual,
  };
}

/** Whether the line at `i` comes after a ground combat round started (so a combat roll is a ground roll). */
function inGroundCombat(range: { text: string; i: number }[], i: number, lines: string[]): boolean {
  for (let j = i - 1; j >= range[0].i; j--) {
    const st = lines[j].match(RE.started);
    if (st) return st[3] === 'ground';
  }
  return false;
}

function dedupe(flags: ImportFlag[]): ImportFlag[] {
  const seen = new Set<string>();
  return flags.filter((f) => !seen.has(f.message) && !!seen.add(f.message));
}

// ---------------------------------------------------------------------------
// Entry point

/** Reads pasted BGA log text (newest line first, or oldest first) and returns every combat in it. */
export function parseBgaLog(text: string): BgaImport {
  // Keep each line's character range in the pasted text, so a combat can be found in it again.
  const raw: { line: string; start: number; end: number }[] = [];
  let offset = 0;
  for (const piece of text.split(/(?<=\n)/)) {
    raw.push({ line: cleanLine(piece), start: offset, end: offset + piece.replace(/\r?\n$/, '').length });
    offset += piece.length;
  }
  let kept = raw.filter((r) => r.line && !r.line.startsWith('==='));
  let lines = kept.map((r) => r.line);
  if (isNewestFirst(lines)) {
    kept = kept.reverse();
    lines = lines.reverse();
  }
  // Text around the log (a note, a heading) isn't part of any combat; trim it from the selection.
  const players = new Set(
    lines.flatMap((l) => {
      const m = l.match(RE.activate) ?? l.match(RE.roll) ?? l.match(RE.started);
      return m ? [m[1]] : [];
    }),
  );
  const isLogLine = (l: string) => [...players].some((p) => l.startsWith(`${p} `) || l.startsWith(`${p}'s `)) || / between /.test(l);
  const sourceOf = (seg: Segment) => {
    let { start, end } = seg;
    while (start < end - 1 && !isLogLine(lines[start])) start++;
    while (end > start + 1 && !isLogLine(lines[end - 1])) end--;
    const spans = kept.slice(start, end);
    return { start: Math.min(...spans.map((s) => s.start)), end: Math.max(...spans.map((s) => s.end)) };
  };
  const rolls = lines.map((l) => {
    const m = l.match(RE.roll);
    return m ? parseRoll(m) : null;
  });

  const guesses = guessFactions(lines, rolls);
  const factionOf = (player: string) => guesses[player]?.factionId ?? '';

  // A tactical action runs from activation to "finished"; a paste may start part-way through one.
  const segments: Segment[] = [];
  let start = 0;
  lines.forEach((line, i) => {
    if (RE.activate.test(line) && i > start) {
      // A strategy card like Warfare activates the system on the line just before.
      const by = i - 1 >= start && /and activate a system\.$/.test(lines[i - 1]) ? i - 1 : i;
      if (by > start) segments.push({ start, end: by });
      start = by;
    } else if (RE.finish.test(line)) {
      segments.push({ start, end: i + 1 });
      start = i + 1;
    }
  });
  if (start < lines.length) segments.push({ start, end: lines.length });

  const analyses = segments.map((s) => analyze(lines, rolls, s)).filter((a): a is Analysis => a !== null);

  // Upgrades and techs are never lost: what a player had in an earlier combat they still have later,
  // and what they lacked in a later combat they lacked earlier too.
  const upgradeEvidence: UpgradeEvidence[] = [];
  const techEvidence: TechEvidence[] = [];
  const localUpgrades = analyses.map((a) =>
    forRolesFrom((role) => {
      const factionId = factionOf(a.players[role]);
      return inferUpgrades(factionId ? getFaction(factionId) : UNKNOWN_FACTION, a.dice[role], a.thresholds[role]);
    }),
  );
  analyses.forEach((a, k) => {
    for (const role of ROLES) {
      const player = a.players[role];
      const local = localUpgrades[k][role];
      if (local) {
        for (const [type, status] of Object.entries(local.status) as [UnitType, UpgradeStatus][]) {
          upgradeEvidence.push({ player, type, line: a.segment.start, status, message: local.evidence[type] ?? '' });
        }
      }
      for (const [tech, line] of a.techsSeen[role]) techEvidence.push({ player, tech, line: a.segment.start, seen: true, message: line });
      for (const [tech, line] of a.techsRuledOut[role]) techEvidence.push({ player, tech, line: a.segment.start, seen: false, message: line });
    }
  });
  // Tech uses outside any combat (Magen Defense Grid placing infantry, say) still show ownership.
  lines.forEach((line, i) => {
    const m = line.match(RE.keyword);
    const tech = m && TECH_KEYWORDS[m[2]];
    if (m && tech) techEvidence.push({ player: m[1], tech, line: i, seen: true, message: line });
  });
  // "X researched Y" lines. A paste that reaches back to the setup shows every tech and upgrade researched, so what
  // a player hadn't researched (and didn't start with) they didn't have.
  const wholeGame = lines.some((line) => RE.setup.test(line));
  const research = lines.flatMap((line, i) => {
    const m = line.match(RE.research);
    return m ? [{ player: m[1], name: m[2].toUpperCase(), line: i, message: line }] : [];
  });
  // Research happens outside tactical actions, so only lines before the activation count for its combat.
  const activation = (s: Segment) => {
    for (let i = s.start; i < s.end; i++) if (RE.activate.test(lines[i])) return i;
    return s.start;
  };
  const notResearched = "Not researched before this combat, and the log goes back to the game's setup.";

  const combats = analyses.map((a, k) => {
    const flags = forRoles<SideFlags>(() => ({ faction: [], units: {}, upgrades: {}, techs: {}, actionCards: {} }));
    const sides = forRolesFrom<SideInput>((role) => {
      const player = a.players[role];
      let factionId = factionOf(player);
      flags[role].faction.push(
        ...(guesses[player]?.flags ??
          (player ? [{ level: 'warn' as const, message: `Nothing in the log shows ${player}'s faction. Choose it.` }] : [])),
      );
      return { factionId, counts: a.counts[role], damaged: a.damaged[role], upgrades: {}, techs: [] };
    });

    // No mirror matches: keep the better-supported guess.
    if (sides.attacker.factionId && sides.attacker.factionId === sides.defender.factionId) {
      const weaker: Role = flags.defender.faction.some((f) => f.level === 'warn') ? 'defender' : 'attacker';
      sides[weaker].factionId = '';
      flags[weaker].faction = [
        { level: 'warn', message: `Both players looked like the same faction, so ${a.players[weaker]}'s was left for you to choose.` },
      ];
    }

    for (const role of ROLES) {
      const side = sides[role];
      const player = a.players[role];
      side.techs = [];
      side.actionCards = [...a.actionCards[role]].flatMap(([card, lines]) => lines.map(() => card));
      for (const [card, lines] of a.actionCards[role]) {
        flags[role].actionCards[card] = lines.map((line) => ({ level: 'info', message: `Played in this combat: "${shorten(line)}"` }));
      }
      for (const [type, list] of Object.entries(a.unitFlags[role]) as [UnitType, ImportFlag[]][]) flags[role].units[type] = list;
      const faction = side.factionId ? getFaction(side.factionId) : UNKNOWN_FACTION;
      const local = localUpgrades[k][role];
      const researched = research.filter((r) => r.player === player && r.line < activation(a.segment));
      if (local?.mismatch) {
        flags[role].faction.push({
          level: 'warn',
          message: `${player}'s dice don't match any mix of base and upgraded units for ${faction.name}. An action card or ability may have changed the rolls.`,
        });
      }

      // Upgrades
      for (const type of ALL_UNIT_TYPES) {
        if (!(side.counts[type] ?? 0) || !upgradeMatters(faction, type)) continue;
        const name = definition(faction, type)!.upgraded!.name;
        const here = local?.status[type];
        const earlierUp = upgradeEvidence.find((e) => e.player === player && e.type === type && e.status === 'upgraded' && e.line < a.segment.start);
        const laterBase = upgradeEvidence.find((e) => e.player === player && e.type === type && e.status === 'base' && e.line > a.segment.start);
        const researchedUp = researched.find((r) => r.name === name.toUpperCase());
        const list = (flags[role].upgrades[type] ??= []);
        if (here) {
          side.upgrades[type] = here === 'upgraded';
          const evidence = local?.evidence[type];
          list.push({
            level: 'info',
            message: `${here === 'upgraded' ? `Has ${name}` : `Not upgraded to ${name}`}: the dice only add up that way${evidence ? ` ("${shorten(evidence)}")` : ''}.`,
          });
          if (here === 'base' && researchedUp) {
            list.push({ level: 'warn', message: `But ${player} researched it before this combat ("${shorten(researchedUp.message)}").` });
          } else if (here === 'upgraded' && !researchedUp && wholeGame) {
            list.push({ level: 'warn', message: `But the log shows no research of ${name} before this combat.` });
          }
        } else if (researchedUp) {
          side.upgrades[type] = true;
          list.push({ level: 'info', message: `Researched before this combat: "${shorten(researchedUp.message)}"` });
        } else if (earlierUp) {
          side.upgrades[type] = true;
          list.push({ level: 'info', message: `${player} already had ${name} in an earlier combat in this log.` });
        } else if (laterBase) {
          side.upgrades[type] = false;
          list.push({ level: 'info', message: `${player} still didn't have ${name} in a later combat in this log.` });
        } else if (wholeGame) {
          side.upgrades[type] = false;
          list.push({ level: 'info', message: notResearched });
        } else {
          side.upgrades[type] = false;
          list.push({ level: 'warn', message: `The log doesn't show whether ${player} has ${name}. Assumed not; check this.` });
        }
      }

      // Technologies
      const opponent = sides[role === 'attacker' ? 'defender' : 'attacker'];
      const hasSustain = ALL_UNIT_TYPES.some((t) => (side.counts[t] ?? 0) > 0 && definition(faction, t)?.base.sustainDamage);
      const nonFighters = SHIP_TYPES.filter((t) => t !== 'fighter').reduce((s, t) => s + (side.counts[t] ?? 0), 0);
      const bombards = ALL_UNIT_TYPES.some((t) => (side.counts[t] ?? 0) > 0 && definition(faction, t)?.base.bombardment);
      const relevant: Record<TechId, boolean> = {
        plasmaScoring: (side.counts.pds ?? 0) > 0 || (role === 'attacker' && a.invade && bombards),
        antimassDeflectors: (opponent.counts.pds ?? 0) > 0,
        gravitonLaserSystem: (side.counts.pds ?? 0) > 0,
        duraniumArmor: hasSustain,
        assaultCannon: nonFighters >= 3 && a.spaceCombat,
        magenDefenseGrid: role === 'defender' && a.invade && ((side.counts.pds ?? 0) > 0 || (side.counts.spacedock ?? 0) > 0),
        nonEuclideanShielding: hasSustain,
        l4Disruptors: role === 'attacker' && a.invade,
        dimensionalSplicer: a.spaceCombat && /wormhole/i.test(a.system),
        valkyrieParticleWeave: a.invade,
      };
      const available = side.factionId ? techsForFaction(side.factionId) : TECHS.filter((t) => !t.faction);
      for (const tech of available) {
        const seenHere = a.techsSeen[role].get(tech.id);
        const seenBefore = techEvidence.find((e) => e.player === player && e.tech === tech.id && e.seen && e.line <= a.segment.end);
        const ruledOut =
          a.techsRuledOut[role].get(tech.id) ??
          techEvidence.find((e) => e.player === player && e.tech === tech.id && !e.seen && e.line >= a.segment.start)?.message;
        const researchedTech = researched.find((r) => TECH_KEYWORDS[r.name] === tech.id);
        const starting = faction.startingTechs?.includes(tech.id);
        const maybeStarting = faction.startingTechChoice?.includes(tech.id);
        // Nekro copies techs without researching them.
        const unresearched = wholeGame && side.factionId && side.factionId !== 'nekro' && !maybeStarting;
        const list: ImportFlag[] = [];
        if (seenHere) {
          side.techs.push(tech.id);
          list.push({ level: 'info', message: `Seen in this combat: "${shorten(seenHere)}"` });
        } else if (researchedTech) {
          side.techs.push(tech.id);
          list.push({ level: 'info', message: `Researched before this combat: "${shorten(researchedTech.message)}"` });
        } else if (starting) {
          side.techs.push(tech.id);
          list.push({ level: 'info', message: `${faction.name} start the game with ${tech.name}.` });
        } else if (seenBefore) {
          side.techs.push(tech.id);
          list.push({ level: 'info', message: `Seen earlier in this log: "${shorten(seenBefore.message)}"` });
        } else if (ruledOut) {
          list.push({ level: 'info', message: `Not owned: it would have shown here ("${shorten(ruledOut)}").` });
        } else if (unresearched && relevant[tech.id]) {
          list.push({ level: 'info', message: notResearched });
        } else if (relevant[tech.id]) {
          const why = maybeStarting ? ` It may be ${faction.name}'s starting tech.` : '';
          list.push({ level: 'warn', message: `The log doesn't show ${tech.name}; assumed not owned.${why} Check whether ${player} has it.` });
        }
        if (list.length) flags[role].techs[tech.id] = list;
      }
    }

    const verb = a.invade ? 'invades' : 'attacks';
    const title = a.players.defender
      ? `${a.players.attacker} ${verb} ${a.players.defender} at ( ${a.system} )`
      : `${a.players.attacker} at ( ${a.system} )`;
    return {
      title,
      source: sourceOf(a.segment),
      summary: a.summary,
      system: a.system,
      planet: a.planet,
      players: a.players,
      attacker: sides.attacker,
      defender: sides.defender,
      invade: a.invade,
      wormhole: /wormhole/i.test(a.system),
      flags,
      notes: a.notes,
      actual: a.actual,
    } satisfies ImportedCombat;
  });

  return {
    combats: combats.reverse(),
    factions: Object.fromEntries(Object.entries(guesses).map(([p, g]) => [p, g.factionId])),
  };
}

function forRolesFrom<T>(make: (role: Role) => T): Record<Role, T> {
  return { attacker: make('attacker'), defender: make('defender') };
}

const shorten = (line: string, max = 110) => (line.length > max ? `${line.slice(0, max - 1)}…` : line);
