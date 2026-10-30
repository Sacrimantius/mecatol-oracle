import { useEffect, useRef, useState } from 'react';
import type { SideInput, SimulationInput, SimulationResult } from '../engine/types';
import { Results } from './Results';
import { SidePanel } from './SidePanel';
import SimWorker from './sim.worker?worker&inline';

const ITERATION_OPTIONS = [1000, 5000, 10000, 25000, 50000];

const initialAttacker: SideInput = {
  factionId: 'sardakk',
  counts: { dreadnought: 2, carrier: 2, fighter: 4, infantry: 4 },
  upgrades: {},
  techs: [],
};

const initialDefender: SideInput = {
  factionId: 'jolnar',
  counts: { flagship: 1, cruiser: 2, destroyer: 1, infantry: 3, pds: 1 },
  upgrades: {},
  techs: [],
};

export function App() {
  const [attacker, setAttacker] = useState(initialAttacker);
  const [defender, setDefender] = useState(initialDefender);
  const [iterations, setIterations] = useState(10000);
  const [invade, setInvade] = useState(true);
  const [wormhole, setWormhole] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [last, setLast] = useState<{ input: SimulationInput; result: SimulationResult } | null>(null);
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => () => workerRef.current?.terminate(), []);

  const run = () => {
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
    // Only space units carry over cleanly; planet units stay with the defender role.
    setAttacker({ ...defender, counts: { ...defender.counts, pds: 0, spacedock: 0 } });
    setDefender(attacker);
  };

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
          <button className="secondary" onClick={swap}>
            ⇄ Swap
          </button>
          <button className="primary" onClick={run} disabled={running}>
            {running ? 'Simulating…' : 'Run simulation'}
          </button>
        </div>
      </header>

      <main className="layout">
        <SidePanel role="attacker" value={attacker} onChange={setAttacker} />
        <div className="center">
          {error && <div className="error">{error}</div>}
          {last ? (
            <Results result={last.result} input={last.input} />
          ) : (
            <div className="empty">
              <p>Set up both fleets, then run the simulation to see each side's odds.</p>
            </div>
          )}
        </div>
        <SidePanel role="defender" value={defender} onChange={setDefender} />
      </main>
    </div>
  );
}
