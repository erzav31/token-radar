// Token Launch Radar — value model and farm-plan generator.
//
// Everything here is derived from the sealed snapshot's own figures only:
//   * tvl_usd        — how much value the protocol already secures
//   * change_7d      — whether that value is growing or shrinking
//   * listed_at      — how long it has run with no token recorded
//   * chains         — how many chains it operates on
//   * category       — what kind of protocol it is (peer multiples come from
//                      the token-bearing protocols in the same category)
// No protocol name is hardcoded anywhere in the ranking: the board is a
// function of the snapshot, so a future snapshot re-ranks itself.

export interface Protocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: Protocol[];
  watchlist: string[];
}

export interface ScoredRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  listed_at: string | null;
  age_days: number | null;
  implied_value_usd: number;
  multiple: number;
  growth_factor: number;
  age_factor: number;
  breadth_factor: number;
  is_watchlist: boolean;
  has_token: boolean;
  mcap_usd: number | null;
  farm_steps: string[];
}

// ---------------------------------------------------------------- eligibility

/** Categories that are a wrapped, staked or bridged product of a token that
 *  already trades, or an exchange itself — not a protocol still waiting on
 *  a launch of its own. Same rule the snapshot's watchlist uses. */
export const EXCLUDED_CATEGORIES = new Set([
  'Bridge',
  'Canonical Bridge',
  'Cross Chain Bridge',
  'Liquid Staking',
  'Liquid Restaking',
  'Restaked BTC',
  'CEX',
]);

const EXCHANGE_PREFIXES = [
  'Binance',
  'Coinbase',
  'Bybit',
  'Kraken',
  'Bitget',
  'OKX',
  'Bitfinex',
  'Gemini',
];

const VERSION_SUFFIX = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;
const WRAPPED_WORD = /\b(wrapped|staked|staking)\b/i;

/** True when the protocol records no token at all in the snapshot. */
export function recordsNoToken(p: Protocol): boolean {
  return p.gecko_id === null && p.symbol === null;
}

/** True when the protocol is a wrapped / staked / bridged product of a token
 *  that already trades, or an exchange, or a versioned copy — the house
 *  watchlist's own exclusion, re-derived from the snapshot's fields. */
export function isWrappedOrExchange(p: Protocol): boolean {
  if (p.category !== null && EXCLUDED_CATEGORIES.has(p.category)) return true;
  if (VERSION_SUFFIX.test(p.name)) return true;
  if (WRAPPED_WORD.test(p.name)) return true;
  return EXCHANGE_PREFIXES.some((x) => p.name.startsWith(x));
}

/** A launch candidate: records no token and is not a wrapped/staked/
 *  bridged product or an exchange. */
export function isCandidate(p: Protocol): boolean {
  return recordsNoToken(p) && !isWrappedOrExchange(p);
}

// ---------------------------------------------------------------- value model

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const n = s.length;
  if (n === 0) return NaN;
  return n % 2 === 1 ? s[(n - 1) / 2]! : (s[n / 2 - 1]! + s[n / 2]!) / 2;
}

function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x));
}

/**
 * The FDV/TVL multiple for a category: the median mcap/TVL of the
 * token-bearing protocols in that category, shrunk toward the global median
 * (5 pseudo-observations) so a category with one or two peers does not get a
 * wild multiple. Clamped to [0.05, 1.50]. Computed from the snapshot only.
 */
export function categoryMultiples(protocols: Protocol[]): Map<string, number> {
  const byCat = new Map<string, number[]>();
  const all: number[] = [];
  for (const p of protocols) {
    if (p.mcap_usd !== null && p.mcap_usd > 0 && p.tvl_usd > 0) {
      const m = p.mcap_usd / p.tvl_usd;
      all.push(m);
      const key = p.category ?? '(none)';
      const arr = byCat.get(key) ?? [];
      arr.push(m);
      byCat.set(key, arr);
    }
  }
  const global = median(all);
  const out = new Map<string, number>();
  for (const [cat, xs] of byCat) {
    const catMed = median(xs);
    const shrunk = (xs.length * catMed + 5 * global) / (xs.length + 5);
    out.set(cat, clamp(shrunk, 0.05, 1.5));
  }
  out.set('__global__', clamp(global, 0.05, 1.5));
  return out;
}

