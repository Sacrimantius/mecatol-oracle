# Example games

Anonymized saved games, committed so the Games tab has something to open on GitHub Pages. They are bundled into the
app and listed after any local saved games. Each one is a normal saved game (`games/README.md` has the format):

```
samples/games/<id>/game.json
samples/games/<id>/log.txt
```

| Id | Game |
| --- | --- |
| `sample-1` | 4 players, finished, played to 14 points over 9 rounds, 29 combats |

## Anonymizing a game before adding it

Everything here is public. Starting from a saved game in `games/`:

- Replace every player name with `Player 1`, `Player 2`… in both files, in the order of `players` in game.json, and
  `winner` too. Match names anywhere, case-insensitively and without word boundaries: BGA runs sentences together
  ("…1 trade goodName received…") and players write each other's names in lowercase.
- Replace the free text players typed ("verbal agreement with X: "…"") with `"[message removed]"`.
- Replace the BGA table number with a `sample-N` id: the table page links to the players' profiles.
- Check the result: search both files for each original name, the table number and `@`, then parse the anonymized log
  and compare its statistics and combats with the original's.

The dates, factions, game moves and the `Private:` lines of the player who copied the log stay; they are game
information, not personal data.
