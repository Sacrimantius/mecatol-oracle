# Saved games

Records of past and current Twilight Imperium games played on Board Game Arena. Everything in this folder except
this file is ignored by git: logs hold other players' names and private details, so they stay on this machine.

## Saving a game

1. On BGA, open the game log and **expand it fully** (load the whole history) so no lines are hidden.
2. Copy all of it, newest line first as BGA shows it.
3. In Mecatol Oracle: **Import BGA log**, paste, then **Save game…**.
4. Fill in what the log can't show: the BGA table number (from the table URL, `table?table=…`), the start date, the
   end date (filled in from the log's "Latest Action" for finished games), and any faction it couldn't tell.

Saving needs the desktop app (`npm run dev`); a plain browser tab can't write files. An unfinished game can be
saved and saved again later: the same table number replaces the earlier record after asking.

## Layout

```
games/<table number>/game.json   The record below
games/<table number>/log.txt     The pasted log, unchanged
```

## game.json

| Field | Meaning |
| --- | --- |
| `version` | Format version, currently 1 |
| `id` | BGA table number |
| `status` | `finished` or `inProgress` |
| `startDate`, `endDate` | ISO dates; `endDate` is null while in progress |
| `winner`, `rounds` | Who won (null if unfinished) and the last round reached |
| `players[]` | One entry per player, below |
| `notes` | Anything the parser couldn't account for |
| `savedAt` | When the record was written |

Each player has:

| Field | Meaning |
| --- | --- |
| `name`, `factionId`, `score` | Victory points from every "gained/lost N victory point(s)" line |
| `tradeGoods` | `gained`; `spent` (production, research, influence, action cards); `lost` (taken by Pillage, given away in deals) |
| `units.<type>` | `starting`, `produced` (paid for), `placed` (free: Magen Defense Grid, Construction structures, War Effort, Ghost Ship…), `lost`, and `producedCost` / `lostCost` in resources. Structures count as 0. |
| `unitTotals` | The same, summed over unit types |
| `dice.space`, `dice.invasion`, `dice.total` | Dice luck, below |

Space covers Space Cannon Offense, Anti-Fighter Barrage, Ambush and space combat. Invasion covers Bombardment, Space
Cannon Defense and ground combat. For each:

| Field | Meaning |
| --- | --- |
| `dice`, `hits`, `expectedHits` | Dice rolled, hits scored, and the average hits those dice give |
| `hitPercentile` | Where the hits fall among every result the same dice could have rolled: 50 is average, 90 is luckier than 90% of results |
| `averageFace`, `facePercentile` | The natural die faces (modifiers removed) and how their sum ranks against fair d10s, ignoring hits |

To-hit values come from each player's faction and the unit upgrades they had researched at the time. The game log
itself is kept, so records can be rebuilt if the format changes.
