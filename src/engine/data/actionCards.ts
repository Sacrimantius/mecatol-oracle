import type { ActionCard, ActionCardId, Role } from '../types';

/** Base-game action cards that change how a combat goes. */
export const ACTION_CARDS: ActionCard[] = [
  {
    id: 'moraleBoost',
    name: 'Morale Boost',
    text: 'At the start of a combat round: apply +1 to the result of each of your unit’s combat rolls this round.',
    usage: 'Played in the first combat round this side fights: space combat if there is one, otherwise ground combat.',
  },
  {
    id: 'fighterPrototype',
    name: 'Fighter Prototype',
    text: 'At the start of the first round of a space combat: apply +2 to your fighters’ combat rolls this round.',
    usage: 'Played in the first round of space combat if this side has fighters.',
  },
  {
    id: 'shieldsHolding',
    name: 'Shields Holding',
    text: 'Before you assign hits to your ships during a space combat: cancel up to 2 hits.',
    usage: 'Played the first time a space combat round deals this side 2+ hits, or any hit it can’t sustain.',
  },
  {
    id: 'directHit',
    name: 'Direct Hit',
    text: 'After another player’s ship uses Sustain Damage to cancel a hit your units produced: destroy that ship.',
    usage: 'Played on the first enemy ship that uses Sustain Damage against this side.',
  },
  {
    id: 'courageousToTheEnd',
    name: 'Courageous to the End',
    text: 'After 1 of your ships is destroyed during a space combat: roll 2 dice. For each result equal to or greater than that ship’s combat value, your opponent destroys 1 of their ships.',
    usage: 'Played after this side’s first non-fighter ship is destroyed in a space combat round.',
  },
  {
    id: 'emergencyRepairs',
    name: 'Emergency Repairs',
    text: 'At the start or end of a combat round: repair all of your units in the active system that have Sustain Damage.',
    usage: 'Played at the end of the first space combat round that leaves this side with 2+ damaged units, or with a damaged unit and nothing else able to sustain.',
  },
  {
    id: 'maneuveringJets',
    name: 'Maneuvering Jets',
    text: 'Before you assign hits produced by another player’s Space Cannon roll: cancel 1 hit.',
    usage: 'Played the first time Space Cannon Offense or Defense hits this side.',
  },
  {
    id: 'scrambleFrequency',
    name: 'Scramble Frequency',
    text: 'After another player makes a Bombardment, Space Cannon or Anti-Fighter Barrage roll: that player rerolls all of those dice.',
    usage: 'Played on the first such enemy roll that scores more hits than average.',
  },
  {
    id: 'experimentalBattlestation',
    name: 'Experimental Battlestation',
    text: 'After another player moves ships into a system adjacent to or containing one of your space docks: that space dock uses Space Cannon 5 (×3) against ships in the active system.',
    usage: 'Adds Space Cannon 5 ×3 to the defender’s Space Cannon Offense.',
    role: 'defender',
  },
  {
    id: 'disable',
    name: 'Disable',
    text: 'Choose 1 of your opponent’s planets in the active system: its PDS lose Planetary Shield and Space Cannon during this tactical action.',
    usage: 'The defender’s PDS on the planet don’t fire and don’t raise a Planetary Shield.',
    role: 'attacker',
  },
  {
    id: 'bunker',
    name: 'Bunker',
    text: 'At the start of an invasion: apply −4 to each Bombardment roll against your planets during this invasion.',
    usage: 'Played against the attacker’s Bombardment.',
    role: 'defender',
  },
  {
    id: 'fireTeam',
    name: 'Fire Team',
    text: 'After your ground forces make combat rolls during a round of ground combat: reroll any number of your dice.',
    usage: 'Rerolls every miss in the first round of ground combat.',
  },
];

export function getActionCard(id: ActionCardId): ActionCard {
  const card = ACTION_CARDS.find((c) => c.id === id);
  if (!card) throw new Error(`Unknown action card: ${id}`);
  return card;
}

/** Action cards a side can use in its role. */
export const actionCardsFor = (role: Role) => ACTION_CARDS.filter((c) => !c.role || c.role === role);
