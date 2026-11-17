# Token Launch Radar

Which pre-token protocol is worth farming next — and what to do about it.

Built for the make.fun competition `token-radar-01` (deadline 2026-12-14T10:00:00Z).
Entry fee: **$0.00** (verified live from the competition API: `entryFeeUsd: null`,
`entryFeesUsd: "0.00"`).

## What it does

`main.ts` (Node 22, standard library only) reads the sealed DefiLlama snapshot
at `/input/snapshot.json` and writes to `/output`:

- `board.json` — 197 ranked protocols, every one of the snapshot's 40 watchlist
  protocols covered, each with an implied value and a 6-step farm plan.
- `dashboard/` — a static page (no network) with the sortable/filterable board,
  a detail view for every protocol, and a reference panel of protocols whose
  token already trades.
- `screenshots/` — the board, a detail view, and a filtered view.
- `dossier.json` — built with `buildDossier` from `vendor/makefun-board.ts`.

## The value model

```
implied = TVL × category multiple × growth × age × breadth
```

- **Category multiple**: the median market-cap/TVL of the token-bearing
  protocols in the same category, shrunk toward the global median (5
  pseudo-observations) so thin categories stay honest. Computed from the
  snapshot only, clamped to [0.05, 1.50].
- **Growth**: `1 + 0.6 × clamp(change_7d / 100, −0.25, +0.40)`.
- **Age**: `1 + 0.04 × min(years listed, 4)` — longer running with no token
  recorded earns a small premium; unknown listing date earns none.
- **Breadth**: `1 + 0.015 × min(chains − 1, 6)`.

No protocol name is hardcoded in the ranking: the board is a function of the
snapshot, so a future snapshot re-ranks itself. Candidates are protocols that
record no token and are not a wrapped, staked or bridged product of a token
that already trades, nor an exchange (the snapshot watchlist's own rule,
re-derived from its fields). That leaves 197 candidates out of 758 protocols;
342 record no token in total.

The implied value is this entry's own claim about what a launch would be
worth if the protocol's record stayed as it is. It never predicts whether or
when a token is issued, and "records no token" is the snapshot's record, not
proof the protocol has none.

## Farm plans

Six concrete steps per protocol (costs and durations included), generated from
the protocol's own category and primary chain. The generator lives in
`lib/model.ts` and is mirrored in `dashboard/app.js`; the build verifies both
produce identical steps for every row.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input <path-to>/snapshot.json
```

Two runs write byte-identical output (no clock, no randomness, no network).

## Layout

```
main.ts                  entrypoint
lib/model.ts             value model + farm-plan generator
vendor/makefun-board.ts  make.fun dossier library (kit copy, byte for byte)
dashboard/               index.html, app.css, app.js (data.js written by main.ts)
screenshots/              1-board.png, 2-detail.png, 3-filtered.png
LICENSE                  MIT
```

## make.fun

[![make.fun](https://img.shields.io/badge/make.fun-bounty-ff0080)](https://make.fun/bounty/token-radar-01) [![Bounty: token-radar-01](https://img.shields.io/badge/bounty-token--radar--01-ff0080)](https://make.fun/bounty/token-radar-01) [![Token Launch Radar](https://img.shields.io/badge/Token%20Launch%20Radar-make.fun-ff0080)](https://make.fun/bounty/token-radar-01)

Built for the make.fun bounty [Build the best token launch radar](https://make.fun/bounty/token-radar-01).
