import { FACTIONS, getUnitStats } from '../engine/data/factions';
import { endStateKey, parseEndStateKey, resourcesLost } from '../engine/simulate';
import {
  ALL_UNIT_TYPES,
  type Role,
  type SideInput,
  type SimulationInput,
  type SimulationResult,
  type UnitType,
} from '../engine/types';
import type { ActualResult } from '../import/bga';
import { endStateRarity, likelihoodLabel, luckLabel, mean, midRank, rank, type Rank } from './actualStats';
import { percent, percentSmall } from './format';
import { InfoTip } from './InfoTip';
import { UNIT_LABELS } from './Results';

/** An imported combat's real outcome, with the sides it was imported with. */
export interface ActualCombat {
  result: ActualResult;
  players: Record<Role, string>;
  sides: Record<Role, SideInput>;
  invade: boolean;
  planet: string | null;
  /** The user swapped attacker and defender after importing. */
  swapped: boolean;
}

interface Props {
  combat: ActualCombat;
  /** The latest simulation, if one has been run since the import. */
  sim: { input: SimulationInput; result: SimulationResult } | null;
  onClose: () => void;
}

const ROLES: Role[] = ['attacker', 'defender'];
const other = (role: Role): Role => (role === 'attacker' ? 'defender' : 'attacker');

function unitName(side: SideInput, type: UnitType): string {
  const faction = FACTIONS.find((f) => f.id === side.factionId);
  return faction ? getUnitStats(faction, type, !!side.upgrades[type]).name : UNIT_LABELS[type];
}

/** Resources lost, or null while the faction (and so the unit costs) is unknown. */
function lostValue(side: SideInput, survivors: SideInput['counts']): number | null {
  return FACTIONS.some((f) => f.id === side.factionId) ? resourcesLost(side, survivors) : null;
}

const resources = (n: number) => `${n % 1 ? n.toFixed(1) : n} resource${n === 1 ? '' : 's'}`;

/** Compares what the simulator ran with what was imported, ignoring zero counts and list order. */
function sameSide(a: SideInput, b: SideInput): boolean {
  const canon = (s: SideInput) =>
    JSON.stringify([
      s.factionId,
      ALL_UNIT_TYPES.map((t) => [s.counts[t] ?? 0, s.damaged?.[t] ?? 0, !!s.upgrades[t]]),
      [...s.techs].sort(),
      [...(s.actionCards ?? [])].sort(),
    ]);
  return canon(a) === canon(b);
}

/** The same combat seen with attacker and defender swapped, to follow the Swap button. */
export function swapActual(combat: ActualCombat): ActualCombat {
  const flip = <T,>(r: Record<Role, T>): Record<Role, T> => ({ attacker: r.defender, defender: r.attacker });
  const flipRole = <T extends string>(v: T): T => (v === 'attacker' ? 'defender' : v === 'defender' ? 'attacker' : v) as T;
  const { result } = combat;
  return {
    ...combat,
    players: flip(combat.players),
    sides: flip(combat.sides),
    swapped: !combat.swapped,
    result: {
      ...result,
      winner: flipRole(result.winner),
      space: flipRole(result.space),
      retreated: result.retreated && flipRole(result.retreated),
      lost: flip(result.lost),
      survivors: flip(result.survivors),
    },
  };
}

function describe(combat: ActualCombat): string[] {
  const { result, players, planet } = combat;
  const steps: string[] = [];
  const rounds = (n: number) => `${n} round${n === 1 ? '' : 's'}`;
  if (result.space === 'noCombat') steps.push('No space combat.');
  else if (result.space === 'draw') {
    steps.push(`Space combat ended with both fleets destroyed after ${rounds(result.spaceRounds)}.`);
  }
  else steps.push(`${players[result.space]} won the space combat in ${rounds(result.spaceRounds)}.`);
  if (result.retreated) steps.push(`${players[result.retreated]} retreated.`);
  if (combat.invade) {
    const where = planet ?? 'the planet';
    const ground = result.groundRounds ? ` after ${rounds(result.groundRounds)} of ground combat` : '';
    if (result.invasion === 'captured') steps.push(`${players.attacker} captured ${where}${ground}.`);
    else if (result.invasion === 'repelled') steps.push(`${players.defender} held ${where}${ground}.`);
    else if (result.invasion === 'draw') steps.push(`Every ground force on ${where} was destroyed${ground}.`);
    else steps.push(`${players.attacker} didn't land on ${where}.`);
  }
  return steps;
}

