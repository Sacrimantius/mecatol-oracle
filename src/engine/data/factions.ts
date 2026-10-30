import type { Faction, Roll, SpecialEffect, UnitDefinition, UnitStats, UnitType } from '../types';
import { GENERIC_UNITS } from './units';

function flagship(
  name: string,
  combat: Roll,
  extra: Partial<UnitStats> & { special?: SpecialEffect } = {},
): UnitDefinition {
  return {
    base: { type: 'flagship', name, cost: 8, combat, sustainDamage: true, ...extra },
  };
}

/** The 17 base-game factions. Only combat-relevant units and abilities are modelled. */
export const FACTIONS: Faction[] = [
  {
    id: 'arborec',
    name: 'The Arborec',
    units: {
      flagship: flagship('Duha Menaimon', { hitOn: 7, dice: 2 }),
      infantry: {
        base: { type: 'infantry', name: 'Letani Warrior I', cost: 0.5, combat: { hitOn: 8, dice: 1 } },
        upgraded: { type: 'infantry', name: 'Letani Warrior II', cost: 0.5, combat: { hitOn: 7, dice: 1 } },
      },
    },
    abilities: [],
    abilityText: [],
  },
  {
    id: 'letnev',
    name: 'The Barony of Letnev',
    units: {
      flagship: flagship('Arc Secundus', { hitOn: 5, dice: 2 }, {
        bombardment: { hitOn: 5, dice: 3 },
        removesPlanetaryShield: true,
        special: 'letnevFlagship',
        text: "Other players' units in this system lose Planetary Shield. Repairs at the start of each space combat round.",
      }),
    },
    abilities: [],
    abilityText: [],
  },
  {
    id: 'saar',
    name: 'The Clan of Saar',
    units: {
      flagship: flagship('Son of Ragh', { hitOn: 5, dice: 2 }, {
        antiFighterBarrage: { hitOn: 6, dice: 4 },
      }),
      spacedock: {
        base: { type: 'spacedock', name: 'Floating Factory I', cost: 4 },
        upgraded: { type: 'spacedock', name: 'Floating Factory II', cost: 4 },
      },
    },
    abilities: [],
    abilityText: [],
  },
  {
    id: 'muaat',
    name: 'The Embers of Muaat',
    units: {
      flagship: flagship('The Inferno', { hitOn: 5, dice: 2 }),
      warsun: {
        base: { ...GENERIC_UNITS.warsun.base, name: 'Prototype War Sun I', cost: 12 },
        upgraded: { ...GENERIC_UNITS.warsun.base, name: 'Prototype War Sun II', cost: 10 },
      },
    },
    abilities: [],
    abilityText: [],
  },
  {
    id: 'hacan',
    name: 'The Emirates of Hacan',
    units: {
      flagship: flagship('Wrath of Kenara', { hitOn: 7, dice: 2 }, {
        text: 'Trade-good rerolls are not modelled yet.',
      }),
    },
    abilities: [],
    abilityText: [],
  },
  {
    id: 'sol',
    name: 'The Federation of Sol',
    units: {
      flagship: flagship('Genesis', { hitOn: 5, dice: 2 }),
      carrier: {
        base: { type: 'carrier', name: 'Advanced Carrier I', cost: 3, combat: { hitOn: 9, dice: 1 } },
        upgraded: {
          type: 'carrier',
          name: 'Advanced Carrier II',
          cost: 3,
          combat: { hitOn: 9, dice: 1 },
          sustainDamage: true,
        },
      },
      infantry: {
        base: { type: 'infantry', name: 'Spec Ops I', cost: 0.5, combat: { hitOn: 7, dice: 1 } },
        upgraded: { type: 'infantry', name: 'Spec Ops II', cost: 0.5, combat: { hitOn: 6, dice: 1 } },
      },
    },
    abilities: [],
    abilityText: [],
  },
  {
    id: 'creuss',
    name: 'The Ghosts of Creuss',
    units: {
      flagship: flagship('Hil Colish', { hitOn: 5, dice: 1 }),
    },
    abilities: [],
    abilityText: [],
  },
  {
    id: 'l1z1x',
    name: 'The L1Z1X Mindnet',
    units: {
      flagship: flagship('[0.0.1]', { hitOn: 5, dice: 2 }, {
        special: 'l1z1xFlagship',
        text: 'Hits from this ship and your dreadnoughts must be assigned to non-fighter ships if able.',
      }),
      dreadnought: {
        base: {
          type: 'dreadnought',
          name: 'Super-Dreadnought I',
          cost: 4,
          combat: { hitOn: 5, dice: 1 },
          sustainDamage: true,
          bombardment: { hitOn: 5, dice: 1 },
        },
        upgraded: {
          type: 'dreadnought',
          name: 'Super-Dreadnought II',
          cost: 4,
          combat: { hitOn: 4, dice: 1 },
          sustainDamage: true,
          bombardment: { hitOn: 4, dice: 1 },
        },
      },
    },
    abilities: ['harrow'],
    abilityText: ['Harrow: after each round of ground combat, your ships use Bombardment again.'],
  },
  {
    id: 'mentak',
    name: 'The Mentak Coalition',
    units: {
      flagship: flagship('Fourth Moon', { hitOn: 7, dice: 2 }, {
        special: 'mentakFlagship',
        text: "Other players' ships in this system cannot use Sustain Damage.",
      }),
    },
    abilities: ['ambush'],
    abilityText: ['Ambush: at the start of space combat, roll 1 die for each of up to 2 cruisers or destroyers.'],
  },
  {
    id: 'naalu',
    name: 'The Naalu Collective',
    units: {
      flagship: flagship('Matriarch', { hitOn: 9, dice: 2 }, {
        special: 'naaluFlagship',
        text: 'During an invasion, fighters may be committed to ground combat as ground forces.',
      }),
      fighter: {
        base: { type: 'fighter', name: 'Hybrid Crystal Fighter I', cost: 0.5, combat: { hitOn: 8, dice: 1 } },
        upgraded: { type: 'fighter', name: 'Hybrid Crystal Fighter II', cost: 0.5, combat: { hitOn: 7, dice: 1 } },
      },
    },
    abilities: [],
    abilityText: [],
  },
  {
    id: 'nekro',
    name: 'The Nekro Virus',
    units: {
      flagship: flagship('The Alastor', { hitOn: 9, dice: 2 }, {
        special: 'nekroFlagship',
        text: 'Your ground forces in this system participate in space combat as if they were ships.',
      }),
    },
    abilities: [],
    abilityText: ['Can copy other factions’ technologies, so every faction tech is selectable.'],
  },
  {
    id: 'sardakk',
    name: "Sardakk N'orr",
    units: {
      flagship: flagship("C'morran N'orr", { hitOn: 6, dice: 2 }, {
        special: 'sardakkFlagship',
        text: '+1 to combat rolls of your other ships in this system.',
      }),
      dreadnought: {
        base: {
          type: 'dreadnought',
          name: 'Exotrireme I',
          cost: 4,
          combat: { hitOn: 5, dice: 1 },
          sustainDamage: true,
          bombardment: { hitOn: 4, dice: 2 },
        },
        upgraded: {
          type: 'dreadnought',
          name: 'Exotrireme II',
          cost: 4,
          combat: { hitOn: 5, dice: 1 },
          sustainDamage: true,
          bombardment: { hitOn: 4, dice: 2 },
          text: 'Self-destruct ability is not modelled yet.',
        },
      },
    },
    abilities: ['unrelenting'],
    abilityText: ['Unrelenting: +1 to all combat rolls.'],
  },
  {
    id: 'jolnar',
    name: 'The Universities of Jol-Nar',
    units: {
      flagship: flagship('J.N.S. Hylarim', { hitOn: 6, dice: 2 }, {
        special: 'jolnarFlagship',
        text: 'Each natural 9 or 10 produces 2 additional hits.',
      }),
    },
    abilities: ['fragile'],
    abilityText: ['Fragile: -1 to all combat rolls.'],
  },
  {
    id: 'winnu',
    name: 'The Winnu',
    units: {
      flagship: flagship('Salai Sai Corian', { hitOn: 7, dice: 1 }, {
        special: 'winnuFlagship',
        text: "Rolls 1 die per opponent's non-fighter ship.",
      }),
    },
    abilities: [],
    abilityText: [],
  },
  {
    id: 'xxcha',
    name: 'The Xxcha Kingdom',
    units: {
      flagship: flagship('Loncara Ssodu', { hitOn: 7, dice: 2 }, {
        spaceCannon: { hitOn: 5, dice: 3 },
      }),
    },
    abilities: [],
    abilityText: [],
  },
  {
    id: 'yin',
    name: 'The Yin Brotherhood',
    units: {
      flagship: flagship('Van Hauge', { hitOn: 9, dice: 2 }, {
        special: 'yinFlagship',
        text: 'When this ship is destroyed, destroy all ships in this system.',
      }),
    },
    abilities: [],
    abilityText: [],
  },
  {
    id: 'yssaril',
    name: 'The Yssaril Tribes',
    units: {
      flagship: flagship("Y'sia Y'ssrila", { hitOn: 5, dice: 2 }),
    },
    abilities: [],
    abilityText: [],
  },
];

export function getFaction(id: string): Faction {
  const faction = FACTIONS.find((f) => f.id === id);
  if (!faction) throw new Error(`Unknown faction: ${id}`);
  return faction;
}

export function getUnitDefinition(faction: Faction, type: UnitType): UnitDefinition {
  const def = faction.units[type] ?? (type === 'flagship' ? undefined : GENERIC_UNITS[type]);
  if (!def) throw new Error(`${faction.name} has no ${type}`);
  return def;
}

export function getUnitStats(faction: Faction, type: UnitType, upgraded: boolean): UnitStats {
  const def = getUnitDefinition(faction, type);
  return upgraded && def.upgraded ? def.upgraded : def.base;
}
