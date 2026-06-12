import { createClient } from "@/utils/supabase/client";

// Returns true if the Supabase URL looks unreachable (env empty or hostname
// that DNS can't resolve). Used to silently short-circuit indexer reads
// instead of spamming the console with ERR_NAME_NOT_RESOLVED.
function supabaseDisabled(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  return !url || !url.includes(".supabase.co");
}

export interface VaultNavSnapshot {
  id: string;
  vault_symbol: string;
  snapshot_at: string;
  nav_per_share: number;
  total_assets: number;
  hodl_nav: number;
  alpha_pct: number;
  created_at: string;
}

export interface VaultFlow {
  id: string;
  vault_symbol: string;
  date: string;
  deposits: number;
  withdrawals: number;
  net_flow: number;
  tx_count: number;
}

export interface VaultPerformance {
  id: string;
  vault_symbol: string;
  date: string;
  nav_return_pct: number;
  hodl_return_pct: number;
  alpha_pct: number;
  cumulative_alpha: number;
  max_drawdown_pct: number;
  win_rate_pct: number;
  sharpe_ratio: number;
}

/** Fetch NAV history for a vault, last N days */
export async function getVaultNavHistory(
  vaultSymbol: string,
  days = 30
): Promise<VaultNavSnapshot[]> {
  if (supabaseDisabled()) return [];
  const supabase = createClient();
  const since = new Date();
  since.setDate(since.getDate() - days);

  try {
    const { data, error } = await supabase
      .from("vault_nav_history")
      .select("*")
      .eq("vault_symbol", vaultSymbol)
      .gte("snapshot_at", since.toISOString())
      .order("snapshot_at", { ascending: true });
    if (error) return [];
    return (data as VaultNavSnapshot[]) ?? [];
  } catch {
    return [];
  }
}

/** Fetch deposit/withdrawal flow for a vault, last N days */
export async function getVaultFlow(
  vaultSymbol: string,
  days = 30
): Promise<VaultFlow[]> {
  if (supabaseDisabled()) return [];
  const supabase = createClient();
  const since = new Date();
  since.setDate(since.getDate() - days);

  try {
    const { data, error } = await supabase
      .from("vault_flow")
      .select("*")
      .eq("vault_symbol", vaultSymbol)
      .gte("date", since.toISOString().split("T")[0])
      .order("date", { ascending: true });
    if (error) return [];
    return (data as VaultFlow[]) ?? [];
  } catch {
    return [];
  }
}

/** Fetch daily performance metrics for a vault */
export async function getVaultPerformance(
  vaultSymbol: string,
  days = 30
): Promise<VaultPerformance[]> {
  if (supabaseDisabled()) return [];
  const supabase = createClient();
  const since = new Date();
  since.setDate(since.getDate() - days);

  try {
    const { data, error } = await supabase
      .from("vault_performance")
      .select("*")
      .eq("vault_symbol", vaultSymbol)
      .gte("date", since.toISOString().split("T")[0])
      .order("date", { ascending: true });
    if (error) return [];
    return (data as VaultPerformance[]) ?? [];
  } catch {
    return [];
  }
}

/** Underlying decimals for the RAW integer units the vault-nav indexer writes
 *  into vault_nav_history. Keep in sync with the [vault] page config and
 *  zentory-engine/scripts/index_vault_nav.py. */
export const NAV_DECIMALS: Record<string, number> = { zBTC: 8, zETH: 18, zSOL: 9, zXRP: 6, SPOT: 8 };

/** Which forward-ledger asset prices each vault's underlying. */
const LEDGER_ASSET: Record<string, string> = { zBTC: "BTC", zETH: "ETH", zSOL: "SOL", zXRP: "XRP", SPOT: "BTC" };

/** Latest USD price per asset from the public hash-chained forward ledger
 *  (same-origin, published every 4h by the recorder). Returns {} on failure —
 *  callers must treat USD values as unavailable, never fabricate. */
async function latestLedgerPrices(): Promise<Record<string, number>> {
  try {
    const res = await fetch("/forward_ledger.jsonl", { cache: "no-store" });
    if (!res.ok) return {};
    const prices: Record<string, number> = {};
    for (const line of (await res.text()).split("\n")) {
      if (!line.trim()) continue;
      try {
        const e = JSON.parse(line);
        if (e.asset && typeof e.price === "number") prices[e.asset] = e.price;
      } catch {
        /* skip malformed line */
      }
    }
    return prices;
  } catch {
    return {};
  }
}

/** Average "ahead of holding" across assets from the public hash-chained
 *  forward ledger: latest entry per asset, (actual_nav / hold_nav - 1),
 *  averaged, in percent. This is the paper-trading ledger the engine publishes
 *  every 4h — not vault NAV. Returns null when the ledger is unavailable so
 *  callers render an honest dash, never a fabricated number. */
