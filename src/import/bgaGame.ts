/**
 * Whole-game statistics from a Board Game Arena log: players, factions, score, trade goods, units produced and
 * lost, and how lucky each player's dice were. The result is saved as a game record (see games/README.md).
 */
import { FACTIONS, getFaction } from '../engine/data/factions';
import { ALL_UNIT_TYPES, type Faction, type UnitType } from '../engine/types';
import { cleanLine, definition, isNewestFirst, parseBgaLog, parseRoll, RE, rollOf, unitFromName, type RollLine } from './bga';

// ---------------------------------------------------------------------------
// Record format

export interface UnitTally {
  /** On the board at setup. */
  starting: number;
  /** Paid for with a production ability. */
  produced: number;
  /** Placed without paying: Magen Defense Grid infantry, structures from Construction and the like. */
  placed: number;
  lost: number;
  /** Resource cost of the units produced. Structures have no cost. */
  producedCost: number;
  /** Resource cost of the units lost. */
  lostCost: number;
}

export interface DiceLuck {
  dice: number;
  hits: number;
  expectedHits: number;
  /**
   * Where the hits fall among every outcome the same dice could have rolled: 50 is average luck, 90 means luckier
   * than 90% of outcomes. Null with no dice.
   */
  hitPercentile: number | null;
  /** Mean natural die face (modifiers removed); 5.5 is average. */
  averageFace: number | null;
  /** The same percentile for the sum of natural faces, ignoring whether dice hit. */
  facePercentile: number | null;
}

export interface PlayerRecord {
  name: string;
  factionId: string;
  score: number;
  tradeGoods: { gained: number; spent: number; lost: number };
  units: Partial<Record<UnitType, UnitTally>>;
  unitTotals: UnitTally;
  dice: { space: DiceLuck; invasion: DiceLuck; total: DiceLuck };
}

export interface GameRecord {
  /** Bumped when the format changes. */
  version: 1;
  /** Folder name under games/: the BGA table number when known. */
  id: string;
  status: 'finished' | 'inProgress';
  /** ISO dates (yyyy-mm-dd). The log doesn't show the start date, so it is asked for when saving. */
  startDate: string;
  endDate: string | null;
  winner: string | null;
  rounds: number;
  players: PlayerRecord[];
  /** Anything the parser couldn't account for. */
  notes: string[];
  savedAt: string;
}

/** What the log shows. The save form adds the rest (id, dates, any faction it couldn't tell). */
export interface ParsedGame {
  players: PlayerRecord[];
  winner: string | null;
  rounds: number;
  /** Date of BGA's "Latest Action" header, when the paste includes it. */
  lastActionDate: string | null;
  notes: string[];
}

// ---------------------------------------------------------------------------
// Factions

/** Home planets, as BGA names them, for working out factions from the setup lines. */
const HOME_PLANETS: Record<string, string> = {
  NESTPHAR: 'arborec',
  'ARC PRIME': 'letnev',
  'WREN TERRA': 'letnev',
  'LISIS II': 'saar',
  RAGH: 'saar',
  MUAAT: 'muaat',
  ARRETZE: 'hacan',
  HERCANT: 'hacan',
  KAMDORN: 'hacan',
  JORD: 'sol',
  CREUSS: 'creuss',
  '[0.0.0]': 'l1z1x',
  '0.0.0': 'l1z1x',
  'MOLL PRIMUS': 'mentak',
  MAAZ: 'naalu',
  DRUAA: 'naalu',
  'MORDAI II': 'nekro',
  "TREN'LAK": 'sardakk',
  QUINARRA: 'sardakk',
  NAR: 'jolnar',
  JOL: 'jolnar',
  WINNU: 'winnu',
  'ARCHON REN': 'xxcha',
  'ARCHON TAU': 'xxcha',
  DARIEN: 'yin',
  RETILLION: 'yssaril',
  SHALLOQ: 'yssaril',
};

