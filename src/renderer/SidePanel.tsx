import { FACTIONS, getFaction, getUnitDefinition } from '../engine/data/factions';
import { techsForFaction } from '../engine/data/techs';
import type { Faction, Role, SideInput, TechId, UnitType } from '../engine/types';
import type { SideFlags } from '../import/bga';
import { describeStats } from './format';
import { FlagTip, type FlagKey } from './importFlags';
import { InfoTip } from './InfoTip';

const SPACE_UNITS: UnitType[] = ['flagship', 'warsun', 'dreadnought', 'carrier', 'cruiser', 'destroyer', 'fighter'];

const MAX_COUNT: Record<UnitType, number> = {
  flagship: 1,
  warsun: 2,
  dreadnought: 5,
  carrier: 4,
  cruiser: 8,
  destroyer: 8,
  fighter: 20,
  infantry: 20,
  pds: 6,
  spacedock: 1,
};

interface Props {
  role: Role;
  value: SideInput;
  /** The other side's faction, which can't be picked here (no mirror matches). */
  otherFactionId: string;
  /** Notes from a BGA log import on how each value was worked out. */
  flags: SideFlags;
  onDismissFlag: (key: FlagKey) => void;
  onChange: (value: SideInput) => void;
}

export function SidePanel({ role, value, otherFactionId, flags, onDismissFlag, onChange }: Props) {
  const faction = value.factionId ? getFaction(value.factionId) : null;

  const setFaction = (factionId: string) => {
    // Drop faction techs the new faction cannot use.
    const allowed = new Set(techsForFaction(factionId).map((t) => t.id));
    onChange({ ...value, factionId, techs: value.techs.filter((t) => allowed.has(t)) });
  };

  return (
    <section className={`side-panel ${role}`}>
      <header>
        <h2>
          {role === 'attacker' ? 'Attacker' : 'Defender'}
          <FlagTip flags={flags.faction} onDismiss={() => onDismissFlag({ kind: 'faction' })} />
        </h2>
        <select value={value.factionId} onChange={(e) => setFaction(e.target.value)}>
          <option value="" disabled>
            Choose a faction…
          </option>
          {FACTIONS.map((f) => (
            <option key={f.id} value={f.id} disabled={f.id === otherFactionId}>
              {f.name}
              {f.id === otherFactionId ? ` (${role === 'attacker' ? 'defender' : 'attacker'})` : ''}
            </option>
          ))}
        </select>
      </header>

      {faction ? (
        <FactionUnits
          role={role}
          faction={faction}
          value={value}
          flags={flags}
          onDismissFlag={onDismissFlag}
          onChange={onChange}
        />
      ) : (
        <p className="panel-hint">Choose a faction to add units and technologies.</p>
      )}
    </section>
  );
}

interface FactionUnitsProps {
  role: Role;
  faction: Faction;
  value: SideInput;
  flags: SideFlags;
  onDismissFlag: (key: FlagKey) => void;
  onChange: (value: SideInput) => void;
}

