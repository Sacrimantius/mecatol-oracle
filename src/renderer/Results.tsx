import { getFaction, getUnitStats } from '../engine/data/factions';
import { ALL_UNIT_TYPES, type Role, type SimulationInput, type SimulationResult } from '../engine/types';
import { percent } from './format';

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

function Stat({ label, value, tone }: { label: string; value: number; tone?: Role | 'draw' }) {
  return (
    <div className={`stat ${tone ?? ''}`}>
      <span className="stat-value">{percent(value)}</span>
      <span className="stat-label">{label}</span>
    </div>
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
            <Stat label="No combat" value={space.noCombat} />
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
              <Stat label="No landing" value={invasion.notAttempted} />
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
              <h3>{role === 'attacker' ? 'Attacker' : 'Defender'} average survivors</h3>
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
