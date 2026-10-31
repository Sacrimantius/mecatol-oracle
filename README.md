# Mecatol Oracle

A Twilight Imperium 4th Edition combat simulator for Windows. Set up an attacker and a defender, then run thousands of simulated battles to see each side's odds.

Built with Electron, React, TypeScript and Vite. The combat engine (`src/engine`) is plain TypeScript with no UI dependencies, and it runs in a Web Worker so the window stays responsive.

## Getting started

Needs Node.js 22 or later.

```bash
npm install
```

npm 11+ blocks package install scripts unless they're approved. `package.json` already approves Electron's script. If the Electron binary is still missing, run:

```bash
node node_modules/electron/install.js
```

| Command | What it does |
| --- | --- |
| `npm run dev` | Vite dev server plus Electron with hot reload |
| `npm start` | Build, then run the production app |
| `npm test` | Engine tests (Vitest) |
| `npm run typecheck` | Type-check the renderer and the Electron main process |
| `npm run dist` | Build a Windows installer into `release/` |

## What's simulated

Content covers the **17 base-game factions**, every generic unit and its upgrade, faction units (Letani Warriors, Spec Ops, Advanced Carriers, Super-Dreadnoughts, Exotriremes, Hybrid Crystal Fighters, Prototype War Suns, Floating Factories) and all 17 flagships.

Each battle runs these steps in order:

1. **Space Cannon Offense.** Both sides fire; the attacker fires first. The attacker's PDS are "space cannon support": PDS on other planets in the system, or in adjacent systems with PDS II. They fire only in this step.
2. **Space combat.** Start-of-combat effects come first, then Anti-Fighter Barrage in round 1, then combat rounds until one or both sides have no ships left.
3. **Invasion**, if enabled and the attacker controls space:
   1. Bombardment (blocked by Planetary Shield unless a War Sun or the Letnev flagship is present)
   2. Commit ground forces
   3. Space Cannon Defense
   4. Ground combat

The **combat technologies** modelled are Plasma Scoring, Antimass Deflectors, Graviton Laser System, Duranium Armor, Assault Cannon, Magen Defense Grid Ω, Non-Euclidean Shielding, L4 Disruptors, Dimensional Splicer and Valkyrie Particle Weave.

These **faction effects** are modelled:

* Sardakk Unrelenting
* Jol-Nar Fragile
* Mentak Ambush
* L1Z1X Harrow
* These flagships:
  * Letnev: repair each round, strips shields
  * Mentak: no Sustain Damage for the opponent
  * Jol-Nar: extra hits on natural 9s and 10s
  * Winnu: one die per enemy non-fighter ship
  * Sardakk: +1 to other ships
  * L1Z1X: hits must target non-fighters
  * Yin: destroys all ships when it dies
  * Naalu: fighters join ground combat
  * Nekro: ground forces fight in space

The Nekro Virus can select any faction tech, standing in for Valefar Assimilator.

### Action cards

Each side can hold any of the base-game combat action cards, listed under its technologies. Direct Hit, Morale Boost, Shields Holding and Maneuvering Jets have 4 copies in the deck, so a side can hold up to 4 of each; the rest have 1. The simulator plays each copy at most once, at a fixed moment, and never plays two copies of a card on the same thing at once (Rules Reference 2.6):

| Card | Played |
|---|---|
| Morale Boost | One per round: the first round of space combat and of ground combat, then later rounds while copies last, keeping one for ground combat when invading |
| Fighter Prototype | First space combat round, if the side has fighters |
| Shields Holding | Each space combat round dealing the side 2+ hits, or a hit it can't sustain, one per round |
| Direct Hit | On each enemy ship that uses Sustain Damage |
| Courageous to the End | After the side's first non-fighter ship is destroyed in a space combat round |
| Emergency Repairs | End of the first space round leaving 2+ damaged units, or 1 with nothing else able to sustain |
| Maneuvering Jets | Each Space Cannon roll that hits the side, one per roll |
| Scramble Frequency | First enemy Bombardment, Space Cannon or Anti-Fighter Barrage roll that beats the average |
| Experimental Battlestation (defender) | Adds Space Cannon 5 ×3 to Space Cannon Offense |
| Disable (attacker) | The defender's PDS don't fire or shield |
| Bunker (defender) | −4 to the attacker's Bombardment |
| Fire Team | Rerolls every miss in the first ground combat round |

Sabotage, retreats, Parley and other cards that don't change the dice aren't simulated.

### Simplifications

