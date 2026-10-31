import { useEffect, useMemo, useState } from 'react';
import { FACTIONS, getFaction } from '../engine/data/factions';
import { buildGameRecord, parseBgaGame, type DiceLuck, type GameRecord } from '../import/bgaGame';

/** Exposed by electron/preload.cts. Missing in a plain browser (the Vite dev server on its own). */
interface DesktopBridge {
  saveGame(record: GameRecord, log: string, overwrite: boolean): Promise<{ status: 'saved' | 'exists'; dir: string }>;
}
const desktop = (window as unknown as { mecatol?: DesktopBridge }).mecatol;

interface Props {
  log: string;
  onClose: () => void;
}

const ordinal = (n: number) => {
  const r = Math.round(n);
  const suffix = r % 100 >= 11 && r % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][r % 10] ?? 'th';
  return `${r}${suffix}`;
};

function LuckCell({ luck }: { luck: DiceLuck }) {
  if (luck.hitPercentile === null) return <td className="muted">–</td>;
  return (
    <td title={`${luck.hits} hits from ${luck.dice} dice (${luck.expectedHits} expected). Average face ${luck.averageFace}, ${ordinal(luck.facePercentile!)} percentile.`}>
      {ordinal(luck.hitPercentile)}
    </td>
  );
}

export function SaveGameDialog({ log, onClose }: Props) {
  const parsed = useMemo(() => parseBgaGame(log), [log]);
  const finished = parsed.winner !== null;
  const [id, setId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState(finished ? (parsed.lastActionDate ?? '') : '');
  const [factions, setFactions] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<{ kind: 'error' | 'exists' | 'saved'; message: string } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  useEffect(() => setStatus(null), [id]);

  const unknown = parsed.players.filter((p) => !p.factionId);
  const missing = [
    !/^[\w-]+$/.test(id) && 'the BGA table number',
    !startDate && 'the start date',
    finished && !endDate && 'the end date',
    unknown.some((p) => !factions[p.name]) && 'every faction',
  ].filter(Boolean);

  const save = async (overwrite: boolean) => {
    if (!desktop) {
      setStatus({ kind: 'error', message: 'Saving needs the desktop app (npm run dev), not a browser tab.' });
      return;
    }
    setSaving(true);
    try {
      const record = buildGameRecord(parsed, { id, startDate, endDate: endDate || null, factions });
      const result = await desktop.saveGame(record, log, overwrite);
      setStatus(
        result.status === 'exists'
          ? { kind: 'exists', message: `Game ${id} is already saved. Replace it with this log?` }
          : { kind: 'saved', message: `Saved to ${result.dir}` },
      );
    } catch (e) {
      setStatus({ kind: 'error', message: e instanceof Error ? e.message : String(e) });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal wide" role="dialog" aria-modal="true" aria-labelledby="save-title">
        <header className="modal-header">
          <h2 id="save-title">Save game</h2>
          <button className="icon-button" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>
        <p className="caption">
          {finished
            ? `${parsed.winner} won in round ${parsed.rounds}.`
            : `In progress: round ${parsed.rounds || '?'}. Save again later to update it.`}{' '}
          The log doesn't show the table number or when the game started, so fill those in.
        </p>

        <div className="save-fields">
          <label>
            BGA table number
            <input value={id} onChange={(e) => setId(e.target.value.trim())} placeholder="123456789" autoFocus />
          </label>
          <label>
            Started
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </label>
          <label>
            {finished ? 'Ended' : 'Ended (if finished)'}
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </label>
          {unknown.map((p) => (
            <label key={p.name}>
              {p.name}'s faction
              <select value={factions[p.name] ?? ''} onChange={(e) => setFactions({ ...factions, [p.name]: e.target.value })}>
                <option value="">Choose…</option>
                {FACTIONS.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>

        <div className="game-table-wrap">
          <table className="game-table">
            <thead>
              <tr>
                <th rowSpan={2}>Player</th>
                <th rowSpan={2}>Score</th>
                <th colSpan={3}>Trade goods</th>
                <th colSpan={2}>Units</th>
                <th colSpan={3}>Hit luck percentile</th>
              </tr>
              <tr>
                <th>Gained</th>
                <th>Spent</th>
                <th>Lost</th>
                <th>Produced</th>
                <th>Lost</th>
                <th>Space</th>
                <th>Invasion</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {parsed.players.map((p) => {
                const factionId = factions[p.name] || p.factionId;
                return (
                  <tr key={p.name} className={p.name === parsed.winner ? 'winner' : undefined}>
                    <td>
                      {p.name}
                      <span className="muted"> {factionId ? getFaction(factionId).name : 'faction unknown'}</span>
                    </td>
                    <td>{p.score}</td>
                    <td>{p.tradeGoods.gained}</td>
                    <td>{p.tradeGoods.spent}</td>
                    <td>{p.tradeGoods.lost}</td>
                    <td title={`${p.unitTotals.placed} more placed free`}>
                      {p.unitTotals.produced} <span className="muted">({p.unitTotals.producedCost} res)</span>
                    </td>
                    <td>
                      {p.unitTotals.lost} <span className="muted">({p.unitTotals.lostCost} res)</span>
                    </td>
                    <LuckCell luck={p.dice.space} />
                    <LuckCell luck={p.dice.invasion} />
                    <LuckCell luck={p.dice.total} />
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="caption">
          Hit luck: where each player's hits fall among every result their dice could have rolled (50th is average).
          Hover a figure for the dice behind it. The saved record also has units by type and raw die-face percentiles.
        </p>
        {parsed.notes.map((n) => (
          <p key={n} className="error">
            {n}
          </p>
        ))}
        {status && <p className={status.kind === 'saved' ? 'success' : 'error'}>{status.message}</p>}

        <footer className="modal-footer">
          <button className="secondary" onClick={onClose}>
            {status?.kind === 'saved' ? 'Close' : 'Cancel'}
          </button>
          {status?.kind === 'exists' ? (
            <button className="primary" disabled={saving} onClick={() => save(true)}>
              Replace
            </button>
          ) : (
            <button
              className="primary"
              disabled={saving || missing.length > 0 || parsed.players.length === 0}
              title={missing.length ? `Fill in ${missing.join(', ')}` : undefined}
              onClick={() => save(false)}
            >
              Save game
            </button>
          )}
        </footer>
      </div>
    </div>
  );
}
