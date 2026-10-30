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

### Simplifications

* **Hit assignment** follows a fixed "minimise losses" policy: absorb hits with Sustain Damage first (dreadnoughts, then carriers, War Suns, flagship), then lose units cheapest-first (fighters, infantry, destroyers, cruisers, carriers, dreadnoughts, War Suns, flagship).
* **Not modelled yet:** retreats, action cards, promissory notes, agents and other leaders, capacity limits, the Hacan flagship's trade-good bonus, the Exotrireme II self-destruct, Yin Devotion and Impulse Core, and X-89 Bacterial Weapon.
* **Optional abilities** are always used when they help: Assault Cannon, Ambush, Plasma Scoring and Graviton.

## Importing a combat from Board Game Arena

**Import BGA log** takes text copied from a BGA game log, newest line first as BGA shows it (oldest first also works). Paste one combat, from the system activation to the end of the tactical action, or a longer stretch of log and pick the combat. The importer fills in:

* **Players and sides:** the active player attacks. The planet fought over and whether to invade come from the ground-force and bombardment lines.
* **Units:** the fleet moved in, plus the dice and losses in the log. Ships and ground forces that rolled are complete counts; everything else is "at least", and damaged ships that started the combat damaged are included.
* **Faction:** worked out from faction abilities, techs and flagship dice anywhere in the paste.
* **Upgrades:** the combinations of base and upgraded units that explain every roll's hit count, Anti-Fighter Barrage dice and Ambush to-hit values. Upgrades and techs seen in earlier combats in the same paste carry forward.
* **Technologies:** shown in the log ("used DURANIUM ARMOR", "Effects: PLASMA SCORING"), or ruled out when they would have shown.

Each imported value carries a mark: **i** explains where it came from, and an amber **!** means the log doesn't prove it. Changing a value by hand clears its mark. Third players' Space Cannon, action cards and other planets are listed in the banner but aren't simulated.

## Project layout

```
electron/main.cts          Electron main process
src/engine/types.ts        Shared types
src/engine/data/           Unit, faction and tech data
src/engine/simulate.ts     Combat engine
src/engine/*.test.ts       Engine tests
src/import/bga.ts          BGA log importer
src/import/fixtures/       Real BGA combat logs used by the importer tests
src/renderer/              React UI and the simulation worker
```
