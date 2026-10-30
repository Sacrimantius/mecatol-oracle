import { FACTIONS, getFaction, getUnitDefinition } from '../engine/data/factions';
import { techsForFaction } from '../engine/data/techs';
import type { Role, SideInput, TechId, UnitType } from '../engine/types';
import { describeStats } from './format';

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
  onChange: (value: SideInput) => void;
}

export function SidePanel({ role, value, onChange }: Props) {
  const faction = getFaction(value.factionId);
  const groundUnits: UnitType[] = role === 'defender' ? ['infantry', 'pds', 'spacedock'] : ['infantry'];
  const techs = techsForFaction(value.factionId);

  const setFaction = (factionId: string) => {
    // Drop faction techs the new faction cannot use.
    const allowed = new Set(techsForFaction(factionId).map((t) => t.id));
    onChange({ ...value, factionId, techs: value.techs.filter((t) => allowed.has(t)) });
  };
  const setCount = (type: UnitType, count: number) =>
    onChange({ ...value, counts: { ...value.counts, [type]: Math.min(MAX_COUNT[type], Math.max(0, count)) } });
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
    return (
      <div className={`unit-row${count > 0 ? ' active' : ''}`} key={type}>
        <div className="unit-info" title={stats.text}>
          <div className="unit-name">
            {stats.name}
            {stats.text && <span className="info-dot">i</span>}
          </div>
          <div className="unit-stats">{describeStats(stats)}</div>
        </div>
        {def.upgraded ? (
          <button
            className={`upgrade${upgraded ? ' on' : ''}`}
            onClick={() => toggleUpgrade(type)}
            title={upgraded ? `Using ${def.upgraded.name}` : `Upgrade to ${def.upgraded.name}`}
          >
            II
          </button>
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
    <section className={`side-panel ${role}`}>
      <header>
        <h2>{role === 'attacker' ? 'Attacker' : 'Defender'}</h2>
        <select value={value.factionId} onChange={(e) => setFaction(e.target.value)}>
          {FACTIONS.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </select>
      </header>

      {faction.abilityText.length > 0 && (
        <ul className="ability-notes">
          {faction.abilityText.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      )}

      <h3>Ships in system</h3>
      {SPACE_UNITS.map(renderRow)}

      <h3>{role === 'defender' ? 'On the planet' : 'Ground forces carried'}</h3>
      {groundUnits.map(renderRow)}

      <h3>Combat technologies</h3>
      <div className="tech-list">
        {techs.map((tech) => (
          <label key={tech.id} className={`tech${value.techs.includes(tech.id) ? ' on' : ''}`} title={tech.text}>
            <input type="checkbox" checked={value.techs.includes(tech.id)} onChange={() => toggleTech(tech.id)} />
            {tech.name}
            {tech.faction && <span className="faction-tag">faction</span>}
          </label>
        ))}
      </div>
    </section>
  );
}
