/* Token Launch Radar — dashboard app.
 * Reads window.RADAR_DATA (written beside this page, no network), renders
 * the sortable/filterable board, the detail view and the reference panel.
 * farmSteps below is the same generator as lib/model.ts in the repository:
 * the same templates, the same strings, verified identical at build time. */
'use strict';

function gasHint(chain) {
  if (chain === 'Ethereum') return '$2–$8';
  if (chain === 'Solana') return 'about $0.01';
  if (chain === 'Base' || chain === 'Arbitrum' || chain === 'Optimism' || chain === 'Polygon' || chain === 'Binance')
    return '$0.05–$0.50';
  return '$0.10–$1';
}

var ACTIONS = {
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

var DEFAULT_ACTIONS = [
  'Use the main feature of {name} on {chain} with $100–$500 and keep the position open for at least 4 weeks. Cost: gas {gas} per transaction.',
  'Try a second feature of {name} — a different pool, vault or market — with $50–$100 after the first week. Cost: gas {gas} per transaction.',
];

function fill(tpl, name, chain, gas) {
  return tpl.split('{name}').join(name).split('{chain}').join(chain).split('{gas}').join(gas);
}

function farmSteps(p) {
  var chain = (p.chains && p.chains[0]) || 'Ethereum';
  var gas = gasHint(chain);
  var pair = ACTIONS[p.category || ''] || DEFAULT_ACTIONS;
  return [
    'Set up a wallet (MetaMask or Phantom) on ' + chain + ' and fund it with gas of ' + gas + ' per transaction; set aside $100–$500 earmarked only for farming ' + p.name + '. One-time setup, about 10 minutes.',
    fill(pair[0], p.name, chain, gas),
    fill(pair[1], p.name, chain, gas),
    'Repeat the core interaction 1–2 times a week for 6–8 weeks (total gas roughly ' + gas + ' per transaction) so your activity reads as consistent use, not a single visit.',
    'Record the date, amount and transaction hash of every ' + p.name + ' interaction in your own notes, and check ' + p.name + '\'s official announcements weekly for snapshots, points or new incentive programs.',
    'If ' + p.name + ' announces a token: claim inside the announced window (usually 30–90 days), check vesting and the claim page on its official site, and do not rush to sell before reading the tokenomics.',
  ];
}

/* ------------------------------------------------------------------ page */

function fmtMoney(n) {
  if (n >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
  if (n >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return '$' + (n / 1e3).toFixed(1) + 'k';
  return '$' + Math.round(n);
}
function fmtChg(c) {
  if (c === null || c === undefined) return '—';
  return (c >= 0 ? '+' : '') + c.toFixed(1) + '%';
}
function fmtAge(days) {
  if (days === null || days === undefined) return '—';
  if (days >= 365) return (days / 365.25).toFixed(1) + 'y';
  return days + 'd';
}
function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

if (typeof document !== 'undefined' && typeof window !== 'undefined' && window.RADAR_DATA) {
  (function init() {
    var D = window.RADAR_DATA;
    var rows = D.rows.map(function (a, i) {
      return { rank: i + 1, slug: a[0], name: a[1], category: a[2], chains: a[3], tvl: a[4], chg: a[5], age: a[6], implied: a[7], wl: a[8] === 1, mult: a[9], growth: a[10], ageF: a[11], breadthF: a[12], listed: a[13] };
    });
    var bySlug = {};
    rows.forEach(function (r) { bySlug[r.slug] = r; });

    document.getElementById('asof').textContent = D.asOf;
    document.getElementById('asof2').textContent = D.asOf;
    document.getElementById('stats').innerHTML =
      '<span class="stat"><b>' + rows.length + '</b> ranked</span>' +
      '<span class="stat"><b>' + D.watchlist + '</b> watchlist</span>' +
      '<span class="stat"><b>' + (D.pretoken || 0) + '</b> record no token</span>' +
      '<span class="stat">snapshot <b>' + esc(D.asOf) + '</b></span>';

    var catSel = document.getElementById('cat');
    var chainSel = document.getElementById('chain');
    var cats = {}, chains = {};
    rows.forEach(function (r) { cats[r.category || 'Uncategorised'] = 1; r.chains.forEach(function (c) { chains[c] = 1; }); });
    Object.keys(cats).sort().forEach(function (c) { catSel.add(new Option(c, c)); });
    Object.keys(chains).sort().forEach(function (c) { chainSel.add(new Option(c, c)); });

    var state = { q: '', cat: '', chain: '', wl: false, sort: 'rank', dir: 1, detail: null };

    function filtered() {
      var q = state.q.trim().toLowerCase();
      var out = rows.filter(function (r) {
        if (state.wl && !r.wl) return false;
        if (state.cat && (r.category || 'Uncategorised') !== state.cat) return false;
        if (state.chain && r.chains.indexOf(state.chain) < 0) return false;
        if (q && (r.name + ' ' + r.slug).toLowerCase().indexOf(q) < 0) return false;
        return true;
      });
      var k = state.sort, d = state.dir;
      var val = function (r) {
        if (k === 'rank') return r.rank;
        if (k === 'name') return r.name.toLowerCase();
        if (k === 'category') return (r.category || '').toLowerCase();
        if (k === 'chains') return (r.chains[0] || '').toLowerCase();
        if (k === 'tvl') return r.tvl;
        if (k === 'chg') return r.chg === null ? -1e18 : r.chg;
        if (k === 'age') return r.age === null ? -1 : r.age;
        if (k === 'implied') return r.implied;
        return r.rank;
      };
      out.sort(function (a, b) {
        var va = val(a), vb = val(b);
        if (va < vb) return -1 * d;
        if (va > vb) return 1 * d;
        return a.rank - b.rank;
      });
      return out;
    }

    function render() {
      var list = filtered();
      var tb = document.getElementById('rows');
      document.getElementById('count').textContent = list.length + ' of ' + rows.length + ' shown';
      document.getElementById('empty').hidden = list.length > 0;
      tb.innerHTML = list.map(function (r) {
        var chgCls = r.chg === null ? '' : (r.chg >= 0 ? 'up' : 'dn');
        return '<tr data-slug="' + esc(r.slug) + '"' + (state.detail === r.slug ? ' class="sel"' : '') + '>' +
          '<td>' + r.rank + '</td>' +
          '<td><span class="nm">' + esc(r.name) + '</span> <span class="sl">' + esc(r.slug) + '</span>' +
          (r.wl ? ' <span class="wlmark" title="On the snapshot watchlist">●</span>' : '') + '</td>' +
          '<td>' + esc(r.category || '—') + '</td>' +
          '<td>' + r.chains.slice(0, 3).map(function (c) { return '<span class="pill">' + esc(c) + '</span>'; }).join('') +
          (r.chains.length > 3 ? '<span class="pill">+' + (r.chains.length - 3) + '</span>' : '') + '</td>' +
          '<td class="num">' + fmtMoney(r.tvl) + '</td>' +
          '<td class="num ' + chgCls + '">' + fmtChg(r.chg) + '</td>' +
          '<td class="num">' + fmtAge(r.age) + '</td>' +
          '<td class="num"><b>' + fmtMoney(r.implied) + '</b></td></tr>';
      }).join('');
      tb.querySelectorAll('tr').forEach(function (tr) {
        tr.addEventListener('click', function () { openDetail(tr.getAttribute('data-slug')); });
      });
      if (state.detail) renderDetail(state.detail);
    }

    function renderDetail(slug) {
      var r = bySlug[slug];
      var box = document.getElementById('detail');
      if (!r) { box.hidden = true; return; }
      var steps = farmSteps(r);
      box.hidden = false;
      box.innerHTML =
        '<h2>' + esc(r.name) + (r.wl ? '<span class="badge">WATCHLIST</span>' : '') +
        '<span class="badge tok">NO TOKEN RECORDED</span></h2>' +
        '<p class="sub">Rank #' + r.rank + ' · ' + esc(r.category || 'Uncategorised') + ' · ' +
        r.chains.map(esc).join(', ') + ' · tracked since ' + (r.listed || 'unknown') + '</p>' +
        '<div class="grid">' +
        '<div class="cell"><div class="k">TVL</div><div class="v">' + fmtMoney(r.tvl) + '</div></div>' +
        '<div class="cell"><div class="k">7-day change</div><div class="v">' + fmtChg(r.chg) + '</div></div>' +
        '<div class="cell"><div class="k">Age</div><div class="v">' + fmtAge(r.age) + '</div></div>' +
        '<div class="cell"><div class="k">Category multiple</div><div class="v">' + r.mult.toFixed(2) + '×</div></div>' +
        '<div class="cell"><div class="k">Implied value</div><div class="v">' + fmtMoney(r.implied) + '</div></div>' +
        '</div>' +
        '<div class="model">implied = ' + fmtMoney(r.tvl) + ' TVL × ' + r.mult.toFixed(3) + ' multiple × ' +
        r.growth.toFixed(3) + ' growth × ' + r.ageF.toFixed(3) + ' age × ' + r.breadthF.toFixed(3) +
        ' breadth = ' + fmtMoney(r.implied) + '</div>' +
        '<h3>How to farm it</h3><ol>' + steps.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ol>' +
        '<p class="fine">Token status: the snapshot records no token for ' + esc(r.name) +
        ' — that is the record, not proof it has none. Farming costs gas only; never pay for a “guaranteed” allocation.</p>';
    }

    function openDetail(slug) {
      state.detail = slug;
      render();
      var box = document.getElementById('detail');
      if (box && !box.hidden) box.scrollIntoView({ block: 'nearest' });
    }

    document.querySelectorAll('#board thead th').forEach(function (th) {
      th.addEventListener('click', function () {
        var k = th.getAttribute('data-k');
        if (state.sort === k) state.dir = -state.dir;
        else { state.sort = k; state.dir = k === 'name' || k === 'category' || k === 'chains' ? 1 : -1; }
        render();
      });
    });
    document.getElementById('q').addEventListener('input', function (e) { state.q = e.target.value; render(); });
    catSel.addEventListener('change', function (e) { state.cat = e.target.value; render(); });
    chainSel.addEventListener('change', function (e) { state.chain = e.target.value; render(); });
    document.getElementById('wl').addEventListener('change', function (e) { state.wl = e.target.checked; render(); });

    var refs = D.refs || [];
    document.getElementById('refrows').innerHTML = refs.map(function (f) {
      return '<tr><td><span class="nm">' + esc(f[1]) + '</span> <span class="sl">' + esc(f[0]) + '</span></td>' +
        '<td>' + esc(f[2] || '—') + '</td><td class="num">' + fmtMoney(f[3]) + '</td>' +
        '<td class="num">' + fmtMoney(f[4]) + '</td><td class="num">' + (f[4] / f[3]).toFixed(2) + '×</td></tr>';
    }).join('');

    // Deep links for screenshots and sharing: #detail=<slug>, #cat=Dexs,
    // #chain=Base, #wl=1, #q=text
    var h = (location.hash || '').replace(/^#/, '');
    if (h) {
      h.split('&').forEach(function (kv) {
        var p = kv.split('='), k = p[0], v = decodeURIComponent(p[1] || '');
        if (k === 'detail' && bySlug[v]) state.detail = v;
        if (k === 'cat') { state.cat = v; catSel.value = v; }
        if (k === 'chain') { state.chain = v; chainSel.value = v; }
        if (k === 'wl' && v === '1') { state.wl = true; document.getElementById('wl').checked = true; }
        if (k === 'q') { state.q = v; document.getElementById('q').value = v; }
      });
    }
    render();
  })();
}