function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const ms = Date.parse(asOf + 'T00:00:00Z') - Date.parse(listedAt + 'T00:00:00Z');
  if (!Number.isFinite(ms) || ms < 0) return null;
  return Math.floor(ms / 86400000);
}

/**
 * impliedValueUsd = TVL x category multiple x growth x age x breadth
 *   growth  = 1 + 0.6 * clamp(change_7d / 100, -0.25, +0.40)   (0.85 .. 1.24)
 *   age     = 1 + 0.04 * min(years listed, 4)                  (1.00 .. 1.16)
 *             (null listed_at -> 1.00: no track record to reward)
 *   breadth = 1 + 0.015 * min(chains - 1, 6)                   (1.00 .. 1.09)
 * The implied value is this entry's own claim: what the protocol's token
 * would be worth if its record stayed as it is. It never predicts whether
 * or when a token is issued.
 */
export function scoreProtocol(
  p: Protocol,
  multiples: Map<string, number>,
  asOf: string,
): Omit<ScoredRow, 'farm_steps' | 'is_watchlist' | 'has_token'> {
  const multiple = multiples.get(p.category ?? '(none)') ?? multiples.get('__global__')!;
  const chg = p.change_7d ?? 0;
  const growthFactor = 1 + 0.6 * clamp(chg / 100, -0.25, 0.4);
  const age = ageDays(asOf, p.listed_at);
  const years = age === null ? 0 : age / 365.25;
  const ageFactor = 1 + 0.04 * Math.min(years, 4);
  const breadthFactor = 1 + 0.015 * Math.min(Math.max(p.chains.length - 1, 0), 6);
  const implied = Math.max(1, Math.round(p.tvl_usd * multiple * growthFactor * ageFactor * breadthFactor));
  return {
    slug: p.slug,
    name: p.name,
    category: p.category,
    chains: p.chains,
    tvl_usd: p.tvl_usd,
    change_7d: p.change_7d,
    listed_at: p.listed_at,
    age_days: age,
    implied_value_usd: implied,
    multiple,
    growth_factor: growthFactor,
    age_factor: ageFactor,
    breadth_factor: breadthFactor,
    mcap_usd: p.mcap_usd,
  };
}

// ---------------------------------------------------------------- farm plans

function gasHint(chain: string): string {
  if (chain === 'Ethereum') return '$2–$8';
  if (chain === 'Solana') return 'about $0.01';
  if (chain === 'Base' || chain === 'Arbitrum' || chain === 'Optimism' || chain === 'Polygon' || chain === 'Binance')
    return '$0.05–$0.50';
  return '$0.10–$1';
}