const UNKNOWN_FACTION: Faction = { id: '', name: 'an unknown faction', units: {}, abilities: [], abilityText: [] };
const factionOf = (id: string) => (FACTIONS.some((f) => f.id === id) ? getFaction(id) : UNKNOWN_FACTION);

// ---------------------------------------------------------------------------
// Dice statistics

interface Die {
  /** Chance this die hits. */
  p: number;
  hit: boolean;
  /** Natural face, 1-10. */
  face: number;
}

/** Mid-rank percentile of `observed` in a discrete distribution. */
function percentile(dist: number[], observed: number): number {
  let below = 0;
  for (let k = 0; k < observed && k < dist.length; k++) below += dist[k];
  return Math.round((below + 0.5 * (dist[observed] ?? 0)) * 1000) / 10;
}

/** Distribution of the number of hits from dice with different hit chances (Poisson binomial). */
function hitDistribution(ps: number[]): number[] {
  let dist = [1];
  for (const p of ps) {
    const next = new Array<number>(dist.length + 1).fill(0);
    dist.forEach((q, k) => {
      next[k] += q * (1 - p);
      next[k + 1] += q * p;
    });
    dist = next;
  }
  return dist;
}

/** Distribution of the sum of n d10, indexed by sum - n (so 0 is all ones). */
function faceSumDistribution(n: number): number[] {
  let dist = [1];
  for (let i = 0; i < n; i++) {
    const next = new Array<number>(dist.length + 9).fill(0);
    dist.forEach((q, k) => {
      for (let f = 0; f < 10; f++) next[k + f] += q / 10;
    });
    dist = next;
  }
  return dist;
}

function luck(dice: Die[]): DiceLuck {
  const round = (n: number) => Math.round(n * 100) / 100;
  if (dice.length === 0) {
    return { dice: 0, hits: 0, expectedHits: 0, hitPercentile: null, averageFace: null, facePercentile: null };
  }
  const hits = dice.filter((d) => d.hit).length;
  const faceSum = dice.reduce((s, d) => s + d.face, 0);
  return {
    dice: dice.length,
    hits,
    expectedHits: round(dice.reduce((s, d) => s + d.p, 0)),
    hitPercentile: percentile(hitDistribution(dice.map((d) => d.p)), hits),
    averageFace: round(faceSum / dice.length),
    facePercentile: percentile(faceSumDistribution(dice.length), faceSum - dice.length),
  };
}

/** Modifier BGA already applied to the shown dice, from the roll's "Effects:" tags. */
function modifierFor(roll: RollLine, unit: UnitType): number {
  let mod = 0;
  for (const effect of roll.effects) {
    if (effect === 'FRAGILE') mod -= 1;
    else if (effect === 'MORALE BOOST' || effect === 'UNRELENTING') mod += 1;
    else if (effect === 'FIGHTER PROTOTYPE' && unit === 'fighter') mod += 2;
    else if (effect === 'BUNKER') mod -= 4;
    else if (effect === 'ANTIMASS DEFLECTORS') mod -= 1;
  }
  return mod;
}

const hitChance = (hitOn: number) => Math.min(1, Math.max(0, (11 - hitOn) / 10));

// ---------------------------------------------------------------------------
// Parsing

const emptyTally = (): UnitTally => ({ starting: 0, produced: 0, placed: 0, lost: 0, producedCost: 0, lostCost: 0 });
const STRUCTURES: UnitType[] = ['pds', 'spacedock'];
/** Action cards that put units on the board without production. Upgrade swaps a cruiser for a dreadnought. */
const PLACEMENT_CARDS = ['WAR EFFORT', 'GHOST SHIP', 'RISE OF A MESSIAH', 'UPGRADE'];

