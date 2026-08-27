"use client";

import { useEffect, useMemo, useState } from "react";
import { useReadContract } from "wagmi";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import {
  addresses,
  VAULT_ABI,
  vaultMeta,
} from "@/lib/contracts";
import { getProtocolStats, getVaultNavHistory, getVaultFlow, getLedgerAheadOfHoldPct, type VaultNavSnapshot, type VaultFlow } from "@/lib/vault-stats";
import { useDemoMode, DemoBadge } from "@/lib/demo/context";
import { demoNavHistory, demoFlow, demoProtocolStats, demoHlFills, demoExecutionAttempts } from "@/lib/demo/data";
import {
  getRecentHlUserFills,
  getRecentExecutionAttempts,
  getVaultTradingAccounts,
  type HlUserFillRow,
  type ExecutionAttemptRow,
  type VaultTradingAccountRow,
} from "@/lib/execution-trace";

type ReadArgs = Parameters<typeof useReadContract>[0];

const VAULTS = [addresses.zBTC, addresses.zETH, addresses.zSOL, addresses.zXRP] as const;

function getAssetDecimals(asset: string): number {
  if (asset === "BTC") return 8;
  if (asset === "XRP") return 6;
  if (asset === "SOL") return 9;
  return 18;
}

const CHART_COLORS = {
  zBTC: "#F7931A",
  zETH: "#627EEA",
  zSOL: "#c2353f",
  zXRP: "#00AAE4",
  alpha: "#b08d57",
  positive: "#34d399",
  negative: "#c2353f",
  grid: "rgba(255,255,255,0.06)",
  text: "rgba(255,255,255,0.5)",
};

// ─── Helpers ───────────────────────────────────────────────────

function fmt(value: bigint | number, decimals = 18, digits = 2): string {
  if (value === 0 || value === undefined || value === null) return "—";
  const v = typeof value === "bigint" ? Number(value / 10n ** BigInt(decimals)) : value;
  return v.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: digits });
}

function fmtPct(v: number): string {
  if (v === undefined || v === null || isNaN(v)) return "—";
  return `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`;
}

// ─── Metric Card ─────────────────────────────────────────────

function MetricCard({
  label,
  value,
  sub,
  accent,
  pill,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: string;
  pill?: string;
}) {
  return (
    <div
      className="rounded-2xl p-5 flex flex-col gap-1"
      style={{
        background: "#1c1c21",
        border: "1px solid #2a2f3a",
      }}
    >
      <span className="text-xs uppercase tracking-widest" style={{ color: "#6a6f75", fontFamily: "var(--font-montserrat), sans-serif" }}>
        {label}
      </span>
      <div className="flex items-end gap-2 flex-wrap">
        <span className="text-2xl font-bold" style={{ color: accent ?? "#eaeaea", fontFamily: "var(--font-montserrat), sans-serif" }}>
          {value}
        </span>
        {pill && (
          <span
            className="text-xs px-2 py-0.5 rounded-full font-semibold"
            style={{ background: pill.startsWith("+") ? "rgba(52,211,153,0.15)" : "rgba(194,53,63,0.15)", color: pill.startsWith("+") ? "#34d399" : "#c2353f", fontFamily: "var(--font-montserrat), sans-serif" }}
          >
            {pill}
          </span>
        )}
      </div>
      {sub && (
        <span className="text-xs" style={{ color: "#6a6f75", fontFamily: "var(--font-montserrat), sans-serif" }}>
          {sub}
        </span>
      )}
    </div>
  );
}

// ─── NAV Chart ──────────────────────────────────────────────

