import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { getFaction } from '../engine/data/factions';
import { GENERIC_UNITS } from '../engine/data/units';
import { ALL_UNIT_TYPES, type UnitType } from '../engine/types';
import type { ImportedCombat } from '../import/bga';
import type { DiceLuck, GameRecord, PlayerRecord, UnitTally } from '../import/bgaGame';
import { gameCombats, type GameCombat } from '../import/savedGame';
import { ordinal } from './format';
import { gameReader, type SavedGame } from './gameStore';
import { describeSide } from './ImportDialog';
import { countWarnings } from './importFlags';

interface Props {
  selectedId: string | null;
  onSelect: (id: string) => void;
  onLoadCombat: (combat: ImportedCombat) => void;
}

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));
const unitName = (t: UnitType) => (t === 'flagship' ? 'Flagship' : GENERIC_UNITS[t].base.name);
const factionName = (id: string) => (id ? getFaction(id).name : 'faction unknown');

function dates(record: GameRecord) {
  if (record.status === 'inProgress') return `Started ${record.startDate}, in progress`;
  return `${record.startDate} to ${record.endDate ?? '?'}`;
}

/** The saved games on the left; the picked game's statistics and combats on the right. */
export function GamesView({ selectedId, onSelect, onLoadCombat }: Props) {
  const [games, setGames] = useState<GameRecord[] | null>(null);
  const [game, setGame] = useState<SavedGame | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    gameReader
      ?.listGames()
      .then((list) => {
        setGames(list);
        if (!selectedId && list[0]) onSelect(list[0].id);
      })
      .catch((e) => setError(message(e)));
  }, []);

  useEffect(() => {
    setGame(null);
    setError(null);
    if (!gameReader || !selectedId) return;
    let current = true;
    gameReader
      .loadGame(selectedId)
      .then((g) => current && setGame(g))
      .catch((e) => current && setError(`Couldn't open game ${selectedId}: ${message(e)}`));
    return () => {
      current = false;
    };
  }, [selectedId]);

  if (!gameReader) {
    return (
      <main className="games">
        <div className="empty">
          <p>Saved games open in the desktop app (npm run dev), or on the dev server.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="games">
      <aside className="game-list" aria-label="Saved games">
        <h2>Saved games</h2>
        {games === null && !error && <p className="muted">Loading…</p>}
        {games?.length === 0 && (
          <p className="muted">
            No saved games yet. Import a whole BGA game log and choose <b>Save game</b>.
          </p>
        )}
        {games?.map((g) => (
          <button
            key={g.id}
            className={`game-item${g.id === selectedId ? ' on' : ''}`}
            onClick={() => onSelect(g.id)}
            aria-current={g.id === selectedId}
          >
            <span className="game-item-title">Table {g.id}</span>
            <span className="muted">{dates(g)}</span>
            <span>
              {g.winner ? `${g.winner} won` : `Round ${g.rounds}`} · {g.players.length} players
            </span>
          </button>
        ))}
      </aside>
      <section className="game-detail">
        {error && <div className="error">{error}</div>}
        {game ? (
          <GameDetail key={game.record.id} game={game} onLoadCombat={onLoadCombat} />
        ) : (
          selectedId && !error && <p className="muted">Loading…</p>
        )}
      </section>
    </main>
  );
}