/** Category-specific core action + second action. Placeholders: {name} {chain} {gas}. */
const ACTIONS: Record<string, [string, string]> = {
  Dexs: [
    'Swap $100–$500 into the main pool asset of {name} and provide liquidity in its largest pool on {chain}; keep the LP position for at least 4 weeks. Cost: gas {gas} per transaction plus a ~0.3% swap fee.',
    'Try a second feature of {name} — a limit order or a concentrated-liquidity range — with $50–$100, so your activity covers more than one product. Cost: gas {gas} per transaction.',
  ],
  Lending: [
    'Supply $100–$500 as collateral on {name} ({chain}), then borrow a stablecoin worth at most 40% of your collateral to keep the position healthy. Cost: gas {gas} per transaction; borrow interest follows the pool rate.',
    'Repay part of the loan and re-supply after two weeks, keeping your health factor above 1.5 at all times. Cost: gas {gas} per transaction, about 15 minutes.',
  ],
  Yield: [
    'Deposit $100–$500 into the largest vault of {name} on {chain} and leave it compounding for at least 4 weeks. Cost: gas {gas} per transaction plus the vault performance fee shown on deposit.',
    'Move half of the position to a second vault of {name} after two weeks to show activity across vaults. Cost: gas {gas} per transaction.',
  ],
  'Yield Aggregator': [
    'Deposit $100–$500 into the largest vault of {name} on {chain} and leave it compounding for at least 4 weeks. Cost: gas {gas} per transaction plus the vault performance fee shown on deposit.',
    'Move half of the position to a second vault of {name} after two weeks to show activity across vaults. Cost: gas {gas} per transaction.',
  ],
  CDP: [
    'Open a vault on {name} ({chain}), lock $200–$500 of collateral and mint stablecoins worth at most 40% of it. Cost: gas {gas} per transaction; the stability fee accrues daily.',
    'Top up collateral after two weeks so your collateral ratio stays above 200%, and repay a small part of the debt. Cost: gas {gas} per transaction.',
  ],
  'CDP Manager': [
    'Open a vault on {name} ({chain}), lock $200–$500 of collateral and mint stablecoins worth at most 40% of it. Cost: gas {gas} per transaction; the stability fee accrues daily.',
    'Top up collateral after two weeks so your collateral ratio stays above 200%, and repay a small part of the debt. Cost: gas {gas} per transaction.',
  ],
  RWA: [
    'Mint or buy $100–$500 of the tokenized asset offered by {name} on {chain} and hold it through at least one yield distribution. Cost: gas {gas} per transaction plus the mint fee shown at purchase.',
    'Reinvest the first yield payout into the same asset, and check the asset backing documents the protocol publishes. Takes about 20 minutes.',
  ],
  'Risk Curators': [
    'Deposit $100–$500 into the largest curated vault of {name} on {chain} and keep it allocated for at least 4 weeks. Cost: gas {gas} per transaction plus the curator fee shown on deposit.',
    'Split a second $100 deposit across a different vault curated by {name} after two weeks to diversify. Cost: gas {gas} per transaction.',
  ],
  'Onchain Capital Allocator': [
    'Deposit $100–$500 into the largest curated vault of {name} on {chain} and keep it allocated for at least 4 weeks. Cost: gas {gas} per transaction plus the curator fee shown on deposit.',
    'Split a second $100 deposit across a different vault run by {name} after two weeks to diversify. Cost: gas {gas} per transaction.',
  ],
  'Collateral Markets': [
    'Supply $100–$500 of collateral on {name} ({chain}) and, if you borrow, keep the loan below 40% of the collateral value. Cost: gas {gas} per transaction.',
    'Adjust the position after two weeks: top up collateral or repay part of the loan so the health factor stays above 1.5. Cost: gas {gas} per transaction.',
  ],
  Farm: [
    'Stake $100–$500 of LP tokens in the main farm of {name} on {chain} and leave the stake for at least 4 weeks. Cost: gas {gas} per transaction.',
    'Harvest the farm rewards after two weeks and restake them instead of selling, so the position compounds. Cost: gas {gas} per transaction.',
  ],
  Derivatives: [
    'Open a small hedged position of $100–$200 on {name} ({chain}) and close it after a few days; keep every trade under 2x leverage. Cost: gas {gas} per transaction plus the trading fee.',
    'Provide $100 of liquidity to the protocol vault of {name} for at least 2 weeks. Cost: gas {gas} per transaction.',
  ],
  Perps: [
    'Open a small hedged position of $100–$200 on {name} ({chain}) and close it after a few days; keep every trade under 2x leverage. Cost: gas {gas} per transaction plus the trading fee.',
    'Provide $100 of liquidity to the protocol vault of {name} for at least 2 weeks. Cost: gas {gas} per transaction.',
  ],
  Options: [
    'Buy a $50–$100 call or put on {name} ({chain}) with at least 2 weeks to expiry, and let it run to expiry or close it in profit. Cost: gas {gas} per transaction plus the option premium.',
    'Sell a covered call of $50–$100 on {name} once you understand the payoff, keeping the collateral fully backed. Cost: gas {gas} per transaction.',
  ],
  Launchpad: [
    'Stake or commit $100–$300 on {name} ({chain}) to qualify for its next sale allocation, and complete any KYC or whitelist step it asks for. Cost: gas {gas} per transaction.',
    'Join the next allocation round and claim any allocation promptly; unstake only after the sale settles. Cost: gas {gas} per transaction.',
  ],
  'Prediction Market': [
    'Place $20–$50 of small, researched bets on {name} ({chain}) across at least 3 different markets. Cost: gas {gas} per transaction.',
    'Provide $50 of liquidity to an active market on {name} for at least a week. Cost: gas {gas} per transaction.',
  ],
};