/** Fewer / same / more losses than the actual, as a stacked bar. */
function RankBar({ r }: { r: Rank }) {
  return (
    <div className="rank-bar" aria-hidden>
      <div className="seg fewer" style={{ flexGrow: r.below }} />
      <div className="seg same" style={{ flexGrow: r.at }} />
      <div className="seg more" style={{ flexGrow: r.above }} />
    </div>
  );
}

/** Distribution of resources lost in the simulation, with the bar for the actual loss highlighted. */
function LossHistogram({ histogram, actualHalves }: { histogram: number[]; actualHalves: number }) {
  // Half-resource bins are only worth showing when fighters or infantry make half values possible.
  const halves = histogram.some((v, k) => k % 2 === 1 && v > 0) || actualHalves % 2 === 1;
  const step = halves ? 1 : 2;
  const bins: number[] = [];
  for (let k = 0; k < Math.max(histogram.length, actualHalves + 1); k += step) {
    bins.push((histogram[k] ?? 0) + (step === 2 ? (histogram[k + 1] ?? 0) : 0));
  }
  const actualBin = Math.floor(actualHalves / step);
  const tallest = Math.max(...bins, Number.EPSILON);
  const value = (bin: number) => (bin * step) / 2;
  return (
    <div className="loss-histogram">
      <div className="bars">
        {bins.map((share, bin) => (
          <div
            key={bin}
            className={bin === actualBin ? 'bar actual' : 'bar'}
            style={{ height: `${Math.max(share > 0 ? 3 : 0, (share / tallest) * 100)}%` }}
            title={`${resources(value(bin))} lost: ${percent(share)} of battles${bin === actualBin ? ' (actual)' : ''}`}
          />
        ))}
      </div>
      <div className="axis">
        <span>0</span>
        <span>{resources(value(bins.length - 1))} lost</span>
      </div>
    </div>
  );
}

function SideLosses({ role, combat, sim }: { role: Role; combat: ActualCombat; sim: Props['sim'] }) {
  const side = combat.sides[role];
  const { lost, survivors } = combat.result;
  const value = lostValue(side, survivors[role]);
  const rows = ALL_UNIT_TYPES.filter((t) => (side.counts[t] ?? 0) > 0);
  const simSide = sim?.input[role];
  const lossDist = sim?.result.distributions.lostValue[role];
  const lossRank = lossDist && value !== null ? rank(lossDist, Math.round(value * 2)) : null;

  return (
    <div className={`survivor-table actual-side ${role}`}>
      <h3>
        {combat.players[role] || (role === 'attacker' ? 'Attacker' : 'Defender')} lost
        {value !== null && <span className="actual-value">{resources(value)}</span>}
      </h3>
      {rows.length === 0 && <p className="caption">No units</p>}
      {rows.map((type) => {
        const start = side.counts[type] ?? 0;
        const gone = lost[role][type] ?? 0;
        const simStart = simSide?.counts[type] ?? 0;
        const simLost = sim && simStart ? simStart - (sim.result.averageSurvivors[role][type] ?? 0) : null;
        return (
          <div className="survivor-row actual-row" key={type}>
            <span>{unitName(side, type)}</span>
            <div className="mini-bar">
              <div style={{ width: `${(gone / start) * 100}%` }} />
            </div>
            <span className="num">
              {gone} / {start}
            </span>
            {sim && <span className="num avg">{simLost === null ? '—' : `avg ${simLost.toFixed(2)}`}</span>}
          </div>
        );
      })}
      {lossRank && lossDist && value !== null && (
        <div className="luck">
          <div className="luck-head">
            <span className={`luck-label ${luckTone(midRank(lossRank))}`}>{luckLabel(midRank(lossRank))}</span>
            <span className="caption">
              Simulated average {resources(mean(lossDist) / 2)}
            </span>
          </div>
          <RankBar r={lossRank} />
          <p className="caption">
            Fewer losses in {percent(lossRank.below)} of battles, the same in {percent(lossRank.at)}, more in{' '}
            {percent(lossRank.above)}.
          </p>
          <LossHistogram histogram={lossDist} actualHalves={Math.round(value * 2)} />
        </div>
      )}
    </div>
  );
}

