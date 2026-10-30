import type { UnitDefinition, UnitType } from '../types';

/** Base-game generic units. Flagships are faction-specific and defined in factions.ts. */
export const GENERIC_UNITS: Record<Exclude<UnitType, 'flagship'>, UnitDefinition> = {
  warsun: {
    base: {
      type: 'warsun',
      name: 'War Sun',
      cost: 12,
      combat: { hitOn: 3, dice: 3 },
      sustainDamage: true,
      bombardment: { hitOn: 3, dice: 3 },
      removesPlanetaryShield: true,
    },
  },
  dreadnought: {
    base: {
      type: 'dreadnought',
      name: 'Dreadnought',
      cost: 4,
      combat: { hitOn: 5, dice: 1 },
      sustainDamage: true,
      bombardment: { hitOn: 5, dice: 1 },
    },
    upgraded: {
      type: 'dreadnought',
      name: 'Dreadnought II',
      cost: 4,
      combat: { hitOn: 5, dice: 1 },
      sustainDamage: true,
      bombardment: { hitOn: 5, dice: 1 },
    },
  },
  carrier: {
    base: { type: 'carrier', name: 'Carrier', cost: 3, combat: { hitOn: 9, dice: 1 } },
    upgraded: { type: 'carrier', name: 'Carrier II', cost: 3, combat: { hitOn: 9, dice: 1 } },
  },
  cruiser: {
    base: { type: 'cruiser', name: 'Cruiser', cost: 2, combat: { hitOn: 7, dice: 1 } },
    upgraded: { type: 'cruiser', name: 'Cruiser II', cost: 2, combat: { hitOn: 6, dice: 1 } },
  },
  destroyer: {
    base: {
      type: 'destroyer',
      name: 'Destroyer',
      cost: 1,
      combat: { hitOn: 9, dice: 1 },
      antiFighterBarrage: { hitOn: 9, dice: 2 },
    },
    upgraded: {
      type: 'destroyer',
      name: 'Destroyer II',
      cost: 1,
      combat: { hitOn: 8, dice: 1 },
      antiFighterBarrage: { hitOn: 6, dice: 3 },
    },
  },
  fighter: {
    base: { type: 'fighter', name: 'Fighter', cost: 0.5, combat: { hitOn: 9, dice: 1 } },
    upgraded: { type: 'fighter', name: 'Fighter II', cost: 0.5, combat: { hitOn: 8, dice: 1 } },
  },
  infantry: {
    base: { type: 'infantry', name: 'Infantry', cost: 0.5, combat: { hitOn: 8, dice: 1 } },
    upgraded: { type: 'infantry', name: 'Infantry II', cost: 0.5, combat: { hitOn: 7, dice: 1 } },
  },
  pds: {
    base: {
      type: 'pds',
      name: 'PDS',
      cost: 2,
      spaceCannon: { hitOn: 6, dice: 1 },
      planetaryShield: true,
    },
    upgraded: {
      type: 'pds',
      name: 'PDS II',
      cost: 2,
      spaceCannon: { hitOn: 5, dice: 1 },
      planetaryShield: true,
    },
  },
  spacedock: {
    base: { type: 'spacedock', name: 'Space Dock', cost: 4 },
    upgraded: { type: 'spacedock', name: 'Space Dock II', cost: 4 },
  },
};
