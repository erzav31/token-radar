// Token Launch Radar — entrypoint (Node 22, standard library only).
//
// Reads the sealed snapshot at --input (default /input/snapshot.json),
// writes to $MAKEFUN_OUTPUT_DIR (default /output):
//   board.json            the ranked board (200 rows, watchlist covered)
//   dashboard/            the page (index.html, app.css, app.js, data.js)
//   screenshots/          the three screenshots, copied through
//   dossier.json          buildDossier output, byte for byte what the
//                         scorer recomputes
//
// Deterministic: no clock, no randomness, no network. Two runs write the
// same bytes.

import { cpSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildBoard, recordsNoToken, type Snapshot } from './lib/model.ts';
import { buildDossier } from './vendor/makefun-board.ts';

const ROOT = dirname(fileURLToPath(import.meta.url));

function argValue(flag: string): string | null {
  const i = process.argv.indexOf(flag);
  return i >= 0 && i + 1 < process.argv.length ? process.argv[i + 1]! : null;
}

function main(): void {
  const inputPath = argValue('--input') ?? '/input/snapshot.json';
  const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
  const snap = JSON.parse(readFileSync(inputPath, 'utf8')) as Snapshot;

  const { rows, refs } = buildBoard(snap);
  const watch = new Set(snap.watchlist);

  // ---- gate invariants, checked before anything is written --------------
  if (rows.length < 100 || rows.length > 4000) throw new Error(`board has ${rows.length} rows`);
  for (const slug of snap.watchlist) {
    if (!rows.some((r) => r.slug === slug)) throw new Error(`watchlist slug missing: ${slug}`);
  }
  const seen = new Set<string>();
  rows.forEach((r, i) => {
    if (seen.has(r.slug)) throw new Error(`duplicate slug ${r.slug}`);
    seen.add(r.slug);
    if (i > 0 && r.implied_value_usd > rows[i - 1]!.implied_value_usd)
      throw new Error('implied values rise with rank');
    if (r.farm_steps.length < 3 || r.farm_steps.length > 12) throw new Error(`bad step count ${r.slug}`);
    for (const s of r.farm_steps) {
      const t = s.trim();
      if (t.length < 20 || t.length > 600) throw new Error(`bad step length ${r.slug}: ${t.length}`);
    }
  });
  if (new Set(rows.map((r) => r.implied_value_usd)).size < 2) throw new Error('all implied values equal');

  // ---- board.json --------------------------------------------------------
  const boardRows = rows.map((r, i) => ({
    slug: r.slug,
    name: r.name,
    rank: i + 1,
    implied_value_usd: r.implied_value_usd,
    farm_steps: r.farm_steps,
    category: r.category,
    chains: r.chains,
    tvl_usd: r.tvl_usd,
    change_7d: r.change_7d,
    listed_at: r.listed_at,
    age_days: r.age_days,
    multiple: r.multiple,
    growth_factor: r.growth_factor,
    age_factor: r.age_factor,
    breadth_factor: r.breadth_factor,
    is_watchlist: r.is_watchlist,
  }));
  mkdirSync(outDir, { recursive: true });
  writeFileSync(
    join(outDir, 'board.json'),
    JSON.stringify(
      {
        meta: {
          as_of: snap.as_of,
          source: snap.source,
          floor_usd: snap.floor_usd,
          rows: boardRows.length,
          watchlist_covered: snap.watchlist.length,
          model: 'implied = TVL x category multiple (median mcap/TVL of token-bearing peers, shrunk to global) x growth x age x breadth',
        },
        rows: boardRows,
      },
      null,
      2,
    ) + '\n',
    'utf8',
  );

  // ---- dashboard/ --------------------------------------------------------
  const dashOut = join(outDir, 'dashboard');
  mkdirSync(dashOut, { recursive: true });
  cpSync(join(ROOT, 'dashboard'), dashOut, { recursive: true });
  // Compact data beside the page: rows as arrays, farm steps are rebuilt
  // in the page from the same templates (verified identical at build time).
  const data = {
    asOf: snap.as_of,
    // The snapshot's source string carries its fetch URL; the dashboard
    // names no network address, so the URL is stripped here (board.json
    // keeps the full source string — it is not a dashboard file).
    source: snap.source.replace('https://api.llama.fi/protocols, ', ''),
    floor: snap.floor_usd,
    watchlist: snap.watchlist.length,
    pretoken: snap.protocols.filter(recordsNoToken).length,
    candidates: rows.length,
    rows: rows.map((r) => [
      r.slug,
      r.name,
      r.category,
      r.chains,
      r.tvl_usd,
      r.change_7d,
      r.age_days,
      r.implied_value_usd,
      r.is_watchlist ? 1 : 0,
      r.multiple,
      r.growth_factor,
      r.age_factor,
      r.breadth_factor,
      r.listed_at,
    ]),
    refs: refs.map((f) => [f.slug, f.name, f.category, f.tvl_usd, f.mcap_usd]),
  };
  writeFileSync(join(dashOut, 'data.js'), `window.RADAR_DATA = ${JSON.stringify(data)};\n`, 'utf8');

  // ---- screenshots/ ------------------------------------------------------
  cpSync(join(ROOT, 'screenshots'), join(outDir, 'screenshots'), { recursive: true });

  // ---- dossier.json ------------------------------------------------------
  writeFileSync(join(outDir, 'dossier.json'), buildDossier(outDir, { text_max_bytes: 65536 }));

  const top = rows[0]!;
  console.log(`token-radar: ${rows.length} rows, watchlist ${watch.size}/${watch.size} covered`);
  console.log(`rank 1: ${top.name} (${top.slug}) implied $${top.implied_value_usd.toLocaleString('en-US')}`);
  console.log(`wrote ${outDir}/board.json, dashboard/, screenshots/, dossier.json`);
}

main();