/**
 * The resource trade (defender's losses minus attacker's) of the real combat, ranked among the simulated ends.
 * Null while either faction is unknown.
 */
function tradeRank(combat: ActualCombat, sim: NonNullable<Props['sim']>): { swing: number; rank: Rank } | null {
  const attLost = lostValue(combat.sides.attacker, combat.result.survivors.attacker);
  const defLost = lostValue(combat.sides.defender, combat.result.survivors.defender);
  if (attLost === null || defLost === null) return null;
  const swing = defLost - attLost;
  const r: Rank = { below: 0, at: 0, above: 0 };
  for (const [key, share] of Object.entries(sim.result.distributions.endStates)) {
    const left = parseEndStateKey(key);
    const s = resourcesLost(sim.input.defender, left.defender) - resourcesLost(sim.input.attacker, left.attacker);
    if (Math.abs(s - swing) < 1e-9) r.at += share;
    else if (s < swing) r.below += share;
    else r.above += share;
  }
  return { swing, rank: r };
}

function TradeLine({ combat, trade }: { combat: ActualCombat; trade: { swing: number; rank: Rank } }) {
  const att = combat.players.attacker || 'The attacker';
  const { swing, rank: r } = trade;
  const m = midRank(r);
  return (
    <div className="trade">
      <div className="luck-head">
        <span>
          <b>Resource trade:</b>{' '}
          {swing === 0 ? 'even' : `${att} came out ${resources(Math.abs(swing))} ${swing > 0 ? 'ahead' : 'behind'}`}
        </span>
        <span className={`luck-label ${luckTone(1 - m)}`}>{luckLabel(1 - m)} for {att}</span>
      </div>
      <RankBar r={{ below: r.above, at: r.at, above: r.below }} />
      <p className="caption">
        Simulated battles went better for {att} in {percent(r.above)}, the same in {percent(r.at)}, worse in{' '}
        {percent(r.below)}.
      </p>
    </div>
  );
}

const luckTone = (m: number) => (m < 0.35 ? 'good' : m > 0.65 ? 'bad' : 'even');

/** Why the comparison may be off. Most only apply once there's a simulation to compare with. */
function caveats(combat: ActualCombat, simInput: SimulationInput | null): string[] {
  const list: string[] = [];
  if (combat.result.retreated) {
    const who = combat.players[combat.result.retreated];
    list.push(`${who} retreated. The simulator doesn't retreat, so it fights on instead.`);
  }
  if (!simInput) return list;
  if (combat.swapped) {
    list.push('Attacker and defender were swapped after importing, so the simulation is a different battle.');
  }
  for (const role of ROLES) {
    if (!combat.swapped && !sameSide(simInput[role], combat.sides[role])) {
      list.push(`The ${role} was edited after importing; the odds are for the edited fleet.`);
    }
  }
  if (simInput.options.invade !== combat.invade) {
    list.push(
      combat.invade
        ? 'The real combat had an invasion, but this simulation has none.'
        : 'This simulation adds an invasion the real combat didn’t have.',
    );
  }
  return list;
}

