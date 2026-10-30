import { useEffect, useRef, useState } from 'react';
import {
  ALL_UNIT_TYPES,
  SHIP_TYPES,
  type SideInput,
  type SimulationInput,
  type Role,
  type SimulationResult,
  type UnitType,
} from '../engine/types';
import type { ImportedCombat, SideFlags } from '../import/bga';
import { ImportDialog } from './ImportDialog';
import { clearEdited, countWarnings, dismissFlag, emptyFlags, type FlagKey } from './importFlags';
import { Results } from './Results';
import { SidePanel } from './SidePanel';
import SimWorker from './sim.worker?worker&inline';

const ITERATION_OPTIONS = [1000, 5000, 10000, 25000, 50000];

const emptySide: SideInput = { factionId: '', counts: {}, damaged: {}, upgrades: {}, techs: [] };

interface ImportState {
  title: string;
  summary: string;
  notes: ImportedCombat['notes'];
  flags: Record<Role, SideFlags>;
}

const total = (side: SideInput, types: readonly UnitType[]) =>
  types.reduce((sum, t) => sum + (side.counts[t] ?? 0), 0);

/** Why the simulation can't run yet, or null when it can. */
function blockedReason(attacker: SideInput, defender: SideInput): string | null {
  if (!attacker.factionId || !defender.factionId) return 'Choose a faction for both sides.';
  if (total(attacker, SHIP_TYPES) === 0) return 'Add at least one ship to the attacker.';
  if (total(defender, ALL_UNIT_TYPES) === 0) return 'Add at least one unit to the defender.';
  return null;
}

export function App() {
  const [attacker, setAttacker] = useState(emptySide);
  const [defender, setDefender] = useState(emptySide);
  const [iterations, setIterations] = useState(10000);
  const [invade, setInvade] = useState(false);
  const [wormhole, setWormhole] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [last, setLast] = useState<{ input: SimulationInput; result: SimulationResult } | null>(null);
  const [importing, setImporting] = useState(false);
  const [imported, setImported] = useState<ImportState | null>(null);
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => () => workerRef.current?.terminate(), []);

  const blocked = blockedReason(attacker, defender);

  const run = () => {
    if (blocked) return;
    workerRef.current?.terminate();
    const input: SimulationInput = { attacker, defender, options: { iterations, invade, wormhole } };
    const worker = new SimWorker();
    workerRef.current = worker;
    setRunning(true);
    setError(null);
    worker.onmessage = (e: MessageEvent<SimulationResult>) => {
      setLast({ input, result: e.data });
      setRunning(false);
      worker.terminate();
    };
    worker.onerror = (e) => {
      setError(e.message || 'Simulation failed');
      setRunning(false);
      worker.terminate();
    };
    worker.postMessage(input);
  };

  const swap = () => {
    // The attacker has no planet in the system, so a space dock can't come with it.
    setAttacker({ ...defender, counts: { ...defender.counts, spacedock: 0 } });
    setDefender(attacker);
    setImported((imp) => imp && { ...imp, flags: { attacker: imp.flags.defender, defender: imp.flags.attacker } });
  };

  /** Updates a side, dropping import flags on whatever the user changed. */
  const editSide = (role: Role, next: SideInput) => {
    const prev = role === 'attacker' ? attacker : defender;
    (role === 'attacker' ? setAttacker : setDefender)(next);
    setImported((imp) => imp && { ...imp, flags: { ...imp.flags, [role]: clearEdited(imp.flags[role], prev, next) } });
  };

  const loadImport = (combat: ImportedCombat) => {
    setAttacker(combat.attacker);
    setDefender(combat.defender);
    setInvade(combat.invade);
    setWormhole(combat.wormhole);
    setImported({ title: combat.title, summary: combat.summary, notes: combat.notes, flags: combat.flags });
    setLast(null);
    setImporting(false);
  };

  const dismiss = (role: Role, key: FlagKey) =>
    setImported((imp) => imp && { ...imp, flags: { ...imp.flags, [role]: dismissFlag(imp.flags[role], key) } });
  const dismissNote = (message: string) =>
    setImported((imp) => imp && { ...imp, notes: imp.notes.filter((n) => n.message !== message) });

  const toCheck = imported
    ? countWarnings(imported.flags.attacker) +
      countWarnings(imported.flags.defender) +
      imported.notes.filter((n) => n.level === 'warn').length
    : 0;

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="logo">◎</span>
          <div>
            <h1>Mecatol Oracle</h1>
            <span className="subtitle">Twilight Imperium combat odds</span>
          </div>
        </div>
        <div className="controls">
          <label className="toggle">
            <input type="checkbox" checked={invade} onChange={(e) => setInvade(e.target.checked)} />
            Invade planet
          </label>
          <label className="toggle" title="For Dimensional Splicer">
            <input type="checkbox" checked={wormhole} onChange={(e) => setWormhole(e.target.checked)} />
            Wormhole in system
          </label>
          <label className="iterations">
            Battles
            <select value={iterations} onChange={(e) => setIterations(Number(e.target.value))}>
              {ITERATION_OPTIONS.map((n) => (
                <option key={n} value={n}>
                  {n.toLocaleString()}
                </option>
              ))}
            </select>
          </label>
          <button className="secondary" onClick={() => setImporting(true)}>
            Import BGA log
          </button>
          <button className="secondary" onClick={swap}>
            ⇄ Swap
          </button>
          <button className="primary" onClick={run} disabled={running || !!blocked} title={blocked ?? undefined}>
            {running ? 'Simulating…' : 'Run simulation'}
          </button>
        </div>
      </header>

      {imported && toCheck > 0 && (
        <section className="import-banner">
          <div className="import-banner-head">
            <span>
              <strong>Imported:</strong> {imported.title}
              {imported.summary && <span className="import-steps"> · {imported.summary}</span>}
            </span>
            <span className="combat-warnings warn">
              {toCheck} item{toCheck === 1 ? '' : 's'} to check, marked ! (click one once checked)
            </span>
            <button className="secondary small" onClick={() => setImported(null)}>
              Clear all marks
            </button>
          </div>
          {imported.notes.length > 0 && (
            <ul className="flag-list">
              {imported.notes.map((n) => (
                <li key={n.message} className={`banner-note ${n.level}`}>
                  {n.level === 'warn' && (
                    <button
                      className="inline-badge warn"
                      onClick={() => dismissNote(n.message)}
                      title="Mark as checked"
                      aria-label="Mark as checked"
                    >
                      !
                    </button>
                  )}
                  {n.message}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <main className="layout">
        <SidePanel
          role="attacker"
          value={attacker}
          otherFactionId={defender.factionId}
          flags={imported?.flags.attacker ?? emptyFlags()}
          onDismissFlag={(key) => dismiss('attacker', key)}
          onChange={(v) => editSide('attacker', v)}
        />
        <div className="center">
          {error && <div className="error">{error}</div>}
          {last ? (
            <Results result={last.result} input={last.input} />
          ) : (
            <div className="empty">
              <p>{blocked ?? 'Ready. Run the simulation to see each side’s odds.'}</p>
            </div>
          )}
        </div>
        <SidePanel
          role="defender"
          value={defender}
          otherFactionId={attacker.factionId}
          flags={imported?.flags.defender ?? emptyFlags()}
          onDismissFlag={(key) => dismiss('defender', key)}
          onChange={(v) => editSide('defender', v)}
        />
      </main>

      {importing && <ImportDialog onLoad={loadImport} onClose={() => setImporting(false)} />}
    </div>
  );
}