function FactionUnits({ role, faction, value, flags, onDismissFlag, onChange }: FactionUnitsProps) {
  const techs = techsForFaction(faction.id);

  const setCount = (type: UnitType, count: number) => {
    const next = Math.min(MAX_COUNT[type], Math.max(0, count));
    const damaged = Math.min(value.damaged?.[type] ?? 0, next);
    onChange({ ...value, counts: { ...value.counts, [type]: next }, damaged: { ...value.damaged, [type]: damaged } });
  };
  const setDamaged = (type: UnitType, n: number) =>
    onChange({ ...value, damaged: { ...value.damaged, [type]: Math.min(value.counts[type] ?? 0, Math.max(0, n)) } });
  const toggleUpgrade = (type: UnitType) =>
    onChange({ ...value, upgrades: { ...value.upgrades, [type]: !value.upgrades[type] } });
  const toggleTech = (id: TechId) =>
    onChange({
      ...value,
      techs: value.techs.includes(id) ? value.techs.filter((t) => t !== id) : [...value.techs, id],
    });

  const renderRow = (type: UnitType) => {
    const def = getUnitDefinition(faction, type);
    const upgraded = !!value.upgrades[type] && !!def.upgraded;
    const stats = upgraded ? def.upgraded! : def.base;
    const count = value.counts[type] ?? 0;
    const damaged = value.damaged?.[type] ?? 0;
    return (
      <div className={`unit-row${count > 0 ? ' active' : ''}`} key={type}>
        <div className="unit-info">
          <div className="unit-name">
            {stats.name}
            {stats.text && <InfoTip>{stats.text}</InfoTip>}
            <FlagTip flags={flags.units[type]} onDismiss={() => onDismissFlag({ kind: 'units', type })} />
          </div>
          <div className="unit-stats">
            {describeStats(stats)}
            {stats.sustainDamage && count > 0 && (
              <span className={`damaged-control${damaged ? ' on' : ''}`}>
                <button onClick={() => setDamaged(type, damaged - 1)} disabled={damaged === 0} aria-label="One fewer damaged">
                  −
                </button>
                {damaged} damaged
                <button onClick={() => setDamaged(type, damaged + 1)} disabled={damaged >= count} aria-label="One more damaged">
                  +
                </button>
              </span>
            )}
          </div>
        </div>
        {def.upgraded ? (
          <span className="upgrade-cell">
            <FlagTip flags={flags.upgrades[type]} onDismiss={() => onDismissFlag({ kind: 'upgrades', type })} />
            <button
              className={`upgrade${upgraded ? ' on' : ''}`}
              onClick={() => toggleUpgrade(type)}
              title={upgraded ? `Using ${def.upgraded.name}` : `Upgrade to ${def.upgraded.name}`}
            >
              II
            </button>
          </span>
        ) : (
          <span className="upgrade-placeholder" />
        )}
        <div className="stepper">
          <button onClick={() => setCount(type, count - 1)} disabled={count === 0} aria-label="Remove one">
            −
          </button>
          <input
            type="number"
            min={0}
            max={MAX_COUNT[type]}
            value={count}
            onChange={(e) => setCount(type, Number(e.target.value) || 0)}
          />
          <button onClick={() => setCount(type, count + 1)} disabled={count >= MAX_COUNT[type]} aria-label="Add one">
            +
          </button>
        </div>
      </div>
    );
  };

  return (
    <>
      {faction.abilityText.length > 0 && (
        <ul className="ability-notes">
          {faction.abilityText.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      )}

      <h3>Ships in system</h3>
      {SPACE_UNITS.map(renderRow)}

      {role === 'defender' ? (
        <>
          <h3>On the planet</h3>
          {(['infantry', 'pds', 'spacedock'] as const).map(renderRow)}
        </>
      ) : (
        <>
          <h3>Ground forces carried</h3>
          {renderRow('infantry')}
          <h3>
            Space cannon support
            <InfoTip>
              Your PDS on other planets in this system, or in adjacent systems with PDS II. They fire during
              Space Cannon Offense only.
            </InfoTip>
          </h3>
          {renderRow('pds')}
        </>
      )}

      <h3>Combat technologies</h3>
      <div className="tech-list">
        {techs.map((tech) => (
          <label key={tech.id} className={`tech${value.techs.includes(tech.id) ? ' on' : ''}`} title={tech.text}>
            <input type="checkbox" checked={value.techs.includes(tech.id)} onChange={() => toggleTech(tech.id)} />
            {tech.name}
            {tech.faction && <span className="faction-tag">faction</span>}
            <FlagTip flags={flags.techs[tech.id]} onDismiss={() => onDismissFlag({ kind: 'techs', tech: tech.id })} />
          </label>
        ))}
      </div>
    </>
  );
}