export function ActualResultBox({ combat, sim, onClose }: Props) {
  const { result, players } = combat;
  const winnerName = result.winner === 'draw' ? 'Draw' : `${players[result.winner] || result.winner} wins`;
  const winnerShare = sim ? sim.result.overall[result.winner] : null;
  const rarity = sim ? endStateRarity(sim.result.distributions.endStates, endStateKey(result.survivors)) : null;
  const spaceDist = sim?.result.distributions.spaceRounds;
  const spaceFought = spaceDist ? 1 - (spaceDist[0] ?? 0) : 0;
  // Share of the battles that had a space combat lasting at least as long as the real one.
  const asLong =
    spaceDist && result.spaceRounds > 1 && spaceFought > 0
      ? spaceDist.slice(result.spaceRounds).reduce((s, v) => s + v, 0) / spaceFought
      : null;
  const notes = caveats(combat, sim?.input ?? null);
  const trade = sim ? tradeRank(combat, sim) : null;

  return (
    <section className="actual">
      <div className="actual-head">
        <h2>Actual result</h2>
        <span className="caption">From the BGA log</span>
        <button className="icon-button" onClick={onClose} title="Hide the actual result" aria-label="Hide the actual result">
          ×
        </button>
      </div>

      <div className="actual-verdict">
        <div className={`verdict ${result.winner}`}>
          <span className="big">{winnerName}</span>
          {result.winner !== 'draw' && (
            <span className="caption">
              as {result.winner}, against {players[other(result.winner)] || other(result.winner)}
            </span>
          )}
        </div>
        {winnerShare !== null && (
          <div className="verdict-odds">
            <span className={`likelihood ${likelihoodTone(winnerShare)}`}>{likelihoodLabel(winnerShare)}</span>
            <span className="caption">
              {result.winner === 'draw' ? 'A draw' : 'This winner'} in {percent(winnerShare)} of simulated battles
            </span>
          </div>
        )}
      </div>
      <ul className="actual-steps">
        {describe(combat).map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ul>

      <div className="survivors">
        {ROLES.map((role) => (
          <SideLosses key={role} role={role} combat={combat} sim={sim} />
        ))}
      </div>

      {sim && rarity && (
        <div className="stage actual-odds">
          <h3>
            How likely was this?
            <InfoTip>
              <strong>Reading these numbers</strong>
              <p>
                Each simulated battle ends with some set of units left on both sides. <b>Exact result</b> is how often
                the simulation ended with exactly the units that survived in the game.
              </p>
              <p>
                <b>At least this unusual</b> adds up every simulated ending no more likely than the real one. Near 100%
                means the game went the most typical way; under 5% means it was a rare result for these fleets.
              </p>
              <p>
                <b>Resource trade</b> is the defender's losses minus the attacker's, in resources, compared with the same
                trade in every simulated battle. It works even when no simulated battle ended exactly the same way.
              </p>
              <p>Losses count units destroyed. Units that retreated or were moved away count as survivors.</p>
            </InfoTip>
          </h3>
          <div className="stat-grid">
            <div className="stat">
              <span className="stat-value">{percentSmall(rarity.share)}</span>
              <span className="stat-label">Exact result</span>
            </div>
            {rarity.share > 0 && (
              <div className="stat">
                <span className={`stat-value ${likelihoodTone(rarity.asRare)}`}>{percentSmall(rarity.asRare)}</span>
                <span className="stat-label">At least this unusual</span>
              </div>
            )}
            {asLong !== null && (
              <div className="stat">
                <span className="stat-value">{percent(asLong)}</span>
                <span className="stat-label">
                  Space combats lasting {result.spaceRounds}+ rounds (average{' '}
                  {sim.result.averageSpaceRounds.toFixed(2)})
                </span>
              </div>
            )}
          </div>
          {trade && <TradeLine combat={combat} trade={trade} />}
          {rarity.share === 0 && (
            <p className="caption">
              The simulation never produced this exact ending. Most often a player assigned hits differently from the
              simulator's fixed policy (losing a ship while cheaper units were left, say). The game may also have used
              something the simulator doesn't model, or the imported fleets may be missing units.
            </p>
          )}
        </div>
      )}
      {!sim && <p className="caption">Run the simulation to see how likely this outcome was.</p>}

      {notes.length > 0 && (
        <ul className="flag-list actual-caveats">
          {notes.map((n) => (
            <li key={n} className="warn">
              {n}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

const likelihoodTone = (p: number) => (p >= 0.2 ? 'even' : p >= 0.05 ? 'odd' : 'rare');
