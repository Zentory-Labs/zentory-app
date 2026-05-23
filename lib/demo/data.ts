// Deterministic sample-data generators for DemoMode. All data is computed
// from a stable seed so the demo looks identical across reloads + tabs +
// machines — investors get a consistent walk-through. Nothing here ever
// touches on-chain state; it's purely UI fiction with proper SAMPLE labels.

// ─── Seeded RNG (mulberry32) ─────────────────────────────────────────────────
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(arr: readonly T[], r: () => number): T {
  return arr[Math.floor(r() * arr.length)];
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

// Anchor "now" to the start of the current hour so the demo looks live
// without re-rendering every second.
function anchorNow(): number {
  const now = new Date();
  now.setMinutes(0, 0, 0);
  return now.getTime();
}

// ─── Providers (quant teams) ─────────────────────────────────────────────────

export interface DemoProvider {
  id: string;
  address: string;
  name: string;
  tagline: string;
  joinedDaysAgo: number;
  // accuracy in basis points (10000 = 100%)
  accuracyBps: number;
  signalsSubmitted: number;
  signalsResolved: number;
  conviction: number;          // total ZENT staked (units, not raw)
  zentEarned: number;          // realized ZENT payouts
  rank: number;                // 1 = top
  assetClasses: string[];      // ["CRYPTO_PERP", "CRYPTO_SPOT", ...]
  grade: "S" | "A" | "B" | "C";
}

const PROVIDER_NAMES = [
  ["Genesis Pulse", "Cross-venue funding-rate arb", ["CRYPTO_PERP", "CRYPTO_SPOT"]],
  ["Aether Quant", "Mean-reversion on majors", ["CRYPTO_PERP"]],
  ["Lumibot Labs", "ML basis-spread detection", ["CRYPTO_PERP", "EQUITY"]],
  ["Orion Sigma", "Liquidation-zone bounces", ["CRYPTO_PERP"]],
  ["Helix Capital", "Multi-venue triangulation", ["CRYPTO_SPOT", "CRYPTO_PERP"]],
  ["Veil Strategies", "Volatility regime-switching", ["CRYPTO_PERP", "FOREX"]],
  ["Solace Alpha", "Order-flow imbalance", ["CRYPTO_PERP"]],
  ["Kinetic Edge", "Cross-asset macro signals", ["EQUITY", "FOREX", "COMMODITY"]],
  ["Quantum Trail", "Term-structure carry", ["CRYPTO_PERP", "FOREX"]],
  ["Nimbus Research", "Stat-arb on L1 perps", ["CRYPTO_PERP"]],
] as const;

export function demoProviders(): DemoProvider[] {
  const r = rng(42);
  return PROVIDER_NAMES.map(([name, tagline, assetClasses], i) => {
    // Top providers have ~75% accuracy, tail providers ~52%.
    const accuracyBps = Math.round(7500 - i * 250 + r() * 300);
    const signalsSubmitted = Math.round(120 - i * 8 + r() * 40);
    const signalsResolved = Math.round(signalsSubmitted * (0.85 + r() * 0.1));
    const conviction = Math.round(50000 - i * 3500 + r() * 5000);
    const zentEarned = Math.round(conviction * (accuracyBps / 10000) * 0.4 + r() * 1000);
    const grade = i < 2 ? "S" : i < 5 ? "A" : i < 8 ? "B" : "C";
    return {
      id: `gp-${i + 1}`,
      // Synthetic but valid-looking addresses (not real wallets).
      address: `0x${(0xa1c000 + i * 1771).toString(16).padStart(6, "0")}${"d3adbeef".repeat(4).slice(0, 32)}`,
      name,
      tagline,
      joinedDaysAgo: Math.round(60 + i * 18 + r() * 14),
      accuracyBps,
      signalsSubmitted,
      signalsResolved,
      conviction,
      zentEarned,
      rank: i + 1,
      assetClasses: assetClasses as unknown as string[],
      grade: grade as DemoProvider["grade"],
    };
  });
}

// ─── Signals feed ────────────────────────────────────────────────────────────

export interface DemoSignal {
  id: string;
  providerId: string;
  providerName: string;
  assetClass: "CRYPTO_PERP" | "CRYPTO_SPOT" | "EQUITY" | "FOREX" | "COMMODITY";
  market: string;
  direction: "BUY" | "SELL" | "STRONG BUY" | "STRONG SELL" | "NEUTRAL";
  confidence: number;          // 0-10000 bps
  conviction: number;          // ZENT staked on this signal
  submittedAt: number;         // ms epoch
  expiresAt: number;
  // pending = within active epoch; scored = resolved
  status: "pending" | "scored";
  accuracyBps?: number;        // present only when scored
  payoutZent?: number;
  signedDigest: string;        // synthetic EIP-712 digest
}

const MARKETS: Array<{ market: string; assetClass: DemoSignal["assetClass"] }> = [
  { market: "BTC-PERP", assetClass: "CRYPTO_PERP" },
  { market: "ETH-PERP", assetClass: "CRYPTO_PERP" },
  { market: "SOL-PERP", assetClass: "CRYPTO_PERP" },
  { market: "XRP-PERP", assetClass: "CRYPTO_PERP" },
  { market: "BTC/USD", assetClass: "CRYPTO_SPOT" },
  { market: "AAPL", assetClass: "EQUITY" },
  { market: "MSFT", assetClass: "EQUITY" },
  { market: "EUR/USD", assetClass: "FOREX" },
  { market: "XAU/USD", assetClass: "COMMODITY" },
];

const DIRECTIONS: DemoSignal["direction"][] = [
  "STRONG BUY", "BUY", "BUY", "NEUTRAL", "SELL", "SELL", "STRONG SELL",
];

export function demoSignals(count = 36): DemoSignal[] {
  const r = rng(1337);
  const now = anchorNow();
  const providers = demoProviders();
  const signals: DemoSignal[] = [];
  for (let i = 0; i < count; i++) {
    const provider = pick(providers, r);
    const market = pick(MARKETS, r);
    // Newer signals at index 0; spread across last 24h.
    const submittedAt = now - i * (60 * 60 * 1000) / 1.5 - Math.floor(r() * 15 * 60 * 1000);
    const expiresAt = submittedAt + (1 + Math.floor(r() * 7)) * 60 * 60 * 1000;
    const isPast = submittedAt + 60 * 60 * 1000 < now;
    const isResolved = isPast && r() > 0.25;
    const direction = pick(DIRECTIONS, r);
    const confidence = Math.round(4500 + r() * 4500);
    const conviction = Math.round(200 + r() * 9800);
    signals.push({
      id: `0x${(0xdead + i).toString(16).padStart(4, "0")}${"a".repeat(60)}`,
      providerId: provider.id,
      providerName: provider.name,
      assetClass: market.assetClass,
      market: market.market,
      direction,
      confidence,
      conviction,
      submittedAt,
      expiresAt,
      status: isResolved ? "scored" : "pending",
      accuracyBps: isResolved ? Math.round(5500 + r() * 3500) : undefined,
      payoutZent: isResolved ? Math.round(conviction * (0.05 + r() * 0.2)) : undefined,
      signedDigest: `0x${"f".repeat(8)}${(i * 17 + 9).toString(16).padStart(56, "0")}`,
    });
  }
  return signals.sort((a, b) => b.submittedAt - a.submittedAt);
}

// ─── Vault NAV history ──────────────────────────────────────────────────────

export interface DemoNavPoint {
  ts: number;                  // ms epoch
  nav: number;                 // NAV per share (asset units, 1.0 = baseline)
  hodl: number;                // HODL baseline for the underlying
  alphaPct: number;            // (nav - hodl) / hodl * 100
}

const VAULT_DRIFT: Record<string, { dailyDrift: number; vol: number }> = {
  zBTC: { dailyDrift: 0.0018, vol: 0.0009 },
  zETH: { dailyDrift: 0.0015, vol: 0.0011 },
  zSOL: { dailyDrift: 0.0021, vol: 0.0014 },
  zXRP: { dailyDrift: 0.0011, vol: 0.0008 },
};

export function demoNavHistory(vaultSymbol: string, days = 30): DemoNavPoint[] {
  const cfg = VAULT_DRIFT[vaultSymbol] ?? VAULT_DRIFT.zBTC;
  const r = rng(0xa11ce + vaultSymbol.charCodeAt(2) * 7);
  const hours = days * 24;
  const start = anchorNow() - hours * 60 * 60 * 1000;
  const out: DemoNavPoint[] = [];
  let nav = 1.0;
  let hodl = 1.0;
  for (let h = 0; h <= hours; h++) {
    // Hour-scale drift; nav outpaces hodl by the drift premium.
    const navNoise = (r() - 0.5) * cfg.vol;
    const hodlNoise = (r() - 0.5) * cfg.vol * 0.6;
    nav = nav * (1 + cfg.dailyDrift / 24 + navNoise);
    hodl = hodl * (1 + (cfg.dailyDrift / 24) * 0.45 + hodlNoise);
    const alphaPct = ((nav - hodl) / hodl) * 100;
    out.push({ ts: start + h * 60 * 60 * 1000, nav, hodl, alphaPct });
  }
  return out;
}

// ─── Deposit / withdrawal flow (daily) ───────────────────────────────────────

export interface DemoFlowDay {
  date: string;                // YYYY-MM-DD
  deposits: number;            // asset units
  withdrawals: number;
  netFlow: number;
  txCount: number;
}

export function demoFlow(vaultSymbol: string, days = 14): DemoFlowDay[] {
  const r = rng(0xb33f + vaultSymbol.charCodeAt(2) * 11);
  const out: DemoFlowDay[] = [];
  const dayMs = 24 * 60 * 60 * 1000;
  const start = anchorNow() - days * dayMs;
  for (let d = 0; d < days; d++) {
    const ts = start + d * dayMs;
    const deposits = Math.round((5 + r() * 25) * 100) / 100;
    const withdrawals = Math.round((2 + r() * 12) * 100) / 100;
    out.push({
      date: new Date(ts).toISOString().slice(0, 10),
      deposits,
      withdrawals,
      netFlow: Math.round((deposits - withdrawals) * 100) / 100,
      txCount: Math.floor(8 + r() * 20),
    });
  }
  return out;
}

// ─── Aggregate protocol stats ────────────────────────────────────────────────

export interface DemoProtocolStats {
  vaults: Array<{
    symbol: string;
    navPerShare: number;
    totalAssets: number;
    hodlNav: number;
    alphaPct: number;
    cumulativeAlpha: number;
    avgAlpha: number;
    avgWinRate: number;
    totalDeposits: number;
    totalWithdrawals: number;
    netFlow: number;
  }>;
  totalTvl: number;
  totalDeposits: number;
  totalWithdrawals: number;
  avgAlpha: number;
  avgWinRate: number;
}

export function demoProtocolStats(): DemoProtocolStats {
  const symbols = ["zBTC", "zETH", "zSOL", "zXRP"] as const;
  const r = rng(0xcafe);
  // USD-equivalent ranges per vault so the dashboard's `value / 1e6` formatter
  // produces credible $XX.XX M cards. zBTC + zETH carry more TVL; zSOL/zXRP
  // are the smaller pools per the whitepaper's prioritization.
  const TVL_RANGES: Record<string, [number, number]> = {
    zBTC: [18_000_000, 38_000_000],
    zETH: [14_000_000, 32_000_000],
    zSOL: [4_000_000, 12_000_000],
    zXRP: [3_000_000, 9_000_000],
  };
  const vaults = symbols.map((sym) => {
    const nav = demoNavHistory(sym, 30);
    const last = nav[nav.length - 1];
    const cumulativeAlpha = last.alphaPct;
    const [lo, hi] = TVL_RANGES[sym];
    const totalAssets = Math.round((lo + r() * (hi - lo)) * 100) / 100;
    // Lifetime flows ~3x current TVL.
    const totalDeposits = Math.round(totalAssets * (2.5 + r()) * 100) / 100;
    const totalWithdrawals = Math.round(totalDeposits * (0.4 + r() * 0.25) * 100) / 100;
    return {
      symbol: sym,
      navPerShare: last.nav,
      totalAssets,
      hodlNav: last.hodl,
      alphaPct: last.alphaPct,
      cumulativeAlpha,
      avgAlpha: last.alphaPct,
      avgWinRate: 55 + r() * 25,
      totalDeposits,
      totalWithdrawals,
      netFlow: totalDeposits - totalWithdrawals,
    };
  });
  const totalTvl = vaults.reduce((s, v) => s + v.totalAssets, 0);
  const totalDeposits = vaults.reduce((s, v) => s + v.totalDeposits, 0);
  const totalWithdrawals = vaults.reduce((s, v) => s + v.totalWithdrawals, 0);
  const avgAlpha = vaults.reduce((s, v) => s + v.alphaPct, 0) / vaults.length;
  const avgWinRate = vaults.reduce((s, v) => s + v.avgWinRate, 0) / vaults.length;
  return { vaults, totalTvl, totalDeposits, totalWithdrawals, avgAlpha, avgWinRate };
}

// ─── Research feed ───────────────────────────────────────────────────────────

export interface DemoResearchItem {
  id: string;
  providerId: string;
  providerName: string;
  publishedAt: number;
  asset: string;
  direction: "LONG" | "SHORT" | "NEUTRAL";
  thesis: string;
  confidenceBps: number;
  status: "live" | "executed" | "expired";
  pnlPct?: number;
  txHash?: string;
}

const RESEARCH_THESES = [
  "Persistent funding-rate inversion across Binance/Hyperliquid suggests a 4-8h mean-reversion window in BTC perps.",
  "ETH perp basis is 220 bps wide of fair value following ETF flow uncertainty — directional carry trade.",
  "SOL 1h imbalance signal: liquidations cluster $4 below current spot; expected bounce if volume holds.",
  "XRP/USD perp shows persistent ask-side imbalance across 3 venues — anticipating retest of resistance.",
  "Apple options skew widened pre-earnings; equity-vault watch list flag.",
  "EUR/USD basis trade: 1w forward is rich vs. spot+CIP-implied rate, narrow carry available.",
  "Gold-vs-DXY correlation broke down this week; commodity-vault standby until regime confirms.",
  "BTC term structure inverted at 14-day tenor — short futures vs. long spot carry play.",
] as const;

export function demoResearch(count = 8): DemoResearchItem[] {
  const r = rng(0xface);
  const providers = demoProviders();
  const now = anchorNow();
  return Array.from({ length: count }, (_, i) => {
    const provider = pick(providers, r);
    const publishedAt = now - i * (4 * 60 * 60 * 1000) - Math.floor(r() * 30 * 60 * 1000);
    const dir = pick<DemoResearchItem["direction"]>(["LONG", "SHORT", "NEUTRAL"], r);
    const status: DemoResearchItem["status"] = i < 2 ? "live" : i < 6 ? "executed" : "expired";
    const pnlPct = status === "executed" ? Math.round((r() - 0.35) * 600) / 100 : undefined;
    return {
      id: `r-${i + 1}`,
      providerId: provider.id,
      providerName: provider.name,
      publishedAt,
      asset: pick(["BTC", "ETH", "SOL", "XRP", "AAPL"], r),
      direction: dir,
      thesis: RESEARCH_THESES[i % RESEARCH_THESES.length],
      confidenceBps: Math.round(5500 + r() * 3500),
      status,
      pnlPct,
      txHash: status === "executed" ? `0x${"c0ffee".repeat(10).slice(0, 64)}` : undefined,
    };
  });
}

// ─── Governance proposals ────────────────────────────────────────────────────

export interface DemoProposal {
  id: number;
  title: string;
  proposer: string;
  status: "active" | "succeeded" | "defeated" | "executed" | "queued";
  forVotes: number;            // veZENT in units
  againstVotes: number;
  abstainVotes: number;
  endsAt: number;              // ms epoch
  summary: string;
}

export function demoProposals(): DemoProposal[] {
  const now = anchorNow();
  return [
    {
      id: 3,
      title: "Raise zSOL maxLeverage to 4x",
      proposer: "GenesisPulse.eth",
      status: "active",
      forVotes: 12_400_000,
      againstVotes: 3_200_000,
      abstainVotes: 850_000,
      endsAt: now + 5 * 24 * 60 * 60 * 1000,
      summary: "Current 3x cap leaves carry trades undersized. Backtests show 4x with the existing circuit-breaker is within risk mandate.",
    },
    {
      id: 2,
      title: "Add HYPE-PERP to active markets",
      proposer: "AetherQuant.eth",
      status: "succeeded",
      forVotes: 21_700_000,
      againstVotes: 4_100_000,
      abstainVotes: 1_200_000,
      endsAt: now - 2 * 24 * 60 * 60 * 1000,
      summary: "Open HYPE-PERP as the 5th supported market. Initial position size cap 5% of TVL, will scale post-mainnet.",
    },
    {
      id: 1,
      title: "Lower SubscriptionVault BASIC tier to 75 ZENT/mo",
      proposer: "HelixCapital.eth",
      status: "defeated",
      forVotes: 8_300_000,
      againstVotes: 14_900_000,
      abstainVotes: 2_100_000,
      endsAt: now - 9 * 24 * 60 * 60 * 1000,
      summary: "Reduce entry tier to broaden retail access. Treasury impact ~12% over 90d at current take rate.",
    },
  ];
}

// ─── Stakers + subscribers ──────────────────────────────────────────────────

export interface DemoStaker {
  rank: number;
  address: string;
  ens?: string;
  staked: number;
  veBalance: number;
  lockMonths: number;
}

export function demoStakers(count = 8): DemoStaker[] {
  const r = rng(0xface5);
  const ENS = [
    "GenesisPulse.eth", "AetherQuant.eth", "Lumibot.eth", "OrionSigma.eth",
    "HelixCap.eth", "Veil.eth", null, null,
  ];
  return Array.from({ length: count }, (_, i) => ({
    rank: i + 1,
    address: `0x${(0xb16d + i * 13).toString(16).padStart(4, "0")}${"d3adbeef".repeat(8).slice(0, 36)}`,
    ens: ENS[i] ?? undefined,
    staked: Math.round(2_500_000 - i * 250_000 + r() * 50_000),
    veBalance: Math.round((2_500_000 - i * 250_000) * (0.5 + r() * 0.5)),
    lockMonths: Math.round(6 + i * 2 + r() * 6),
  }));
}

export interface DemoSubscriberStats {
  basic: number;
  pro: number;
  elite: number;
  totalMrrZent: number;
  recent: Array<{ tier: "BASIC" | "PRO" | "ELITE"; ago: string }>;
}

export function demoSubscribers(): DemoSubscriberStats {
  const basic = 187;
  const pro = 64;
  const elite = 12;
  return {
    basic,
    pro,
    elite,
    totalMrrZent: basic * 100 + pro * 500 + elite * 2000,
    recent: [
      { tier: "PRO", ago: "12m ago" },
      { tier: "BASIC", ago: "23m ago" },
      { tier: "ELITE", ago: "1h ago" },
      { tier: "BASIC", ago: "2h ago" },
      { tier: "PRO", ago: "3h ago" },
    ],
  };
}

// ─── Recent activity ticker ─────────────────────────────────────────────────

export interface DemoActivityItem {
  ts: number;
  kind: "deposit" | "withdrawal" | "signal" | "subscribe" | "stake" | "epoch";
  text: string;
  vault?: string;
}

export function demoActivity(count = 12): DemoActivityItem[] {
  const r = rng(0xa1c0);
  const now = anchorNow();
  const templates: Array<{ kind: DemoActivityItem["kind"]; build: () => string; vault?: string }> = [
    { kind: "deposit", build: () => `Deposit ${(0.5 + r() * 3).toFixed(2)} WBTC → zBTC vault`, vault: "zBTC" },
    { kind: "deposit", build: () => `Deposit ${(3 + r() * 12).toFixed(2)} WETH → zETH vault`, vault: "zETH" },
    { kind: "deposit", build: () => `Deposit ${(20 + r() * 80).toFixed(0)} WSOL → zSOL vault`, vault: "zSOL" },
    { kind: "withdrawal", build: () => `Withdraw ${(0.2 + r() * 2).toFixed(2)} WBTC ← zBTC vault`, vault: "zBTC" },
    { kind: "signal", build: () => `${pick(["GenesisPulse", "AetherQuant", "Lumibot", "OrionSigma"], r)} submitted BTC-PERP ${pick(["BUY", "SELL"], r)} @ ${Math.round(60 + r() * 40)}% conviction` },
    { kind: "signal", build: () => `${pick(["Helix", "Veil", "Solace"], r)} submitted ETH-PERP signal` },
    { kind: "subscribe", build: () => `New ${pick(["BASIC", "PRO", "ELITE"], r)} subscription (${(100 + Math.floor(r() * 1900))} ZENT/mo)` },
    { kind: "stake", build: () => `${(1000 + r() * 50000).toFixed(0)} ZENT staked for ${30 + Math.floor(r() * 700)} days` },
    { kind: "epoch", build: () => `Epoch settled — ${4 + Math.floor(r() * 12)} signals scored, ${(500 + r() * 3000).toFixed(0)} ZENT distributed` },
  ];
  return Array.from({ length: count }, (_, i) => {
    const tpl = pick(templates, r);
    return {
      ts: now - i * (12 * 60 * 1000) - Math.floor(r() * 7 * 60 * 1000),
      kind: tpl.kind,
      text: tpl.build(),
      vault: tpl.vault,
    };
  }).sort((a, b) => b.ts - a.ts);
}

// ─── Execution trace (HL fills + on-chain executor events) ─────────────────

export interface DemoHlFill {
  id: string;
  fill_key: string;
  vault_address: string;
  hl_user_address: string;
  coin: string;
  side: "Buy" | "Sell";
  px: string;
  sz: string;
  fee: string;
  closed_pnl: string;
  time_ms: number;
}

export interface DemoExecutionAttempt {
  id: string;
  vault_address: string;
  direction: "long" | "short" | "close";
  nonce: number;
  tx_hash: string;
  block_number: number;
  created_at: string;
}

const VAULT_ADDRS: Record<string, string> = {
  zBTC: "0x93669daC07321FF397cf5734Ae8364EA24addF45",
  zETH: "0xbe8a9d22560A1b126554b70Aaca2D763B2E70C4e",
  zSOL: "0xb62BA9d0a14aC9f9601891179B3Da52bE71Ce052",
  zXRP: "0x8B15204D88a9Bb155bE6798522983A3B5F7d7cB0",
};

const ASSET_PRICE: Record<string, number> = {
  BTC: 97_420, ETH: 3_586, SOL: 188, XRP: 2.46,
};

/**
 * Generate sample Hyperliquid fills. Per-vault if vaultSymbol is supplied,
 * otherwise mixed across all 4 vaults.
 */
export function demoHlFills(vaultSymbol?: string, count = 16): DemoHlFill[] {
  const r = rng(0xf11157 + (vaultSymbol?.charCodeAt(2) ?? 0));
  const now = anchorNow();
  const coinPool: Array<["BTC" | "ETH" | "SOL" | "XRP", string]> = vaultSymbol
    ? [[vaultSymbol.slice(1) as "BTC", vaultSymbol]]
    : [["BTC", "zBTC"], ["ETH", "zETH"], ["SOL", "zSOL"], ["XRP", "zXRP"]];
  const fills: DemoHlFill[] = [];
  for (let i = 0; i < count; i++) {
    const [coin, sym] = pick(coinPool, r);
    const basePx = ASSET_PRICE[coin] ?? 100;
    const px = basePx * (1 + (r() - 0.5) * 0.01);
    const sz = (0.1 + r() * 4).toFixed(4);
    const side: "Buy" | "Sell" = r() > 0.5 ? "Buy" : "Sell";
    const fee = (Math.abs(parseFloat(sz)) * px * 0.0003).toFixed(4);
    const closed = (r() - 0.45) * px * 0.02;
    fills.push({
      id: `fill-${i}-${coin}`,
      fill_key: `${"0x".padEnd(8, "0")}${(i * 1973 + 17).toString(16).padStart(56, "0")}`,
      vault_address: VAULT_ADDRS[sym],
      hl_user_address: `0xhl${(0xabc + i).toString(16).padStart(40, "0").slice(0, 38)}`,
      coin,
      side,
      px: px.toFixed(coin === "BTC" ? 1 : coin === "ETH" ? 2 : 4),
      sz,
      fee,
      closed_pnl: closed.toFixed(4),
      time_ms: now - i * (35 * 60 * 1000) - Math.floor(r() * 7 * 60 * 1000),
    });
  }
  return fills.sort((a, b) => b.time_ms - a.time_ms);
}

/**
 * Sample on-chain TradeSignalExecuted events. Used in /dashboard execution
 * trace + per-vault attempt history.
 */
export function demoExecutionAttempts(vaultSymbol?: string, count = 12): DemoExecutionAttempt[] {
  const r = rng(0xe54c + (vaultSymbol?.charCodeAt(2) ?? 0));
  const symbols = vaultSymbol ? [vaultSymbol] : ["zBTC", "zETH", "zSOL", "zXRP"];
  const now = anchorNow();
  const out: DemoExecutionAttempt[] = [];
  for (let i = 0; i < count; i++) {
    const sym = pick(symbols, r);
    const dir = pick<DemoExecutionAttempt["direction"]>(["long", "short", "long", "close"], r);
    const ts = now - i * (3 * 60 * 60 * 1000) - Math.floor(r() * 20 * 60 * 1000);
    out.push({
      id: `exec-${i}`,
      vault_address: VAULT_ADDRS[sym],
      direction: dir,
      nonce: 1000 + i,
      tx_hash: `0x${(0xe51 + i * 23).toString(16).padStart(4, "0")}${"f".repeat(60)}`,
      block_number: 54_000_000 + i * 17,
      created_at: new Date(ts).toISOString(),
    });
  }
  return out;
}

// ─── Helpers used by UI ─────────────────────────────────────────────────────

export function fmtTimeAgo(tsMs: number): string {
  const diffMs = Date.now() - tsMs;
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return `${Math.floor(diffHr / 24)}d ago`;
}

export function clampAccuracy(bps: number): number {
  return clamp(bps, 0, 10000);
}
