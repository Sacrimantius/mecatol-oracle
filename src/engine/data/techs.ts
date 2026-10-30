import type { Tech } from '../types';

export const TECHS: Tech[] = [
  {
    id: 'plasmaScoring',
    name: 'Plasma Scoring',
    text: 'One unit rolls 1 additional die when using Bombardment or Space Cannon.',
  },
  {
    id: 'antimassDeflectors',
    name: 'Antimass Deflectors',
    text: "-1 to other players' Space Cannon rolls against your units.",
  },
  {
    id: 'gravitonLaserSystem',
    name: 'Graviton Laser System',
    text: 'Your Space Cannon hits must be assigned to non-fighter ships if able.',
  },
  {
    id: 'duraniumArmor',
    name: 'Duranium Armor',
    text: 'Each combat round, repair 1 damaged unit that did not use Sustain Damage that round.',
  },
  {
    id: 'assaultCannon',
    name: 'Assault Cannon',
    text: 'At the start of space combat with 3+ of your non-fighter ships, your opponent destroys 1 non-fighter ship.',
  },
  {
    id: 'magenDefenseGrid',
    name: 'Magen Defense Grid Ω',
    text: 'At the start of ground combat on a planet with your structure, produce 1 hit.',
  },
  {
    id: 'nonEuclideanShielding',
    name: 'Non-Euclidean Shielding',
    faction: 'letnev',
    text: 'When one of your units uses Sustain Damage, cancel 2 hits instead of 1.',
  },
  {
    id: 'l4Disruptors',
    name: 'L4 Disruptors',
    faction: 'letnev',
    text: 'During an invasion, units cannot use Space Cannon against your units.',
  },
  {
    id: 'dimensionalSplicer',
    name: 'Dimensional Splicer',
    faction: 'creuss',
    text: 'At the start of space combat in a system with a wormhole, produce 1 hit.',
  },
  {
    id: 'valkyrieParticleWeave',
    name: 'Valkyrie Particle Weave',
    faction: 'sardakk',
    text: 'After ground combat rolls, if your opponent produced hits, produce 1 additional hit.',
  },
];

/** Technologies a faction may select: every generic tech plus its own faction techs. */
export function techsForFaction(factionId: string): Tech[] {
  return TECHS.filter((t) => !t.faction || t.faction === factionId || factionId === 'nekro');
}