const DEFAULT_ACTIONS: [string, string] = [
  'Use the main feature of {name} on {chain} with $100–$500 and keep the position open for at least 4 weeks. Cost: gas {gas} per transaction.',
  'Try a second feature of {name} — a different pool, vault or market — with $50–$100 after the first week. Cost: gas {gas} per transaction.',
];

function fill(tpl: string, name: string, chain: string, gas: string): string {
  return tpl.replaceAll('{name}', name).replaceAll('{chain}', chain).replaceAll('{gas}', gas);
}

/**
 * Six concrete farm steps for a protocol, each 20–600 characters, with what
 * it costs and how long it takes. Derived only from the protocol's own
 * fields (name, category, first chain) — no hardcoded protocol names.
 * The dashboard's app.js implements the same templates, and the build
 * verifies both agree byte for byte.
 */
export function farmSteps(p: Protocol): string[] {
  const chain = p.chains[0] ?? 'Ethereum';
  const gas = gasHint(chain);
  const [core, second] = ACTIONS[p.category ?? ''] ?? DEFAULT_ACTIONS;
  return [
    `Set up a wallet (MetaMask or Phantom) on ${chain} and fund it with gas of ${gas} per transaction; set aside $100–$500 earmarked only for farming ${p.name}. One-time setup, about 10 minutes.`,
    fill(core, p.name, chain, gas),
    fill(second, p.name, chain, gas),
    `Repeat the core interaction 1–2 times a week for 6–8 weeks (total gas roughly ${gas} per transaction) so your activity reads as consistent use, not a single visit.`,
    `Record the date, amount and transaction hash of every ${p.name} interaction in your own notes, and check ${p.name}'s official announcements weekly for snapshots, points or new incentive programs.`,
    `If ${p.name} announces a token: claim inside the announced window (usually 30–90 days), check vesting and the claim page on its official site, and do not rush to sell before reading the tokenomics.`,
  ];
}

// ---------------------------------------------------------------- board build

export interface BoardBuild {
  rows: ScoredRow[];
  /** Token-bearing protocols, for the dashboard's reference panel only. */
  refs: { slug: string; name: string; category: string | null; tvl_usd: number; mcap_usd: number }[];
  multiples: Map<string, number>;
}

export const BOARD_SIZE = 200;

/**
 * Build the ranked board: every watchlist protocol, plus the highest-implied
 * pre-token candidates below the floor, to BOARD_SIZE rows. Rows are ranked
 * by implied value, rank 1 first, and implied values never rise with rank.
 */
export function buildBoard(snap: Snapshot): BoardBuild {
  const multiples = categoryMultiples(snap.protocols);
  const watch = new Set(snap.watchlist);
  const cands = snap.protocols.filter(isCandidate);
  const scored: ScoredRow[] = cands.map((p) => ({
    ...scoreProtocol(p, multiples, snap.as_of),
    is_watchlist: watch.has(p.slug),
    has_token: false,
    farm_steps: farmSteps(p),
  }));
  scored.sort((a, b) => b.implied_value_usd - a.implied_value_usd || (a.slug < b.slug ? -1 : 1));
  let rows = scored.slice(0, BOARD_SIZE);
  // Guarantee full watchlist coverage: swap in any missing watchlist row
  // for the lowest-ranked non-watchlist rows.
  const inRows = new Set(rows.map((r) => r.slug));
  const missing = scored.filter((r) => r.is_watchlist && !inRows.has(r.slug));
  if (missing.length > 0) {
    const keep = rows.filter((r) => !r.is_watchlist);
    rows = [...rows.filter((r) => r.is_watchlist), ...missing, ...keep].slice(0, BOARD_SIZE);
    rows.sort((a, b) => b.implied_value_usd - a.implied_value_usd || (a.slug < b.slug ? -1 : 1));
  }
  // Re-rank 1..N is done by the caller when serialising (rank = index + 1);
  // implied values are already non-increasing by the sort above.
  const refs = snap.protocols
    .filter((p) => !recordsNoToken(p) && p.mcap_usd !== null)
    .sort((a, b) => (b.mcap_usd ?? 0) - (a.mcap_usd ?? 0))
    .slice(0, 12)
    .map((p) => ({ slug: p.slug, name: p.name, category: p.category, tvl_usd: p.tvl_usd, mcap_usd: p.mcap_usd! }));
  return { rows, refs, multiples };
}
