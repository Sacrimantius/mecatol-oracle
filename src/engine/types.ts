export type UnitType =
  | 'flagship'
  | 'warsun'
  | 'dreadnought'
  | 'carrier'
  | 'cruiser'
  | 'destroyer'
  | 'fighter'
  | 'infantry'
  | 'pds'
  | 'spacedock';

export const SHIP_TYPES: readonly UnitType[] = [
  'flagship',
  'warsun',
  'dreadnought',
  'carrier',
  'cruiser',
  'destroyer',
  'fighter',
];

export const ALL_UNIT_TYPES: readonly UnitType[] = [...SHIP_TYPES, 'infantry', 'pds', 'spacedock'];

export interface Roll {
  /** Minimum die result (1-10) needed to score a hit. */
  hitOn: number;
  dice: number;
}

/** Flagship and faction effects that change how combat is resolved. */
export type SpecialEffect =
  | 'letnevFlagship' // Repairs at the start of each space combat round; strips planetary shields.
  | 'mentakFlagship' // Opponent's ships cannot use Sustain Damage.
  | 'jolnarFlagship' // Each natural 9 or 10 produces 2 additional hits.
  | 'winnuFlagship' // Rolls one die per opponent non-fighter ship.
  | 'sardakkFlagship' // +1 to combat rolls of your other ships.
  | 'l1z1xFlagship' // Hits from this ship and your dreadnoughts must target non-fighters.
  | 'yinFlagship' // When destroyed, destroy all ships in the system.
  | 'naaluFlagship' // Fighters may be committed to ground combat.
  | 'nekroFlagship'; // Ground forces in the system participate in space combat.

export interface UnitStats {
  type: UnitType;
  name: string;
  cost: number;
  combat?: Roll;
  sustainDamage?: boolean;
  antiFighterBarrage?: Roll;
  spaceCannon?: Roll;
  bombardment?: Roll;
  planetaryShield?: boolean;
  /** Other players' units in this system lose Planetary Shield (War Sun, Letnev flagship). */
  removesPlanetaryShield?: boolean;
  special?: SpecialEffect;
  /** Rules text shown in the UI for abilities beyond the stat line. */
  text?: string;
}

export interface UnitDefinition {
  base: UnitStats;
  upgraded?: UnitStats;
}

export type FactionAbility = 'unrelenting' | 'fragile' | 'ambush' | 'harrow';

export type TechId =
  | 'plasmaScoring'
  | 'antimassDeflectors'
  | 'gravitonLaserSystem'
  | 'duraniumArmor'
  | 'assaultCannon'
  | 'magenDefenseGrid'
  | 'nonEuclideanShielding'
  | 'l4Disruptors'
  | 'dimensionalSplicer'
  | 'valkyrieParticleWeave';

export interface Tech {
  id: TechId;
  name: string;
  /** Owning faction for faction technologies. */
  faction?: string;
  text: string;
}

export type ActionCardId =
  | 'moraleBoost'
  | 'fighterPrototype'
  | 'shieldsHolding'
  | 'directHit'
  | 'courageousToTheEnd'
  | 'emergencyRepairs'
  | 'maneuveringJets'
  | 'scrambleFrequency'
  | 'experimentalBattlestation'
  | 'disable'
  | 'bunker'
  | 'fireTeam';

export interface ActionCard {
  id: ActionCardId;
  name: string;
  /** The card's effect, paraphrased. */
  text: string;
  /** When the simulator plays it: each card is played at most once per battle. */
  usage: string;
  /** Only this side can use it (Bunker defends, Disable attacks). */
  role?: Role;
}

export interface Faction {
  id: string;
  name: string;
  /** Faction-specific replacements for the generic units. */
  units: Partial<Record<UnitType, UnitDefinition>>;
  abilities: FactionAbility[];
  abilityText: string[];
}

export type UnitCounts = Partial<Record<UnitType, number>>;

export interface SideInput {
  factionId: string;
  /**
   * Attacker: ships in the active system plus ground forces they carry.
   * Defender: ships in the system plus ground forces and structures on the planet.
   */
  counts: UnitCounts;
  /** Units of each type that start the combat already damaged (Sustain Damage used). */
  damaged?: UnitCounts;
  upgrades: Partial<Record<UnitType, boolean>>;
  techs: TechId[];
  /** Combat action cards in hand, each played at most once. */
  actionCards?: ActionCardId[];
}

export interface ScenarioOptions {
  iterations: number;
  /** After space combat, the attacker invades the planet with its ground forces. */
  invade: boolean;
  /** The system contains a wormhole (for Dimensional Splicer). */
  wormhole: boolean;
  /** Fixed seed for reproducible runs. */
  seed?: number;
}

export interface SimulationInput {
  attacker: SideInput;
  defender: SideInput;
  options: ScenarioOptions;
}

export type Role = 'attacker' | 'defender';

export interface OutcomeShares {
  attacker: number;
  defender: number;
  draw: number;
}

export interface SimulationResult {
  iterations: number;
  /** Who won the whole engagement. With invasion on, the attacker wins only by capturing the planet. */
  overall: OutcomeShares;
  space: OutcomeShares & { noCombat: number };
  invasion: { captured: number; repelled: number; draw: number; notAttempted: number } | null;
  /** Average rounds, counting only battles where that combat happened. */
  averageSpaceRounds: number;
  averageGroundRounds: number;
  averageSurvivors: Record<Role, UnitCounts>;
  durationMs: number;
}
