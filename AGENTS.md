# Agent guide: Mecatol Oracle

A Twilight Imperium 4th Edition (base game, 17 factions; no Prophecy of Kings) combat simulator: Electron + React +
TypeScript + Vite. Read `README.md` first for what is and isn't simulated; this file covers what you need to change
the code safely.

## Commands

| Command | Use |
| --- | --- |
| `npm test` | Vitest, `src/**/*.test.ts` (engine + BGA importer). Run after every change. |
| `npm run typecheck` | Renderer and Electron main. `strict`, `noUnusedLocals`, `noUnusedParameters`. |
| `npx vite build` | Quick renderer build check. |
| `npx vite` | Dev server on http://localhost:5173 (`strictPort`). Lets you check the UI in a browser without Electron. |
| `npm run dev` | Vite + Electron with hot reload. |

Before calling work done: tests pass, typecheck is clean, and UI changes have been looked at in the running app.

## Environment gotchas (Windows dev machine)

- Node may not be on `PATH` in Git Bash: `export PATH="$PATH:/c/Program Files/nodejs"`.
- There's no Python. Use Node for scripted edits.
- `core.autocrlf=true`: working files are mostly LF, while files freshly checked out by git are CRLF. Normalise
  with `sed -i 's/\r$//' file` before scripted string replacements, or matches fail. Git's "LF will be replaced by
  CRLF" warnings go to stderr and can make a successful command exit non-zero.
- **There is no Prettier config. Don't run Prettier**: its defaults (double quotes, 80 columns) rewrite whole
  files. Format by hand to match the code: single quotes, semicolons, 2-space indent, lines up to about 120 columns.
- TS `lib` is ES2022: no `Array.prototype.findLast`/`toSorted` (use `[...a].reverse().find(...)`).
- Test files are typechecked by `tsc` and can't use `node:fs`. Load fixtures with Vite's `?raw` import.
- Commit messages: imperative subject, a wrapped body explaining why. Commit and push only when the user asks.

## Layout

```
src/engine/types.ts          Shared types (SideInput, UnitType, TechId, ActionCardId, ...)
src/engine/data/units.ts     Generic units and upgrades
src/engine/data/factions.ts  17 factions: abilities, faction units, flagships
src/engine/data/techs.ts     Combat techs
src/engine/data/actionCards.ts  Combat action cards: text, simulated usage, deck copies, role restriction
src/engine/rng.ts            mulberry32 seeded RNG; d10 = floor(rng*10)+1
src/engine/simulate.ts       Combat engine (pure TS, no DOM). Runs in a Web Worker.
src/import/bga.ts            Board Game Arena log importer
src/import/fixtures/         Real BGA logs (one 4-player game, 29 combats) used as test fixtures
src/renderer/                React UI: App (state, import banner), SidePanel, ImportDialog, Results,
                             ActualResult (real outcome vs simulation; stats in actualStats.ts),
                             InfoTip (hover/click popover), importFlags (import marks), sim.worker.ts
electron/main.cts            Electron main process
```

## Engine (`src/engine/simulate.ts`)

- `fight()` order: Disable → Space Cannon Offense (attacker first) → space combat (start-of-combat effects, AFB in
  round 1, rounds) → invasion if enabled and the attacker holds space (Bombardment, commit, Space Cannon Defense,
  ground combat).
- `runSimulation` also returns `distributions`: per-unit survivor, resources-lost and round histograms, and the
  share of each exact end state keyed by `endStateKey`. The Actual result box ranks the real outcome against these.
- `buildTemplate` converts a `SideInput` once per run; `instantiate` makes fresh mutable `Side`s per battle.
- Hit assignment is a fixed policy (`SUSTAIN_ORDER`, `DESTROY_ORDER`). Optional abilities are always used if they
  help. Each action card is played at a fixed moment, documented in its `usage` string. Keep `usage`, the README
  table and the code in step.