function NAVChart({ vault }: { vault: (typeof VAULTS)[number] }) {
  const { enabled: demoMode } = useDemoMode();
  const [nav, setNav] = useState<VaultNavSnapshot[] | null>(null);
  const meta = vaultMeta[vault];
  const vaultSymbol = meta.symbol;

  // Demo NAV is a pure derivation of (demoMode, vaultSymbol, meta.asset).
  // Compute it during render with useMemo so we never need to call setState
  // inside the demo branch of the async effect (which the
  // react-hooks/set-state-in-effect rule disallows).
  const demoNav = useMemo<VaultNavSnapshot[] | null>(() => {
    if (!demoMode) return null;
    const points = demoNavHistory(vaultSymbol, 14);
    const dec = getAssetDecimals(meta.asset);
    const unit = 10 ** dec;
    return points.map((p, i) => ({
      id: `demo-${vaultSymbol}-${i}`,
      vault_symbol: vaultSymbol,
      snapshot_at: new Date(p.ts).toISOString(),
      nav_per_share: p.nav * unit,
      total_assets: 500 * unit,
      hodl_nav: p.hodl * unit,
      alpha_pct: p.alphaPct,
      created_at: new Date(p.ts).toISOString(),
    }));
  }, [demoMode, vaultSymbol, meta.asset]);

  // Live NAV is async; the setState inside `.then()` is allowed by the rule.
  useEffect(() => {
    if (demoMode) return;
    let cancelled = false;
    getVaultNavHistory(vaultSymbol, 14).then((rows) => {
      if (!cancelled) setNav(rows);
    });
    return () => {
      cancelled = true;
    };
  }, [vaultSymbol, demoMode, meta.asset]);

  const effectiveNav = demoNav ?? nav;

  if (effectiveNav === null) {
    return <div className="h-48 flex items-center justify-center text-sm" style={{ color: "#bfc3c7" }}>Loading NAV history…</div>;
  }
  if (!effectiveNav.length) {
    return (
      <div className="h-48 flex items-center justify-center text-center text-sm px-6" style={{ color: "#bfc3c7" }}>
        NAV history populates once the off-chain indexer is live (post-mainnet).
      </div>
    );
  }

  const assetDec = getAssetDecimals(meta.asset);
  const assetUnit = 10 ** assetDec;

  const chartData = effectiveNav.map((n) => ({
    time: new Date(n.snapshot_at).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    NAV: Number(n.nav_per_share) / assetUnit,
    HODL: Number(n.hodl_nav) / assetUnit,
    alpha: Number(n.alpha_pct),
  }));

  return (
    <div>
      <div className="mb-4">
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} />
            <XAxis dataKey="time" tick={{ fill: CHART_COLORS.text, fontSize: 11 }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fill: CHART_COLORS.text, fontSize: 11 }} tickLine={false} axisLine={false} />
            <Tooltip
              contentStyle={{ background: "#1c1c21", border: "1px solid #2a2f3a", borderRadius: 8, color: "#eaeaea", fontSize: 12 }}
              labelStyle={{ color: "rgba(255,255,255,0.7)" }}
            />
            <Legend wrapperStyle={{ fontSize: 12, color: CHART_COLORS.text }} />
            <Line type="monotone" dataKey="NAV" stroke={CHART_COLORS[vaultSymbol as keyof typeof CHART_COLORS] ?? "#b08d57"} strokeWidth={2} dot={false} name="NAV/Share" />
            <Line type="monotone" dataKey="HODL" stroke="rgba(106,111,117,0.5)" strokeWidth={1.5} strokeDasharray="4 4" dot={false} name="HODL Baseline" />
          </LineChart>
        </ResponsiveContainer>
      </div>
      {/* Alpha vs HODL bar chart */}
      <ResponsiveContainer width="100%" height={120}>
        <BarChart data={chartData} margin={{ top: 0, right: 4, bottom: 0, left: -20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} />
          <XAxis dataKey="time" tick={{ fill: CHART_COLORS.text, fontSize: 10 }} tickLine={false} axisLine={false} hide />
          <YAxis tick={{ fill: CHART_COLORS.text, fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={(v) => `${v > 0 ? "+" : ""}${v.toFixed(1)}%`} />
          <Tooltip
            contentStyle={{ background: "#1c1c21", border: "1px solid #2a2f3a", borderRadius: 8, color: "#eaeaea", fontSize: 12 }}
            formatter={(v) => [`${Number(v) >= 0 ? "+" : ""}${Number(v).toFixed(3)}%`, "Alpha vs HODL"]}
          />
          <Bar dataKey="alpha" fill={CHART_COLORS.alpha} radius={[2, 2, 0, 0]} name="Alpha %" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Deposit Flow Chart ─────────────────────────────────────

function FlowChart({ vault }: { vault: (typeof VAULTS)[number] }) {
  const { enabled: demoMode } = useDemoMode();
  const [flow, setFlow] = useState<VaultFlow[] | null>(null);
  const meta = vaultMeta[vault];
  const vaultSymbol = meta.symbol;

  // Demo flow is a pure derivation of (demoMode, vaultSymbol, meta.asset).
  // We pre-multiply by 10^decimals to cancel out the downstream division
  // (Supabase stores raw wei; the demo generator returns human-readable
  // amounts). Computing this in a useMemo avoids the synchronous
  // setState-in-effect that the lint rule disallows.
  const demoFlowRows = useMemo<VaultFlow[] | null>(() => {
    if (!demoMode) return null;
    const decShift = 10 ** getAssetDecimals(meta.asset);
    return demoFlow(vaultSymbol, 14).map((d, i) => ({
      id: `demo-flow-${vaultSymbol}-${i}`,
      vault_symbol: vaultSymbol,
      date: d.date,
      deposits: d.deposits * decShift,
      withdrawals: d.withdrawals * decShift,
      net_flow: d.netFlow * decShift,
      tx_count: d.txCount,
    }));
  }, [demoMode, vaultSymbol, meta.asset]);

  useEffect(() => {
    if (demoMode) return;
    let cancelled = false;
    getVaultFlow(vaultSymbol, 14).then((rows) => {
      if (!cancelled) setFlow(rows);
    });
    return () => {
      cancelled = true;
    };
  }, [vaultSymbol, demoMode, meta.asset]);

  const effectiveFlow = demoFlowRows ?? flow;

  if (effectiveFlow === null) {
    return <div className="h-48 flex items-center justify-center text-sm" style={{ color: "#bfc3c7" }}>Loading flow data…</div>;
  }
  if (!effectiveFlow.length) {
    return (
      <div className="h-48 flex items-center justify-center text-center text-sm px-6" style={{ color: "#bfc3c7" }}>
        Deposit/withdrawal flow populates once the indexer is live.
      </div>
    );
  }

  const dec = getAssetDecimals(meta.asset);
  const unit = 10 ** dec;

  const chartData = effectiveFlow.map((f) => ({
    date: new Date(f.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    Deposits: Number(f.deposits) / unit,
    Withdrawals: Number(f.withdrawals) / unit,
    "Net Flow": Number(f.net_flow) / unit,
  }));

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} />
        <XAxis dataKey="date" tick={{ fill: CHART_COLORS.text, fontSize: 11 }} tickLine={false} axisLine={false} />
        <YAxis tick={{ fill: CHART_COLORS.text, fontSize: 11 }} tickLine={false} axisLine={false} />
        <Tooltip
          contentStyle={{ background: "#1c1c21", border: "1px solid #2a2f3a", borderRadius: 8, color: "#eaeaea", fontSize: 12 }}
          labelStyle={{ color: "rgba(255,255,255,0.7)" }}
        />
        <Legend wrapperStyle={{ fontSize: 12, color: CHART_COLORS.text }} />
        <Bar dataKey="Deposits" fill={CHART_COLORS.positive} opacity={0.8} radius={[2, 2, 0, 0]} name="Deposits" />
        <Bar dataKey="Withdrawals" fill={CHART_COLORS.negative} opacity={0.8} radius={[2, 2, 0, 0]} name="Withdrawals" />
      </BarChart>
    </ResponsiveContainer>
  );
}

// ─── Vault Section ──────────────────────────────────────────

function VaultSection({ vault }: { vault: (typeof VAULTS)[number] }) {
  const meta = vaultMeta[vault];
  const { enabled: demoMode } = useDemoMode();
  const totalAssets = useReadContract({ address: vault, abi: VAULT_ABI, functionName: "totalAssets" } as ReadArgs);
  const navPerShare = useReadContract({ address: vault, abi: VAULT_ABI, functionName: "getNavPerShare" } as ReadArgs);

  const color = CHART_COLORS[meta.symbol as keyof typeof CHART_COLORS] ?? "#b08d57";
  const dec = getAssetDecimals(meta.asset);
  const unit = 10 ** dec;

  // In demo mode, override the on-chain reads with seeded protocol stats
  // so per-vault rows match the aggregate stat cards above (and avoid the
  // inflated zSOL state from the earlier decimals bug).
  let tvl: number;
  let nav: number;
  if (demoMode) {
    const row = demoProtocolStats().vaults.find((v) => v.symbol === meta.symbol);
    tvl = row?.totalAssets ?? 0;
    nav = row?.navPerShare ?? 1;
  } else {
    tvl = Number((totalAssets.data as bigint) ?? 0n) / unit;
    nav = Number((navPerShare.data as bigint) ?? 0n) / unit;
  }

  return (
    <div
      className="rounded-2xl p-6"
      style={{ background: "#1c1c21", border: "1px solid #2a2f3a" }}
    >
      {/* Vault header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-3 h-3 rounded-full" style={{ background: color }} />
            <h3 className="text-white font-bold text-lg" style={{ fontFamily: "var(--font-montserrat), sans-serif" }}>
              {meta.name}
            </h3>
          </div>
          <p className="text-xs" style={{ color: "#6a6f75", fontFamily: "var(--font-montserrat), sans-serif" }}>
            {meta.asset} vault
          </p>
        </div>
        <div className="text-right">
          <div className="text-xl font-bold" style={{ color, fontFamily: "var(--font-montserrat), sans-serif" }}>
            {demoMode
              ? `$${(tvl / 1e6).toFixed(2)}M`
              : totalAssets.isLoading
              ? "—"
              : fmt(tvl, 0)}
          </div>
          <div className="text-xs" style={{ color: "#6a6f75", fontFamily: "var(--font-montserrat), sans-serif" }}>
            TVL
          </div>
        </div>
      </div>

      {/* NAV stats row */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        {[
          { label: "NAV/Share", value: totalAssets.isLoading ? "—" : nav.toFixed(4) },
          { label: "Asset", value: meta.asset },
          { label: "Symbol", value: meta.symbol },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-xl p-3 text-center" style={{ background: "rgba(0,0,0,0.3)", border: "1px solid #2a2f3a" }}>
            <div className="text-xs mb-1" style={{ color: "#6a6f75", fontFamily: "var(--font-montserrat), sans-serif" }}>{label}</div>
            <div className="text-sm font-bold text-white" style={{ fontFamily: "var(--font-montserrat), sans-serif" }}>{value}</div>
          </div>
        ))}
      </div>

      {/* NAV vs HODL chart */}
      <div className="mb-4">
        <p className="text-xs uppercase tracking-widest mb-3" style={{ color: "#6a6f75", fontFamily: "var(--font-montserrat), sans-serif" }}>
          NAV vs HODL (14d)
        </p>
        <NAVChart vault={vault} />
      </div>

      {/* Flow chart */}
      <div>
        <p className="text-xs uppercase tracking-widest mb-3" style={{ color: "#6a6f75", fontFamily: "var(--font-montserrat), sans-serif" }}>
          Deposit / Withdrawal Flow (14d)
        </p>
        <FlowChart vault={vault} />
      </div>
    </div>
  );
}

// ─── ZENT Token Metrics ────────────────────────────────────

function ZENTTokenMetrics() {
  // Market cap, price and a price chart only exist once ZENT is listed.
  // Until TGE this section is a single honest line — no TBD grids, no flat
  // zero charts.
  return (
    <div
      className="rounded-2xl p-6"
      style={{ background: "#1c1c21", border: "1px solid #2a2f3a" }}
    >
      <div className="flex items-center gap-2 mb-2">
        <div className="w-3 h-3 rounded-full" style={{ background: "#b08d57" }} />
        <h3 className="text-white font-bold text-lg" style={{ fontFamily: "var(--font-montserrat), sans-serif" }}>
          ZENT Token
        </h3>
      </div>
      <p className="text-sm" style={{ color: "#bfc3c7", fontFamily: "var(--font-montserrat), sans-serif" }}>
        ZENT is not yet listed — token metrics appear at TGE.
      </p>
    </div>
  );
}

// ─── Protocol TVL Overview ──────────────────────────────────

function ProtocolTVLOverview() {
  const { enabled: demoMode } = useDemoMode();
  const [stats, setStats] = useState<Awaited<ReturnType<typeof getProtocolStats>> | null>(null);
  // Real number from the public forward ledger (paper trading, vs holding) —
  // fetched regardless of demo mode because it is never synthesized.
  const [aheadPct, setAheadPct] = useState<number | null>(null);

  useEffect(() => {
    getLedgerAheadOfHoldPct().then(setAheadPct).catch(() => undefined);
  }, []);

  // Demo stats are a pure derivation of demoMode — compute them in render so
  // the demo branch never needs to call setState inside an effect (which the
  // react-hooks/set-state-in-effect rule disallows).
  const demoStats = useMemo(() => (demoMode ? demoProtocolStats() : null), [demoMode]);

  useEffect(() => {
    if (demoMode) return; // demoStats is the source of truth in demo mode.
    let cancelled = false;
    getProtocolStats()
      .then((s) => {
        if (!cancelled) setStats(s);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [demoMode]);

  const effectiveStats = demoStats ?? stats;
  const loaded = demoMode ? demoStats !== null : stats !== null;

  if (!loaded) {
    return (
      <div className="rounded-2xl p-6 flex items-center justify-center h-48" style={{ background: "#1c1c21", border: "1px solid #2a2f3a" }}>
        <span className="text-sm" style={{ color: "#bfc3c7" }}>Loading protocol stats…</span>
      </div>
    );
  }

  // Off-chain indexer offline (Supabase project intentionally paused until
  // post-mainnet). Show an honest empty state instead of leaving the spinner
  // running forever. Live on-chain stats are still shown in the vault cards
  // below — this section is specifically for historical/aggregate views.
  if (!effectiveStats || !effectiveStats.vaults.length) {
    return (
      <div className="rounded-2xl p-6" style={{ background: "#1c1c21", border: "1px solid #2a2f3a" }}>
        <div className="text-center py-12">
          <div className="text-sm font-semibold mb-2" style={{ color: "#eaeaea", fontFamily: "var(--font-montserrat), sans-serif" }}>
            Off-chain analytics offline
          </div>
          <p className="text-xs max-w-md mx-auto" style={{ color: "#bfc3c7", fontFamily: "var(--font-montserrat), sans-serif" }}>
            Aggregate TVL, deposits, withdrawals and historical alpha come from the
            indexer, which goes live alongside mainnet (Q4 2026). Live on-chain vault
            state is shown in the cards below.
          </p>
        </div>
      </div>
    );
  }

  const vaultColors: Record<string, string> = {
    zETH: CHART_COLORS.zETH,
    zBTC: CHART_COLORS.zBTC,
    zSOL: CHART_COLORS.zSOL,
    zXRP: CHART_COLORS.zXRP,
    SPOT: "#b08d57",
  };

  // USD per vault (live: ledger-priced; demo: already USD). Vaults without a
  // price chart as 0 rather than mixing BTC/ETH/SOL units in one axis.
  const chartData = effectiveStats.vaults.map((v) => ({
    name: v.symbol,
    TVL: v.usdValue ?? 0,
    alpha: v.cumulativeAlpha,
  }));

  // Testnet TVL is ~$60K, demo mode ~$60M — one fixed "/1e6 M" format renders
  // the real number as $0.00M, so scale the unit to the magnitude.
  const fmtUsd = (n: number) =>
    n >= 1e6 ? `$${(n / 1e6).toFixed(2)}M` : n >= 1e3 ? `$${(n / 1e3).toFixed(1)}K` : `$${n.toFixed(0)}`;

  return (
    <div
      className="rounded-2xl p-6"
      style={{ background: "#1c1c21", border: "1px solid #2a2f3a" }}
    >
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        {[
          { label: "Total TVL", value: effectiveStats.totalTvl > 0 ? fmtUsd(effectiveStats.totalTvl) : "—", accent: "#eaeaea" },
          // No external flow yet — say so explicitly instead of a bare dash.
          effectiveStats.totalDeposits > 0
            ? { label: "Total Deposits", value: fmtUsd(effectiveStats.totalDeposits), accent: CHART_COLORS.positive }
            : { label: "Total Deposits", value: "No external deposits yet — testnet, founder-seeded", accent: "rgba(234,234,234,0.6)", small: true },
          effectiveStats.totalWithdrawals > 0
            ? { label: "Total Withdrawals", value: fmtUsd(effectiveStats.totalWithdrawals), accent: CHART_COLORS.negative }
            : { label: "Total Withdrawals", value: "No external withdrawals yet — testnet, founder-seeded", accent: "rgba(234,234,234,0.6)", small: true },
          {
            label: "Ahead of holding (live ledger)",
            value: aheadPct !== null ? fmtPct(aheadPct) : "—",
            accent: (aheadPct ?? 0) >= 0 ? CHART_COLORS.positive : CHART_COLORS.negative,
            sub: "paper ledger, vs holding",
          },
        ].map(({ label, value, accent, sub, small }: { label: string; value: string; accent: string; sub?: string; small?: boolean }) => (
          <div key={label} className="rounded-xl p-4 text-center" style={{ background: "rgba(0,0,0,0.3)", border: "1px solid #2a2f3a" }}>
            <div className="text-xs mb-1" style={{ color: "#6a6f75", fontFamily: "var(--font-montserrat), sans-serif" }}>{label}</div>
            <div className={small ? "text-xs font-medium leading-snug" : "text-xl font-bold"} style={{ color: accent, fontFamily: "var(--font-montserrat), sans-serif" }}>{value}</div>
            {sub && (
              <div className="text-xs mt-1" style={{ color: "#6a6f75", fontFamily: "var(--font-montserrat), sans-serif" }}>{sub}</div>
            )}
          </div>
        ))}
      </div>

      {/* Stacked TVL by vault */}
      <p className="text-xs uppercase tracking-widest mb-3" style={{ color: "#6a6f75", fontFamily: "var(--font-montserrat), sans-serif" }}>
        TVL by Vault
      </p>
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} />
          <XAxis dataKey="name" tick={{ fill: CHART_COLORS.text, fontSize: 11 }} tickLine={false} axisLine={false} />
          <YAxis tick={{ fill: CHART_COLORS.text, fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(v) => fmtUsd(Number(v))} width={70} />
          <Tooltip
            contentStyle={{ background: "#1c1c21", border: "1px solid #2a2f3a", borderRadius: 8, color: "#eaeaea", fontSize: 12 }}
            labelStyle={{ color: "rgba(255,255,255,0.7)" }}
            formatter={(v) => [fmtUsd(Number(v)), "TVL"]}
          />
          <Legend wrapperStyle={{ fontSize: 12, color: CHART_COLORS.text }} />
          <Bar dataKey="TVL" name="TVL" radius={[4, 4, 0, 0]}>
            {chartData.map((entry) => (
              <rect key={entry.name} fill={vaultColors[entry.name] ?? "#b08d57"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Execution trace (on-chain attempts + venue fills) ─────────

function ExecutionTraceSection() {
  const { enabled: demoMode } = useDemoMode();
  const [fills, setFills] = useState<HlUserFillRow[] | null>(null);
  const [attempts, setAttempts] = useState<ExecutionAttemptRow[] | null>(null);
  const [accounts, setAccounts] = useState<VaultTradingAccountRow[] | null>(null);

  // Demo execution trace is a pure derivation of demoMode. Compute it in
  // render so the demo branch never needs to call setState inside an effect
  // (which the react-hooks/set-state-in-effect rule disallows).
  const demoTrace = useMemo<{
    fills: HlUserFillRow[];
    attempts: ExecutionAttemptRow[];
    accounts: VaultTradingAccountRow[];
  } | null>(() => {
    if (!demoMode) return null;
    return {
      fills: demoHlFills(undefined, 18) as unknown as HlUserFillRow[],
      attempts: demoExecutionAttempts(undefined, 14) as unknown as ExecutionAttemptRow[],
      accounts: [],
    };
  }, [demoMode]);

  useEffect(() => {
    if (demoMode) return;
    let cancelled = false;
    Promise.all([
      getRecentHlUserFills(40),
      getRecentExecutionAttempts(25),
      getVaultTradingAccounts(),
    ]).then(([f, a, acc]) => {
      if (cancelled) return;
      setFills(f);
      setAttempts(a);
      setAccounts(acc);
    });
    return () => {
      cancelled = true;
    };
  }, [demoMode]);

  const effectiveFills = demoTrace?.fills ?? fills ?? [];
  const effectiveAttempts = demoTrace?.attempts ?? attempts ?? [];
  const effectiveAccounts = demoTrace?.accounts ?? accounts ?? [];

  const hasTraceData =
    effectiveFills.length > 0 || effectiveAttempts.length > 0 || effectiveAccounts.length > 0;

  return (
    <div
      className="rounded-2xl p-6 mb-8"
      style={{ background: "#1c1c21", border: "1px solid #2a2f3a" }}
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
        <div>
          <h2 className="text-xl font-bold text-white" style={{ fontFamily: "var(--font-montserrat), sans-serif" }}>
            Execution trace
          </h2>
          <p className="text-xs mt-1" style={{ color: "#6a6f75", fontFamily: "var(--font-montserrat), sans-serif" }}>
            On-chain <code className="text-[11px] px-1 rounded" style={{ background: "rgba(0,0,0,0.35)" }}>TradeSignalExecuted</code> rows and Hyperliquid{" "}
            <code className="text-[11px] px-1 rounded" style={{ background: "rgba(0,0,0,0.35)" }}>userFills</code> (when ingested).
          </p>
        </div>
        {!hasTraceData && (
          <span className="text-xs px-3 py-1 rounded-full border" style={{ borderColor: "#2a2f3a", color: "#bfc3c7", fontFamily: "var(--font-montserrat), sans-serif" }}>
            Indexer ingestion goes live with mainnet
          </span>
        )}
      </div>

      {effectiveAccounts.length > 0 && (
        <div className="mb-6 overflow-x-auto">
          <p className="text-xs uppercase tracking-widest mb-2" style={{ color: "#6a6f75", fontFamily: "var(--font-montserrat), sans-serif" }}>
            Vault → Hyperliquid mapping
          </p>
          <table className="w-full text-sm" style={{ fontFamily: "var(--font-montserrat), sans-serif" }}>
            <thead>
              <tr style={{ color: "#bfc3c7", textAlign: "left" }}>
                <th className="pb-2 pr-4">Vault</th>
                <th className="pb-2 pr-4">HL user</th>
                <th className="pb-2">Asset</th>
              </tr>
            </thead>
            <tbody style={{ color: "#eaeaea" }}>
              {effectiveAccounts.map((r) => (
                <tr key={r.vault_address} style={{ borderTop: "1px solid #2a2f3a" }}>
                  <td className="py-2 pr-4 font-mono text-xs">{r.vault_address.slice(0, 10)}…</td>
                  <td className="py-2 pr-4 font-mono text-xs">{r.hl_user_address.slice(0, 10)}…</td>
                  <td className="py-2">{r.asset}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="overflow-x-auto">
          <p className="text-xs uppercase tracking-widest mb-2" style={{ color: "#6a6f75", fontFamily: "var(--font-montserrat), sans-serif" }}>
            Recent on-chain attempts
          </p>
          {effectiveAttempts.length === 0 ? (
            <p className="text-sm" style={{ color: "#bfc3c7" }}>No on-chain executions to display yet.</p>
          ) : (
            <table className="w-full text-sm" style={{ fontFamily: "var(--font-montserrat), sans-serif" }}>
              <thead>
                <tr style={{ color: "#bfc3c7", textAlign: "left" }}>
                  <th className="pb-2 pr-3">Vault</th>
                  <th className="pb-2 pr-3">Dir</th>
                  <th className="pb-2 pr-3">Nonce</th>
                  <th className="pb-2">Tx</th>
                </tr>
              </thead>
              <tbody style={{ color: "#eaeaea" }}>
                {effectiveAttempts.map((a) => (
                  <tr key={a.id} style={{ borderTop: "1px solid #2a2f3a" }}>
                    <td className="py-2 pr-3 font-mono text-[11px]">{a.vault_address.slice(0, 8)}…</td>
                    <td className="py-2 pr-3">{a.direction ?? "—"}</td>
                    <td className="py-2 pr-3 font-mono text-[11px]">{a.nonce ?? "—"}</td>
                    <td className="py-2">
                      <a
                        href={`https://app.hyperliquid-testnet.xyz/explorer/tx/${a.tx_hash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-mono text-[11px] underline"
                        style={{ color: "#b08d57" }}
                      >
                        {a.tx_hash.slice(0, 10)}…
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="overflow-x-auto">
          <p className="text-xs uppercase tracking-widest mb-2" style={{ color: "#6a6f75", fontFamily: "var(--font-montserrat), sans-serif" }}>
            Recent venue fills (Hyperliquid)
          </p>
          {effectiveFills.length === 0 ? (
            <p className="text-sm" style={{ color: "#bfc3c7" }}>
              No venue fills to display yet.
            </p>
          ) : (
            <table className="w-full text-sm" style={{ fontFamily: "var(--font-montserrat), sans-serif" }}>
              <thead>
                <tr style={{ color: "#bfc3c7", textAlign: "left" }}>
                  <th className="pb-2 pr-3">Coin</th>
                  <th className="pb-2 pr-3">Px</th>
                  <th className="pb-2 pr-3">Sz</th>
                  <th className="pb-2 pr-3">PnL</th>
                  <th className="pb-2">Time</th>
                </tr>
              </thead>
              <tbody style={{ color: "#eaeaea" }}>
                {effectiveFills.map((f) => (
                  <tr key={`${f.fill_key}-${f.id}`} style={{ borderTop: "1px solid #2a2f3a" }}>
                    <td className="py-2 pr-3">{f.coin ?? "—"}</td>
                    <td className="py-2 pr-3 font-mono text-[11px]">{f.px ?? "—"}</td>
                    <td className="py-2 pr-3 font-mono text-[11px]">{f.sz ?? "—"}</td>
                    <td className="py-2 pr-3 font-mono text-[11px]">{f.closed_pnl ?? "—"}</td>
                    <td className="py-2 text-[11px]" style={{ color: "#bfc3c7" }}>
                      {f.time_ms ? new Date(f.time_ms).toISOString().slice(0, 16).replace("T", " ") : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────

export default function DashboardPage() {
  const { enabled: demoMode } = useDemoMode();
  return (
    <div className="w-full">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-2 h-2 rounded-full" style={{ background: "#34d399", boxShadow: "0 0 8px #34d399" }} />
          <span className="text-xs uppercase tracking-widest font-semibold" style={{ color: "#34d399", fontFamily: "var(--font-montserrat), sans-serif" }}>
            Live Protocol Analytics
          </span>
        </div>
        <h1 className="text-3xl font-bold text-white inline-flex items-center gap-3" style={{ fontFamily: "var(--font-montserrat), sans-serif" }}>
          Protocol Dashboard
          {demoMode && <DemoBadge />}
        </h1>
        <p className="text-sm mt-1" style={{ color: "#6a6f75", fontFamily: "var(--font-montserrat), sans-serif" }}>
          Real-time performance, TVL, vs-holding comparison, and capital flow metrics
        </p>
      </div>

      {/* Protocol overview */}
      <div className="mb-8">
        <ProtocolTVLOverview />
      </div>

      {/* ZENT token metrics */}
      <div className="mb-8">
        <ZENTTokenMetrics />
      </div>

      {/* Per-vault analytics */}
      <div className="mb-8">
        <h2 className="text-xl font-bold text-white mb-4" style={{ fontFamily: "var(--font-montserrat), sans-serif" }}>
          Vault Analytics
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {VAULTS.map((vault) => (
            <VaultSection key={vault} vault={vault} />
          ))}
        </div>
      </div>

      <ExecutionTraceSection />

      {/* Disclaimer */}
      <div className="text-center text-xs py-8" style={{ color: "#6a6f75", fontFamily: "var(--font-montserrat), sans-serif" }}>
        Testnet only · Chain 998 · Charts populate once the indexer has run against the active Supabase project. Past performance does not guarantee future results.
      </div>
    </div>
  );
}
