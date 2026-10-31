import { getFaction, getUnitStats } from '../engine/data/factions';
import { DESTROY_ORDER, SUSTAIN_ORDER } from '../engine/simulate';
import { ALL_UNIT_TYPES, type Role, type SimulationInput, type SimulationResult, type UnitType } from '../engine/types';
import { percent } from './format';
import { InfoTip } from './InfoTip';

interface Props {
  result: SimulationResult;
  /** The input the result was produced from, so survivor names match what was simulated. */
  input: SimulationInput;
}

function Bar({ attacker, draw, defender }: { attacker: number; draw: number; defender: number }) {
  return (
    <div className="odds-bar">
      <div className="seg attacker" style={{ flexGrow: attacker }} />
      <div className="seg draw" style={{ flexGrow: draw }} />
      <div className="seg defender" style={{ flexGrow: defender }} />
    </div>
  );
}

interface StatProps {
  label: string;
  value: number;
  tone?: Role | 'draw';
  info?: string;
}

function Stat({ label, value, tone, info }: StatProps) {
  return (
    <div className={`stat ${tone ?? ''}`}>
      <span className="stat-value">{percent(value)}</span>
      <span className="stat-label">
        {label}
        {info && <InfoTip>{info}</InfoTip>}
      </span>
    </div>
  );
}

export const UNIT_LABELS: Record<UnitType, string> = {
  flagship: 'Flagship',
  warsun: 'War Sun',
  dreadnought: 'Dreadnought',
  carrier: 'Carrier',
  cruiser: 'Cruiser',
  destroyer: 'Destroyer',
  fighter: 'Fighter',
  infantry: 'Infantry',
  pds: 'PDS',
  spacedock: 'Space Dock',
};

const byOrder = (order: Partial<Record<UnitType, number>>, exclude: UnitType[] = []) =>
  (Object.keys(order) as UnitType[])
    .filter((t) => !exclude.includes(t))
    .sort((a, b) => order[a]! - order[b]!)
    .map((t) => UNIT_LABELS[t])
    .join(' → ');

function HitOrderInfo() {
  return (
    <>
      <strong>How each side assigns hits</strong>
      <p>Every battle uses the same fixed policy: keep as much of the fleet as possible.</p>
      <ol>
        <li>
          <b>Sustain Damage first</b>, on undamaged units in this order: {byOrder(SUSTAIN_ORDER)}. Not available
          against the Mentak flagship.
        </li>
        <li>
          <b>Then lose the cheapest units</b>: {byOrder(DESTROY_ORDER, ['pds', 'spacedock'])}. Damaged units go
          before undamaged ones of the same type.
        </li>
      </ol>
      <p>
        Hits that must target non-fighters (Graviton Laser System, the L1Z1X flagship and its dreadnoughts) skip
        fighters. Anti-Fighter Barrage hits only fighters. Assault Cannon destroys the cheapest non-fighter ship.
      </p>
    </>
  );
}

export function Results({ result, input }: Props) {
  const { overall, space, invasion } = result;
  const attackerName = getFaction(input.attacker.factionId).name;
  const defenderName = getFaction(input.defender.factionId).name;

  return (
    <section className="results">
      <div className="headline">
        <div className="headline-side attacker">
          <span className="big">{percent(overall.attacker)}</span>
          <span>{attackerName} wins</span>
        </div>
        <div className="headline-side draw">
          <span className="big">{percent(overall.draw)}</span>
          <span>Draw</span>
        </div>
        <div className="headline-side defender">
          <span className="big">{percent(overall.defender)}</span>
          <span>{defenderName} wins</span>
        </div>
      </div>
      <Bar {...overall} />
      <p className="caption">
        {result.iterations.toLocaleString()} battles in {Math.round(result.durationMs)} ms.
        {invasion ? ' The attacker wins only by capturing the planet.' : ''}
      </p>

      <div className="stages">
        <div className="stage">
          <h3>Space combat</h3>
          <div className="stat-grid">
            <Stat label="Attacker wins" value={space.attacker} tone="attacker" />
            <Stat label="Defender wins" value={space.defender} tone="defender" />
            <Stat label="Mutual destruction" value={space.draw} tone="draw" />
            <Stat
              label="No space combat"
              value={space.noCombat}
              info="One side had no ships when space combat would start, so none was fought. This happens when the defender has only planet units, or when Space Cannon Offense destroys every ship on one side first."
            />
          </div>
          <p className="caption">Average {result.averageSpaceRounds.toFixed(2)} rounds</p>
        </div>
        {invasion && (
          <div className="stage">
            <h3>Invasion</h3>
            <div className="stat-grid">
              <Stat label="Planet captured" value={invasion.captured} tone="attacker" />
              <Stat label="Invasion repelled" value={invasion.repelled} tone="defender" />
              <Stat label="All ground forces lost" value={invasion.draw} tone="draw" />
              <Stat
                label="No landing"
                value={invasion.notAttempted}
                info="The attacker couldn't land: it lost or tied the space combat, or had no ground forces left to commit."
              />
            </div>
            <p className="caption">Average {result.averageGroundRounds.toFixed(2)} ground rounds</p>
          </div>
        )}
      </div>

      <div className="survivors">
        {(['attacker', 'defender'] as const).map((role) => {
          const sideInput = input[role];
          const faction = getFaction(sideInput.factionId);
          const rows = ALL_UNIT_TYPES.filter((t) => (sideInput.counts[t] ?? 0) > 0);
          return (
            <div className={`survivor-table ${role}`} key={role}>
              <h3>
                {role === 'attacker' ? 'Attacker' : 'Defender'} average survivors
                <InfoTip>
                  <HitOrderInfo />
                </InfoTip>
              </h3>
              {rows.length === 0 && <p className="caption">No units</p>}
              {rows.map((type) => {
                const start = sideInput.counts[type] ?? 0;
                const left = result.averageSurvivors[role][type] ?? 0;
                return (
                  <div className="survivor-row" key={type}>
                    <span>{getUnitStats(faction, type, !!sideInput.upgrades[type]).name}</span>
                    <div className="mini-bar">
                      <div style={{ width: `${(left / start) * 100}%` }} />
                    </div>
                    <span className="num">
                      {left.toFixed(2)} / {start}
                    </span>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </section>
  );
}