export async function getLedgerAheadOfHoldPct(): Promise<number | null> {
  try {
    const res = await fetch("/forward_ledger.jsonl", { cache: "no-store" });
    if (!res.ok) return null;
    // Lines are appended chronologically — the last line per asset wins.
    const latest: Record<string, { actual: number; hold: number }> = {};
    for (const line of (await res.text()).split("\n")) {
      if (!line.trim()) continue;
      try {
        const e = JSON.parse(line);
        if (
          e.asset &&
          typeof e.actual_nav === "number" &&
          typeof e.hold_nav === "number" &&
          e.hold_nav > 0
        ) {
          latest[e.asset] = { actual: e.actual_nav, hold: e.hold_nav };
        }
      } catch {
        /* skip malformed line */
      }
    }
    const entries = Object.values(latest);
    if (!entries.length) return null;
    const avg = entries.reduce((s, e) => s + (e.actual / e.hold - 1), 0) / entries.length;
    return avg * 100;
  } catch {
    return null;
  }
}

/** Fetch aggregate stats across all vaults.
 *
 *  Unit semantics: vault_nav_history stores RAW integer chain units (1 WBTC =
 *  1e8, 1 WETH = 1e18, ...). Summing those raw values as "USD" once rendered a
 *  fourteen-digit TVL on the dashboard. Everything returned here is normalized
 *  to asset units, with USD computed from real ledger prices where available. */
export async function getProtocolStats() {
  const supabase = createClient();

  // Flow/performance tables only contain pre-June demo seed rows; a rolling
  // 30-day window excludes them permanently without deleting user data.
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 30);
  const cutoffDate = cutoff.toISOString().split("T")[0];

  const [navData, flowData, perfData, prices] = await Promise.all([
    supabase.from("vault_nav_history").select("*").order("snapshot_at", { ascending: false }).limit(25),
    supabase.from("vault_flow").select("vault_symbol, deposits, withdrawals, net_flow").gte("date", cutoffDate).order("date", { ascending: false }),
    supabase.from("vault_performance").select("*").gte("date", cutoffDate).order("date", { ascending: false }),
    latestLedgerPrices(),
  ]);

  const latestNav = navData.data ?? [];
  const flows = flowData.data ?? [];
  const performance = perfData.data ?? [];

  const vaults = ["zBTC", "zETH", "zSOL", "zXRP", "SPOT"];

  const byVault = vaults.map((sym) => {
    // latest snapshot per symbol (rows are interleaved across vaults)
    const nav = (latestNav as VaultNavSnapshot[]).find((n) => n.vault_symbol === sym);
    const unit = 10 ** (NAV_DECIMALS[sym] ?? 8);
    const assets = (nav?.total_assets ?? 0) / unit;
    const price = prices[LEDGER_ASSET[sym]] ?? 0;

    const vaultFlows = (flows as VaultFlow[]).filter((f) => f.vault_symbol === sym);
    const vaultPerf = (performance as VaultPerformance[]).filter((p) => p.vault_symbol === sym);

    const totalDeposits = vaultFlows.reduce((s, f) => s + f.deposits, 0);
    const totalWithdrawals = vaultFlows.reduce((s, f) => s + f.withdrawals, 0);
    const avgAlpha = vaultPerf.length
      ? vaultPerf.reduce((s, p) => s + p.alpha_pct, 0) / vaultPerf.length
      : 0;
    const avgWinRate = vaultPerf.length
      ? vaultPerf.reduce((s, p) => s + p.win_rate_pct, 0) / vaultPerf.length
      : 0;
    const cumulativeAlpha = vaultPerf.length ? vaultPerf[vaultPerf.length - 1]?.cumulative_alpha ?? 0 : 0;

    return {
      symbol: sym,
      navPerShare: (nav?.nav_per_share ?? 0) / unit,
      totalAssets: assets,
      usdValue: price > 0 ? assets * price : null,
      hodlNav: (nav?.hodl_nav ?? 0) / unit,
      alphaPct: nav?.alpha_pct ?? 0,
      totalDeposits,
      totalWithdrawals,
      netFlow: totalDeposits - totalWithdrawals,
      avgAlpha,
      avgWinRate,
      cumulativeAlpha,
    };
  });

  const priced = byVault.filter((v) => v.usdValue !== null);
  const totalTvl = priced.reduce((s, v) => s + (v.usdValue ?? 0), 0);
  const tvlComplete = priced.length === byVault.length;
  const totalDeposits = byVault.reduce((s, v) => s + v.totalDeposits, 0);
  const totalWithdrawals = byVault.reduce((s, v) => s + v.totalWithdrawals, 0);
  const avgAlpha = byVault.reduce((s, v) => s + v.avgAlpha, 0) / byVault.length;
  const avgWinRate = byVault.reduce((s, v) => s + v.avgWinRate, 0) / byVault.length;

  return { vaults: byVault, totalTvl, tvlComplete, totalDeposits, totalWithdrawals, avgAlpha, avgWinRate };
}