function GameDetail({ game: { record, log }, onLoadCombat }: { game: SavedGame; onLoadCombat: Props['onLoadCombat'] }) {
  const combats = useMemo(() => gameCombats(log), [log]);
  const [open, setOpen] = useState<number | null>(null);
  const players = [...record.players].sort((a, b) => b.score - a.score);
  const maxScore = Math.max(10, ...players.map((p) => p.score));

  const load = (c: GameCombat) =>
    onLoadCombat({
      ...c.combat,
      title: `${c.combat.title} (table ${record.id}, combat ${c.number}${c.round ? `, round ${c.round}` : ''})`,
    });

  return (
    <div className="game-body" style={{ '--players': players.length } as CSSProperties}>
      <header className="game-head">
        <h2>Table {record.id}</h2>
        <span className="muted">
          {dates(record)} · {record.winner ? `${record.winner} won in round ${record.rounds}` : `round ${record.rounds}`}{' '}
          · saved {record.savedAt.slice(0, 10)}
        </span>
      </header>

      <section className="game-section">
        <h3>Score</h3>
        <div className="score-bars">
          {players.map((p) => (
            <div key={p.name} className={`score-row${p.name === record.winner ? ' winner' : ''}`}>
              <span className="score-name">
                {p.name} <span className="muted">{factionName(p.factionId)}</span>
              </span>
              <div className="score-track">
                <div className="score-fill" style={{ width: `${(p.score / maxScore) * 100}%` }} />
              </div>
              <span className="score-value">{p.score}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="game-section">
        <h3>Players</h3>
        <div className="player-cards">
          {players.map((p) => (
            <PlayerCard key={p.name} player={p} winner={p.name === record.winner} />
          ))}
        </div>
        <p className="caption">
          Hit luck: where a player's hits fall among every result their dice could have rolled. The middle line is the
          50th percentile (average); further right is luckier.
        </p>
      </section>

      {record.notes.length > 0 && (
        <section className="game-section">
          <h3>Notes</h3>
          {record.notes.map((n) => (
            <p key={n} className="caption">
              {n}
            </p>
          ))}
        </section>
      )}

      <section className="game-section">
        <h3>Combat log</h3>
        <p className="caption">
          {combats.length} combat{combats.length === 1 ? '' : 's'}, oldest first. Click one for its log lines; Load
          puts it in the simulator.
        </p>
        <ol className="game-combats">
          {combats.map((c, i) => {
            const on = open === c.number;
            const warnings =
              countWarnings(c.combat.flags.attacker) +
              countWarnings(c.combat.flags.defender) +
              c.combat.notes.filter((n) => n.level === 'warn').length;
            return (
              <li key={c.number}>
                {c.round !== null && c.round !== combats[i - 1]?.round && <h4 className="round-head">Round {c.round}</h4>}
                <div className={`game-combat${on ? ' on' : ''}`}>
                  <button className="game-combat-toggle" onClick={() => setOpen(on ? null : c.number)} aria-expanded={on}>
                    <span className="combat-number">{c.number}</span>
                    <span className="combat-title">{c.combat.title}</span>
                    <span className="combat-steps">{c.combat.summary}</span>
                    <span className="combat-side attacker">{describeSide(c.combat.players.attacker, c.combat.attacker)}</span>
                    <span className="combat-side defender">{describeSide(c.combat.players.defender, c.combat.defender)}</span>
                  </button>
                  <button className="primary small" onClick={() => load(c)}>
                    Load
                  </button>
                  {on && (
                    <div className="game-combat-body">
                      <span className={`combat-warnings${warnings ? ' warn' : ''}`}>
                        {warnings ? `${warnings} item${warnings === 1 ? '' : 's'} to check once loaded` : 'Nothing to check'}
                      </span>
                      <pre className="combat-lines">{c.lines.join('\n')}</pre>
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
}

function PlayerCard({ player: p, winner }: { player: PlayerRecord; winner: boolean }) {
  const types = ALL_UNIT_TYPES.filter((t) => {
    const u = p.units[t];
    return u && (u.starting || u.produced || u.placed || u.lost);
  });
  const cells = (u: UnitTally) => (
    <>
      <td>{u.starting || ''}</td>
      <td>{u.produced || ''}</td>
      <td>{u.placed || ''}</td>
      <td>{u.lost || ''}</td>
    </>
  );
  return (
    <article className={`player-card${winner ? ' winner' : ''}`}>
      <header>
        <span className="player-name">{p.name}</span>
        <span className="muted">{factionName(p.factionId)}</span>
        <span className="player-score">{p.score} VP</span>
      </header>

      <div className="tg-tiles" aria-label="Trade goods">
        <div>
          <span className="tg-value">{p.tradeGoods.gained}</span>
          <span className="muted">TG gained</span>
        </div>
        <div>
          <span className="tg-value">{p.tradeGoods.spent}</span>
          <span className="muted">spent</span>
        </div>
        <div>
          <span className="tg-value">{p.tradeGoods.lost}</span>
          <span className="muted">lost</span>
        </div>
      </div>

      <div className="luck">
        <LuckMeter label="Space" luck={p.dice.space} />
        <LuckMeter label="Invasion" luck={p.dice.invasion} />
        <LuckMeter label="Total" luck={p.dice.total} />
      </div>

      <table className="game-table unit-tally">
        <thead>
          <tr>
            <th>Units</th>
            <th title="On the board at setup">Start</th>
            <th title="Paid for">Built</th>
            <th title="Placed free: Magen Defense Grid, Construction, War Effort…">Placed</th>
            <th>Lost</th>
          </tr>
        </thead>
        <tbody>
          {types.map((t) => (
            <tr key={t}>
              <td>{unitName(t)}</td>
              {cells(p.units[t]!)}
            </tr>
          ))}
          <tr className="total">
            <td>Total</td>
            {cells(p.unitTotals)}
          </tr>
        </tbody>
      </table>
      <p className="caption">
        Built {p.unitTotals.producedCost} resources of units, lost {p.unitTotals.lostCost}.
      </p>
    </article>
  );
}

function LuckMeter({ label, luck }: { label: string; luck: DiceLuck }) {
  const pct = luck.hitPercentile;
  const detail = luck.dice
    ? `${luck.hits} hits from ${luck.dice} dice, ${luck.expectedHits} expected`
    : 'No dice rolled';
  const faces =
    luck.averageFace !== null && luck.facePercentile !== null
      ? `Average die face ${luck.averageFace} (${ordinal(luck.facePercentile)} percentile).`
      : '';
  return (
    <div className="luck-row" title={`${detail}. ${faces}`}>
      <span className="luck-label">{label}</span>
      <div className="luck-track">
        {pct !== null && (
          <div className={`luck-marker${pct >= 50 ? ' lucky' : ' unlucky'}`} style={{ left: `${pct}%` }} />
        )}
      </div>
      <span className="luck-value">{pct === null ? '–' : ordinal(pct)}</span>
      <span className="luck-detail muted">{detail}</span>
    </div>
  );
}