* **Hit assignment** follows a fixed "minimise losses" policy: absorb hits with Sustain Damage first (dreadnoughts, then carriers, War Suns, flagship), then lose units cheapest-first (fighters, infantry, destroyers, cruisers, carriers, dreadnoughts, War Suns, flagship).
* **Not modelled yet:** retreats, non-combat action cards and Sabotage, promissory notes, agents and other leaders, capacity limits, the Hacan flagship's trade-good bonus, the Exotrireme II self-destruct, Yin Devotion and Impulse Core, and X-89 Bacterial Weapon.
* **Optional abilities** are always used when they help: Assault Cannon, Ambush, Plasma Scoring and Graviton.

## Importing a combat from Board Game Arena

**Import BGA log** takes text copied from a BGA game log, newest line first as BGA shows it (oldest first also works). **Expand the log fully on BGA before copying** (load the whole history), or hidden lines are missed. Paste one combat, from the system activation to the end of the tactical action, or a longer stretch of log and pick the combat. The importer fills in:

* **Players and sides:** the active player attacks. The planet fought over and whether to invade come from the ground-force and bombardment lines.
* **Units:** the fleet moved in, plus the dice and losses in the log. Ships and ground forces that rolled are complete counts; everything else is "at least", and damaged ships that started the combat damaged are included.
* **Faction:** worked out from faction abilities, techs and flagship dice anywhere in the paste.
* **Upgrades:** the combinations of base and upgraded units that explain every roll's hit count, Anti-Fighter Barrage dice and Ambush to-hit values. Upgrades and techs seen in earlier combats in the same paste carry forward.
* **Action cards:** the simulated cards each player played, one copy per play, unless Sabotage cancelled them.
* **Technologies:** shown in the log ("used DURANIUM ARMOR", "Effects: PLASMA SCORING"), or ruled out when they would have shown.

Each imported value carries a mark: **i** explains where it came from, and an amber **!** means the log doesn't prove it. Changing a value by hand clears its mark. Third players' Space Cannon, action cards and other planets are listed in the banner but aren't simulated.

### Actual result

Below the odds, an **Actual result** box shows what happened in the game: who won, how the space combat and invasion went, and each side's losses by unit and in resources. Once the simulation has run, it places the real outcome among the simulated battles:

* how often the simulator gave the same winner, labelled Expected, Plausible, Unlikely or Long shot;
* for each side, the share of simulated battles with fewer, the same or more losses, a luck label and a histogram of resources lost with the real loss highlighted;
* the resource trade (defender's losses minus attacker's) ranked the same way;
* how often the simulation ended with exactly the same survivors, and, when it did at all, the share of endings no more likely than that one.

Losses count units the log shows as destroyed, plus infantry carried by a fleet that was wiped out. Units that retreated or were moved away count as survivors. The box warns when the comparison is off: a retreat (not simulated), sides edited or swapped after importing, or an invasion turned on or off.

## Saving games

**Import BGA log → Save game…** keeps a record of a whole game: paste the full, fully expanded log of a finished or
ongoing game. The record has players, factions, final score, start and end dates, trade goods gained, spent and lost,
units by type (starting, produced, placed free, lost, with resource costs), and each player's dice luck as a
percentile, split into space combat, invasion and total. The log doesn't show the BGA table number or start date, so
the save form asks for them.

Games are saved to `games/<table number>/` (`game.json` plus the log), which git ignores. Saving needs the desktop
app. See [games/README.md](games/README.md) for the record format.

## Browsing saved games

The **Games** tab lists the saved games. Pick one to see the score and, for each player, their trade goods, dice luck
(a meter for space, invasion and total, with the dice behind it) and units by type. Below that is the game's combat
log, grouped by round: click a combat for its log lines, or **Load** to put it in the simulator just as if it had been
imported, Actual result box included. Tactical actions with no combat in them are left out.

The Games tab reads saved games in the desktop app, and in a browser tab on the Vite dev server (`npx vite`). It
also always lists the anonymized example games in `samples/games/`, which are bundled into the app, so the web
version on GitHub Pages has a game to open.

## Project layout

```
electron/main.cts          Electron main process
src/engine/types.ts        Shared types
src/engine/data/           Unit, faction and tech data
src/engine/simulate.ts     Combat engine
src/engine/*.test.ts       Engine tests
src/import/bga.ts          BGA log importer
src/import/bgaGame.ts      Whole-game statistics for saved games
src/import/savedGame.ts    A saved game's combats, for the Games tab
games/                     Saved games (git-ignored apart from its README)
samples/games/             Anonymized example games, bundled into the app
src/import/fixtures/       Real BGA combat logs used by the importer tests
src/renderer/              React UI and the simulation worker
```
