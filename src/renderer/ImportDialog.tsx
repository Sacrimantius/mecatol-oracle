import { useEffect, useMemo, useRef, useState } from 'react';
import { getFaction } from '../engine/data/factions';
import { ALL_UNIT_TYPES, type SideInput } from '../engine/types';
import { parseBgaLog, type ImportedCombat } from '../import/bga';
import { countWarnings } from './importFlags';

interface Props {
  onLoad: (combat: ImportedCombat) => void;
  onClose: () => void;
}

const UNIT_SHORT: Record<string, string> = {
  flagship: 'flagship',
  warsun: 'war sun',
  dreadnought: 'dread',
  carrier: 'carrier',
  cruiser: 'cruiser',
  destroyer: 'destroyer',
  fighter: 'fighter',
  infantry: 'inf',
  pds: 'PDS',
  spacedock: 'dock',
};

function describeSide(player: string, side: SideInput) {
  const faction = side.factionId ? getFaction(side.factionId).name : 'faction unknown';
  const units = ALL_UNIT_TYPES.filter((t) => side.counts[t])
    .map((t) => `${side.counts[t]} ${UNIT_SHORT[t]}`)
    .join(', ');
  return `${player || 'Nobody'} (${faction}): ${units || 'no units seen'}`;
}

/** Scrolls a textarea so the line holding character `offset` sits near the top, allowing for wrapped lines. */
function scrollToOffset(textarea: HTMLTextAreaElement, offset: number) {
  const style = getComputedStyle(textarea);
  const mirror = document.createElement('div');
  for (const prop of ['fontFamily', 'fontSize', 'fontWeight', 'lineHeight', 'letterSpacing', 'tabSize'] as const) {
    mirror.style[prop] = style[prop];
  }
  Object.assign(mirror.style, {
    position: 'absolute',
    visibility: 'hidden',
    top: '0',
    left: '-9999px',
    boxSizing: 'border-box',
    width: `${textarea.clientWidth}px`,
    padding: style.padding,
    whiteSpace: 'pre-wrap',
    overflowWrap: 'break-word',
  });
  mirror.textContent = textarea.value.slice(0, offset);
  const marker = document.createElement('span');
  marker.textContent = '​';
  mirror.appendChild(marker);
  document.body.appendChild(mirror);
  const lineHeight = parseFloat(style.lineHeight) || 16;
  textarea.scrollTop = Math.max(0, marker.offsetTop - parseFloat(style.paddingTop) - lineHeight);
  mirror.remove();
}

export function ImportDialog({ onLoad, onClose }: Props) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [text, setText] = useState('');
  const [selected, setSelected] = useState(0);
  const result = useMemo(() => (text.trim() ? parseBgaLog(text) : null), [text]);
  const combats = result?.combats ?? [];

  useEffect(() => setSelected(0), [text]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const chosen = combats[selected];

  /** Shows a combat's lines in the pasted log: scrolled into view and selected. */
  const reveal = (combat: ImportedCombat) => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.focus({ preventScroll: true });
    // "backward" keeps the caret at the first line, so the browser doesn't scroll to the last.
    textarea.setSelectionRange(combat.source.start, combat.source.end, 'backward');
    scrollToOffset(textarea, combat.source.start);
  };

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="import-title">
        <header className="modal-header">
          <h2 id="import-title">Import a combat from Board Game Arena</h2>
          <button className="icon-button" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>
        <p className="caption">
          Copy the game log from BGA, from the system activation to the end of the combat, and paste it below. A
          longer stretch of log works too: pick the combat afterwards. Anything the log doesn't prove is marked{' '}
          <span className="inline-badge warn">!</span> for you to check.
        </p>
        <textarea
          ref={textareaRef}
          className="log-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={'Webbly finished a tactical action in ( NAR / JOL ).\n…\nWebbly activated ( NAR / JOL ) to start a tactical action.'}
          spellCheck={false}
          autoFocus
        />

        {result && combats.length === 0 && (
          <p className="error">No combat found. Make sure the paste includes the dice rolls and combat lines.</p>
        )}

        {combats.length > 0 && (
          <div className="combat-list" role="radiogroup" aria-label="Combats found">
            <h3>
              {combats.length === 1 ? '1 combat found' : `${combats.length} combats found, newest first`}
            </h3>
            {combats.map((c, i) => {
              const warnings = countWarnings(c.flags.attacker) + countWarnings(c.flags.defender) +
                c.notes.filter((n) => n.level === 'warn').length;
              return (
                <label key={i} className={`combat-option${i === selected ? ' on' : ''}`}>
                  <input
                    type="radio"
                    name="combat"
                    checked={i === selected}
                    onChange={() => setSelected(i)}
                    // Also fires for arrow keys, and for clicking the combat that is already picked.
                    onClick={() => reveal(c)}
                  />
                  <span className="combat-title">{c.title}</span>
                  <span className="combat-steps">{c.summary || 'No combat steps recognised'}</span>
                  <span className="combat-side attacker">{describeSide(c.players.attacker, c.attacker)}</span>
                  <span className="combat-side defender">{describeSide(c.players.defender, c.defender)}</span>
                  <span className={`combat-warnings${warnings ? ' warn' : ''}`}>
                    {warnings ? `${warnings} item${warnings === 1 ? '' : 's'} to check` : 'Nothing to check'}
                  </span>
                </label>
              );
            })}
          </div>
        )}

        <footer className="modal-footer">
          <button className="secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="primary" disabled={!chosen} onClick={() => chosen && onLoad(chosen)}>
            Load into simulator
          </button>
        </footer>
      </div>
    </div>
  );
}