- Action cards: `Side.cards` is a `Map<id, copies>` and `play(side, id)` spends one copy and returns whether it
  could. `SideInput.actionCards` is an array; a card listed twice is held twice, capped at `ActionCard.copies`.
  Rules Reference 2.6 (no two same-name cards in one timing window on the same units or mechanic) is why Morale
  Boost and Shields Holding go one per round and Maneuvering Jets one per Space Cannon roll.
- The deck copy counts (4 for Direct Hit, Morale Boost, Shields Holding, Maneuvering Jets; 1 for the rest) come from
  memory and haven't been checked against a card list. Verify them if that matters.

### Engine tests

`simulate.test.ts` drives `simulateOnce` with deterministic RNGs: `alwaysTen`, `always(n)` (every die rolls n),
`sequence(...dice)`. Helpers `side(factionId, counts, extra)`, `input(att, def, options)`, `cards([...])`. When adding
a rule, write a test that fails without it. A test that passes either way, like one where the effect only triggers
once regardless, proves nothing.

## BGA importer (`src/import/bga.ts`)

`parseBgaLog(text)` returns `{ combats (newest first), factions }`. Each `ImportedCombat` carries the two
`SideInput`s, players, system or planet, invade and wormhole options, per-value `flags`, banner `notes` and
`source: {start, end}` (character offsets of the combat in the pasted text, so the dialog can select it).

Facts about BGA logs the parser relies on:
- BGA shows lines newest first. The parser detects the order and works chronologically. Timestamps are stripped.
- Combats are segmented at "activated ( SYSTEM ) to start a tactical action". A Warfare "... and activate a
  system." line just before belongs to the next segment. The fixture's `=== Combat N ===` headers were added by
  hand; real pastes have none, so never depend on them.
- Each `[ ]` group in a roll line is one unit; the group size is that unit's dice count. Displayed dice already
  include modifiers (Bunker shows `[ -2 ]`; Jol-Nar Fragile is already subtracted).
- In "DetailsEffects:" tags, ANTIMASS DEFLECTORS belongs to the target; the others belong to the roller. X-89
  doubles hits, so the hit count can't be checked.
- "used AMBUSH ... to hit on N-10" gives a threshold. AFB dice per unit tell destroyer upgrades apart.
- Cards: "X played NAME." records a play; "X's NAME action card was canceled." (after a Sabotage) cancels X's most
  recent play of NAME. Simulated, uncancelled cards load as one copy per play. Others are listed in the banner.
- The last combat in a paste may have no "finished a tactical action" line.

How values are inferred:
- Unit counts are lower bounds (present plus already lost). Ship counts are exact if that side rolled in space
  combat; ground forces are exact if it rolled in ground combat. Units produced mid-combat, landing transfers,
  fleet-limit removals and Magen-placed infantry are accounted for.
- Upgrades: enumerate base/upgraded combinations and keep those consistent with every roll. Ambiguity gives a
  warning flag.
- Faction: keyword scoring (abilities, faction techs and units) plus a flagship dice-profile check.
- Upgrades and techs seen in earlier combats in the same paste carry forward.
- `ImportedCombat.actual` is what happened, in the simulator's terms: winner (same rule as `fight()`), space and
  invasion outcomes, rounds, retreat, and `lost`/`survivors` per side. Losses are "destroyed" lines (and removals
  BGA says destroyed units), plus carried infantry when the attacker's fleet is gone, mirroring the engine. The
  "won space/ground combat against" and "Ground combat ended in a draw" lines decide outcomes when present.
- Flag levels: `info` explains a value's source; `warn` means the log doesn't prove it. The UI shows warns as amber
  "!". Clicking a mark clears it, editing a value clears its marks, and the banner counts the warns left.

Importer tests (`bga.test.ts`) parse each fixture block on its own and the whole log together. Combat numbers in
test names refer to the fixture headers (combat 1 is the newest).

## Not modelled yet

See README "Simplifications": retreats, non-dice action cards, promissory notes, leaders, capacity, Hacan flagship,
Exotrireme II, Yin Devotion and Impulse Core, X-89. The Morale Boost and other card timings are fixed policies, not
optimal play.
