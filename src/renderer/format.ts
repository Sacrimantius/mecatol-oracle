import type { Roll, UnitStats } from '../engine/types';

const roll = (label: string, r: Roll | undefined, dice = r?.dice) =>
  r ? `${label} ${r.hitOn}${dice !== 1 ? ` ×${dice}` : ''}` : null;

/** Compact stat line, e.g. "Combat 5 · Sustain · Bombard 5". */
export function describeStats(stats: UnitStats): string {
  const parts = [
    stats.special === 'winnuFlagship' ? `Combat ${stats.combat!.hitOn} ×X` : roll('Combat', stats.combat),
    stats.sustainDamage ? 'Sustain' : null,
    roll('AFB', stats.antiFighterBarrage),
    roll('Cannon', stats.spaceCannon),
    roll('Bombard', stats.bombardment),
    stats.planetaryShield ? 'Shield' : null,
  ];
  return parts.filter(Boolean).join(' · ') || 'No combat ability';
}

export const percent = (share: number) => `${(share * 100).toFixed(1)}%`;
