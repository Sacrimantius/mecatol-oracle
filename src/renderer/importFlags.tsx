import type { ImportFlag, SideFlags } from '../import/bga';
import type { ActionCardId, SideInput, TechId, UnitType } from '../engine/types';
import { InfoTip } from './InfoTip';

export const emptyFlags = (): SideFlags => ({ faction: [], units: {}, upgrades: {}, techs: {}, actionCards: {} });

/** Which imported value a set of flags belongs to. */
export type FlagKey =
  | { kind: 'faction' }
  | { kind: 'units' | 'upgrades'; type: UnitType }
  | { kind: 'techs'; tech: TechId }
  | { kind: 'actionCards'; card: ActionCardId };

/** Removes one value's flags, once the user has checked it. */
export function dismissFlag(flags: SideFlags, key: FlagKey): SideFlags {
  if (key.kind === 'faction') return { ...flags, faction: [] };
  if (key.kind === 'techs') {
    const techs = { ...flags.techs };
    delete techs[key.tech];
    return { ...flags, techs };
  }
  if (key.kind === 'actionCards') {
    const actionCards = { ...flags.actionCards };
    delete actionCards[key.card];
    return { ...flags, actionCards };
  }
  const list = { ...flags[key.kind] };
  delete list[key.type];
  return { ...flags, [key.kind]: list };
}

/**
 * Badge explaining an imported value: amber "!" when something needs checking, "i" otherwise.
 * Clicking it marks the value as checked and removes the badge.
 */
export function FlagTip({ flags, onDismiss }: { flags?: ImportFlag[]; onDismiss: () => void }) {
  if (!flags?.length) return null;
  const warn = flags.some((f) => f.level === 'warn');
  return (
    <InfoTip
      variant={warn ? 'warn' : 'info'}
      label={warn ? 'Imported: check this, then click to clear' : 'Imported from the log; click to clear'}
      onActivate={onDismiss}
    >
      <strong>{warn ? 'Check this' : 'From the BGA log'}</strong>
      <ul className="flag-list">
        {flags.map((f) => (
          <li key={f.message} className={f.level}>
            {f.message}
          </li>
        ))}
      </ul>
      <p className="flag-hint">Click the badge to mark it as checked.</p>
    </InfoTip>
  );
}

export const countWarnings = (flags: SideFlags) =>
  [
    flags.faction,
    ...Object.values(flags.units),
    ...Object.values(flags.upgrades),
    ...Object.values(flags.techs),
    ...Object.values(flags.actionCards),
  ].filter(
    (list) => list?.some((f) => f.level === 'warn'),
  ).length;

/** Drops the flags of anything the user has since changed by hand: they've checked it. */
export function clearEdited(flags: SideFlags, prev: SideInput, next: SideInput): SideFlags {
  const out: SideFlags = {
    faction: prev.factionId === next.factionId ? flags.faction : [],
    units: { ...flags.units },
    upgrades: { ...flags.upgrades },
    techs: { ...flags.techs },
    actionCards: { ...flags.actionCards },
  };
  for (const type of Object.keys(out.units) as UnitType[]) {
    if (prev.counts[type] !== next.counts[type] || prev.damaged?.[type] !== next.damaged?.[type]) delete out.units[type];
  }
  for (const type of Object.keys(out.upgrades) as UnitType[]) {
    if (!!prev.upgrades[type] !== !!next.upgrades[type]) delete out.upgrades[type];
  }
  for (const tech of Object.keys(out.techs) as TechId[]) {
    if (prev.techs.includes(tech) !== next.techs.includes(tech)) delete out.techs[tech];
  }
  const holds = (side: SideInput, card: ActionCardId) => side.actionCards?.filter((c) => c === card).length ?? 0;
  for (const card of Object.keys(out.actionCards) as ActionCardId[]) {
    if (holds(prev, card) !== holds(next, card)) delete out.actionCards[card];
  }
  return out;
}
