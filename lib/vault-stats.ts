import { createClient } from "@/utils/supabase/client";

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
  const supabase = createClient();
  const since = new Date();
  since.setDate(since.getDate() - days);

  const { data, error } = await supabase
    .from("vault_nav_history")
    .select("*")
    .eq("vault_symbol", vaultSymbol)
    .gte("snapshot_at", since.toISOString())
    .order("snapshot_at", { ascending: true });

  if (error) {
    console.error("[vault-stats] getVaultNavHistory:", error.message);
    return [];
  }
  return (data as VaultNavSnapshot[]) ?? [];
}

/** Fetch deposit/withdrawal flow for a vault, last N days */
export async function getVaultFlow(
  vaultSymbol: string,
  days = 30
): Promise<VaultFlow[]> {
  const supabase = createClient();
  const since = new Date();
  since.setDate(since.getDate() - days);

  const { data, error } = await supabase
    .from("vault_flow")
    .select("*")
    .eq("vault_symbol", vaultSymbol)
    .gte("date", since.toISOString().split("T")[0])
    .order("date", { ascending: true });

  if (error) {
    console.error("[vault-stats] getVaultFlow:", error.message);
    return [];
  }
  return (data as VaultFlow[]) ?? [];
}

/** Fetch daily performance metrics for a vault */
export async function getVaultPerformance(
  vaultSymbol: string,
  days = 30
): Promise<VaultPerformance[]> {
  const supabase = createClient();
  const since = new Date();
  since.setDate(since.getDate() - days);

  const { data, error } = await supabase
    .from("vault_performance")
    .select("*")
    .eq("vault_symbol", vaultSymbol)
    .gte("date", since.toISOString().split("T")[0])
    .order("date", { ascending: true });

  if (error) {
    console.error("[vault-stats] getVaultPerformance:", error.message);
    return [];
  }
  return (data as VaultPerformance[]) ?? [];
}

/** Fetch aggregate stats across all vaults */
export async function getProtocolStats() {
  const supabase = createClient();

  const [navData, flowData, perfData] = await Promise.all([
    supabase.from("vault_nav_history").select("*").order("snapshot_at", { ascending: false }).limit(4),
    supabase.from("vault_flow").select("vault_symbol, deposits, withdrawals, net_flow").order("date", { ascending: false }),
    supabase.from("vault_performance").select("*").order("date", { ascending: false }),
  ]);

  const latestNav = navData.data ?? [];
  const flows = flowData.data ?? [];
  const performance = perfData.data ?? [];

  const vaults = ["zETH", "zBTC", "zSOL", "zXRP"];

  const byVault = vaults.map((sym) => {
    const nav = (latestNav as VaultNavSnapshot[]).find((n) => n.vault_symbol === sym);
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
      navPerShare: nav?.nav_per_share ?? 0,
      totalAssets: nav?.total_assets ?? 0,
      hodlNav: nav?.hodl_nav ?? 0,
      alphaPct: nav?.alpha_pct ?? 0,
      totalDeposits,
      totalWithdrawals,
      netFlow: totalDeposits - totalWithdrawals,
      avgAlpha,
      avgWinRate,
      cumulativeAlpha,
    };
  });

  const totalTvl = byVault.reduce((s, v) => s + v.totalAssets, 0);
  const totalDeposits = byVault.reduce((s, v) => s + v.totalDeposits, 0);
  const totalWithdrawals = byVault.reduce((s, v) => s + v.totalWithdrawals, 0);
  const avgAlpha = byVault.reduce((s, v) => s + v.avgAlpha, 0) / 4;
  const avgWinRate = byVault.reduce((s, v) => s + v.avgWinRate, 0) / 4;

  return { vaults: byVault, totalTvl, totalDeposits, totalWithdrawals, avgAlpha, avgWinRate };
}