/** "2 destroyer, 1 war sun" → [[destroyer, 2], [warsun, 1]] */
function unitList(text: string): [UnitType, number][] {
  const out: [UnitType, number][] = [];
  for (const m of text.matchAll(/(\d+) ([A-Za-z][A-Za-z '()-]*?)\s*(?:,|$)/g)) {
    const type = unitFromName(m[2]);
    if (type) out.push([type, Number(m[1])]);
  }
  return out;
}

/** BGA's header: "Latest Action:" then "10/30/202611:38 AM" (month/day/year, time run on). */
function lastActionDate(lines: string[]): string | null {
  for (const line of lines.slice(0, 5)) {
    const m = line.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (m) return `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`;
  }
  return null;
}

function findPlayers(lines: string[]): { name: string; factionId: string }[] {
  const players = new Map<string, string>();
  for (const line of lines) {
    const m = line.match(/^(.+?) placed units on \( (.+?) \)\.$/);
    if (!m) continue;
    const planets = m[2].split(' / ').map((p) => p.trim());
    players.set(m[1], planets.map((p) => HOME_PLANETS[p]).find(Boolean) ?? '');
  }
  if (players.size > 0) return [...players].map(([name, factionId]) => ({ name, factionId }));

  // No setup lines (the paste starts mid-game): anyone who rolls dice, gains trade goods or takes actions.
  const counts = new Map<string, number>();
  for (const line of lines) {
    const m = line.match(/^(.+?) (?:rolled|gained \d+ trade good|activated|passed|finished a tactical action)/);
    if (m) counts.set(m[1], (counts.get(m[1]) ?? 0) + 1);
  }
  return [...counts].filter(([, n]) => n >= 3).map(([name]) => ({ name, factionId: '' }));
}

export function parseBgaGame(text: string): ParsedGame {
  const raw = text.split(/\r?\n/).map(cleanLine).filter(Boolean);
  const date = lastActionDate(raw);
  let lines = raw.filter((l) => !l.startsWith('Private:'));
  const notes: string[] = [];

  const found = findPlayers(lines);
  const names = found.map((p) => p.name);
  // BGA sometimes runs two sentences together: "X lost 2 commodities.X lost 1 trade good(s)."
  if (names.length) {
    const escaped = names.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
    const joined = new RegExp(`\\.(?=(?:${escaped}) )`);
    lines = lines.flatMap((l) => l.split(joined).map((part, i, all) => (i < all.length - 1 ? `${part}.` : part)));
  }
  if (isNewestFirst(lines)) lines.reverse();

  // Factions the setup lines didn't show: use the combat importer's guess.
  if (found.some((p) => !p.factionId)) {
    const guessed = parseBgaLog(text).factions;
    for (const p of found) if (!p.factionId) p.factionId = guessed[p.name] ?? '';
  }

  const players = new Map<string, PlayerRecord & { upgraded: Set<UnitType>; rolls: { kind: 'space' | 'invasion'; dice: Die[] }[] }>();
  for (const { name, factionId } of found) {
    players.set(name, {
      name,
      factionId,
      score: 0,
      tradeGoods: { gained: 0, spent: 0, lost: 0 },
      units: {},
      unitTotals: emptyTally(),
      dice: { space: luck([]), invasion: luck([]), total: luck([]) },
      upgraded: new Set(),
      rolls: [],
    });
  }
  const get = (name: string) => players.get(name);
  const actorOf = (line: string) => names.find((n) => line.startsWith(`${n} `));

  const stats = (player: NonNullable<ReturnType<typeof get>>, type: UnitType) => {
    const def = definition(factionOf(player.factionId), type);
    if (!def) return undefined;
    return player.upgraded.has(type) && def.upgraded ? def.upgraded : def.base;
  };
  const tally = (player: NonNullable<ReturnType<typeof get>>, type: UnitType) => (player.units[type] ??= emptyTally());
  const unitCost = (player: NonNullable<ReturnType<typeof get>>, type: UnitType) =>
    STRUCTURES.includes(type) ? 0 : (stats(player, type)?.cost ?? 0);

  let winner: string | null = null;
  let rounds = 0;
  let combat: 'space' | 'ground' = 'space';
  let mustRemove: string | null = null;
  // A card that puts units on the board: its "added" lines follow within a few lines.
  let placing: { actor: string; until: number } | null = null;
  // Before "Round 1": units added now are starting units. Only true when the paste includes the setup.
  let setup = lines.some((l) => l === 'Round 0, Setup Phase');
  const mismatches: string[] = [];

  for (const [lineNo, line] of lines.entries()) {
    const actor = actorOf(line);
    const player = actor ? get(actor) : undefined;

    const round = line.match(/^Round (\d+), /);
    if (round) rounds = Math.max(rounds, Number(round[1]));
    if (round && Number(round[1]) > 0) setup = false;

    if (mustRemove && !(actor === mustRemove && RE.remove.test(line))) mustRemove = null;

    let m: RegExpMatchArray | null;
    if ((m = line.match(/^(.+?) won the game!/))) winner = m[1];

    if (!player) continue;

    // Score
    if ((m = line.match(/^.+? (gained|lost) (\d+) victory points? due to /))) {
      player.score += (m[1] === 'gained' ? 1 : -1) * Number(m[2]);
      continue;
    }

    // Trade goods
    if ((m = line.match(/^.+? gained (\d+) trade good\(s\)\./))) player.tradeGoods.gained += Number(m[1]);
    else if ((m = line.match(/^.+? lost (\d+) trade good\(s\)\./))) player.tradeGoods.lost += Number(m[1]);
    else if ((m = line.match(/^.+? (?:spent|reserved) (\d+) trade good\(s\)/))) player.tradeGoods.spent += Number(m[1]);
    else {
      const paid = line.match(/^.+? spent \d+ (?:resource\(s\)|influence) \( ([^)]*) \)/)?.[1] ?? '';
      const spentClause = line.match(/Spent: ([^.]*)/)?.[1] ?? '';
      for (const part of [paid, spentClause]) {
        const tg = part.match(/(\d+) trade goods?\b/);
        if (tg) player.tradeGoods.spent += Number(tg[1]);
      }
    }

    // Upgrades researched, for working out to-hit values and costs.
    if ((m = line.match(/^.+? researched (.+?)(?: and used:.*)?\.?$/))) {
      const tech = m[1].toUpperCase();
      for (const type of ALL_UNIT_TYPES) {
        if (stats(player, type) && definition(factionOf(player.factionId), type)?.upgraded?.name.toUpperCase() === tech) {
          player.upgraded.add(type);
        }
      }
    }

    // Units produced and placed
    if (setup && (m = line.match(RE.add))) {
      const type = unitFromName(m[4]);
      if (type) tally(player, type).starting += Number(m[2]);
      continue;
    }
    const produce = line.match(/produce: (.+?)(?: , and to place .*?)?(?:\. Spent:.*|\.)?$/);
    if (produce && !line.includes('used MAGEN DEFENSE GRID to produce')) {
      for (const [type, n] of unitList(produce[1])) {
        const t = tally(player, type);
        t.produced += n;
        t.producedCost += n * unitCost(player, type);
      }
    }
    for (const place of line.matchAll(/to place (\d+) (.+?)(?: at [^.,]+)?(?:\.|,|$)/g)) {
      const type = unitFromName(place[2]);
      if (type) tally(player, type).placed += Number(place[1]);
    }
    if ((m = line.match(/^.+? played ([A-Z' ]+?)(?: on .*)?\.$/)) && PLACEMENT_CARDS.includes(m[1])) {
      placing = { actor: player.name, until: lineNo + 8 };
    } else if (placing && placing.actor === player.name && lineNo <= placing.until && (m = line.match(RE.add))) {
      const type = unitFromName(m[4]);
      if (type) tally(player, type).placed += Number(m[2]);
    }

    // Units lost
    const lose = (owner: string, type: UnitType | null, n: number) => {
      const p = get(owner);
      if (!p || !type) return;
      const t = tally(p, type);
      t.lost += n;
      t.lostCost += n * unitCost(p, type);
    };
    if ((m = line.match(RE.destroyed))) lose(m[3], unitFromName(m[5]), Number(m[2]));
    else if ((m = line.match(RE.destroyedOne))) lose(m[2], unitFromName(m[3]), 1);
    else if ((m = line.match(RE.remove)) && (m[7].includes('destroyed due to') || mustRemove === actor)) {
      lose(m[1], unitFromName(m[4]), Number(m[2]));
    }
    if (/ must remove unit\(s\) due to exceeding /.test(line)) mustRemove = actor ?? null;

    // Dice
    if ((m = line.match(RE.started))) combat = m[3] as 'space' | 'ground';
    if ((m = line.match(RE.toHit))) {
      // Ambush and the like: the to-hit value is given. Always in space.
      const hitOn = Number(m[3]);
      const dice = m[4].split(',').map((s) => Number(s.trim())).filter((n) => !Number.isNaN(n));
      player.rolls.push({ kind: 'space', dice: dice.map((v) => ({ p: hitChance(hitOn), hit: v >= hitOn, face: v })) });
    } else if ((m = line.match(RE.roll))) {
      const roll = parseRoll(m);
      const ground =
        roll.kind === 'bombardment' ||
        roll.kind === 'spaceCannonDefense' ||
        (roll.kind === 'combat' && (combat === 'ground' || roll.groups.some((g) => g.unit === 'infantry')));
      const dice: Die[] = [];
      for (const g of roll.groups) {
        const unitStats = g.unit ? stats(player, g.unit) : undefined;
        const r = unitStats && rollOf(unitStats, roll.kind);
        if (!g.unit || !r) continue;
        const mod = modifierFor(roll, g.unit);
        for (const v of g.dice) dice.push({ p: hitChance(r.hitOn - mod), hit: v >= r.hitOn, face: v - mod });
      }
      const hits = dice.filter((d) => d.hit).length;
      // The Jol-Nar flagship and X-89 add hits the dice don't show; otherwise the counts must agree.
      const extraHits = roll.effects.some((e) => e === 'J.N.S. HYLARIM' || e === 'X-89 BACTERIAL WEAPON');
      if (extraHits ? hits > roll.hits : hits !== roll.hits) mismatches.push(line);
      player.rolls.push({ kind: ground ? 'invasion' : 'space', dice });
    }
  }

  if (mismatches.length) {
    notes.push(`${mismatches.length} roll(s) whose hits don't match the expected to-hit values: ${mismatches.slice(0, 3).join(' | ')}`);
  }
  for (const p of found) if (!p.factionId) notes.push(`${p.name}'s faction couldn't be worked out from the log.`);

  const result: PlayerRecord[] = [];
  for (const p of players.values()) {
    const space = p.rolls.filter((r) => r.kind === 'space').flatMap((r) => r.dice);
    const invasion = p.rolls.filter((r) => r.kind === 'invasion').flatMap((r) => r.dice);
    const totals = emptyTally();
    for (const t of Object.values(p.units)) {
      for (const k of Object.keys(totals) as (keyof UnitTally)[]) totals[k] += t[k];
    }
    result.push({
      name: p.name,
      factionId: p.factionId,
      score: p.score,
      tradeGoods: p.tradeGoods,
      units: p.units,
      unitTotals: totals,
      dice: { space: luck(space), invasion: luck(invasion), total: luck([...space, ...invasion]) },
    });
  }
  return { players: result, winner, rounds, lastActionDate: date, notes };
}

/** Builds the record to save from the parsed log and what the save form asked for. */
export function buildGameRecord(
  parsed: ParsedGame,
  details: { id: string; startDate: string; endDate: string | null; factions: Record<string, string> },
): GameRecord {
  return {
    version: 1,
    id: details.id,
    status: parsed.winner ? 'finished' : 'inProgress',
    startDate: details.startDate,
    endDate: details.endDate,
    winner: parsed.winner,
    rounds: parsed.rounds,
    players: parsed.players.map((p) => ({ ...p, factionId: details.factions[p.name] || p.factionId })),
    notes: parsed.notes,
    savedAt: new Date().toISOString(),
  };
}
