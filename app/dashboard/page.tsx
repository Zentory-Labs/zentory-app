"use client";

import { useEffect, useState } from "react";
import { useReadContract } from "wagmi";
import {
  AreaChart,
  Area,
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
  ZENT_ABI,
  VAULT_ABI,
  STAKING_ABI,
  vaultMeta,
} from "@/lib/contracts";
import { getProtocolStats, getVaultNavHistory, getVaultFlow, type VaultNavSnapshot, type VaultFlow } from "@/lib/vault-stats";
import {
  getRecentHlUserFills,
  getRecentExecutionAttempts,
  getVaultTradingAccounts,
  type HlUserFillRow,
  type ExecutionAttemptRow,
  type VaultTradingAccountRow,
} from "@/lib/execution-trace";

const VAULTS = [addresses.zBTC, addresses.zETH, addresses.zSOL, addresses.zXRP] as const;

function getAssetDecimals(asset: string): number {
  if (asset === "BTC") return 8;
  if (asset === "XRP") return 6;
  return 18;
}

const CHART_COLORS = {
  zBTC: "#F7931A",
  zETH: "#627EEA",
  zSOL: "#9945FF",
  zXRP: "#00AAE4",
  alpha: "#b08d57",
  positive: "#22c55e",
  negative: "#ef4444",
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
      <span className="text-xs uppercase tracking-widest" style={{ color: "rgba(106,111,117,0.9)", fontFamily: "'Montserrat', sans-serif" }}>
        {label}
      </span>
      <div className="flex items-end gap-2 flex-wrap">
        <span className="text-2xl font-bold" style={{ color: accent ?? "#eaeaea", fontFamily: "'Montserrat', sans-serif" }}>
          {value}
        </span>
        {pill && (
          <span
            className="text-xs px-2 py-0.5 rounded-full font-semibold"
            style={{ background: pill.startsWith("+") ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)", color: pill.startsWith("+") ? "#22c55e" : "#ef4444", fontFamily: "'Montserrat', sans-serif" }}
          >
            {pill}
          </span>
        )}
      </div>
      {sub && (
        <span className="text-xs" style={{ color: "rgba(106,111,117,0.7)", fontFamily: "'Montserrat', sans-serif" }}>
          {sub}
        </span>
      )}
    </div>
  );
}

// ─── NAV Chart ──────────────────────────────────────────────

function NAVChart({ vault }: { vault: (typeof VAULTS)[number] }) {
  const [nav, setNav] = useState<VaultNavSnapshot[]>([]);
  const meta = vaultMeta[vault];
  const vaultSymbol = meta.symbol;

  useEffect(() => {
    getVaultNavHistory(vaultSymbol, 14).then(setNav);
  }, [vaultSymbol]);

  if (!nav.length) {
    return <div className="h-48 flex items-center justify-center text-sm" style={{ color: "#6a6f75" }}>Loading NAV history...</div>;
  }

  const assetDec = getAssetDecimals(meta.asset);
  const assetUnit = 10 ** assetDec;

  const chartData = nav.map((n) => ({
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
            <Line type="monotone" dataKey="NAV" stroke={CHART_COLORS[vaultSymbol as keyof typeof CHART_COLORS] ?? "#0d80fa"} strokeWidth={2} dot={false} name="NAV/Share" />
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
  const [flow, setFlow] = useState<VaultFlow[]>([]);
  const meta = vaultMeta[vault];
  const vaultSymbol = meta.symbol;

  useEffect(() => {
    getVaultFlow(vaultSymbol, 14).then(setFlow);
  }, [vaultSymbol]);

  if (!flow.length) {
    return <div className="h-48 flex items-center justify-center text-sm" style={{ color: "#6a6f75" }}>Loading flow data...</div>;
  }

  const dec = getAssetDecimals(meta.asset);
  const unit = 10 ** dec;

  const chartData = flow.map((f) => ({
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
  const totalAssets = useReadContract({ address: vault, abi: VAULT_ABI, functionName: "totalAssets" } as any);
  const navPerShare = useReadContract({ address: vault, abi: VAULT_ABI, functionName: "getNavPerShare" } as any);

  const color = CHART_COLORS[meta.symbol as keyof typeof CHART_COLORS] ?? "#0d80fa";
  const dec = getAssetDecimals(meta.asset);
  const unit = 10 ** dec;

  const tvl = Number((totalAssets.data as bigint) ?? 0n) / unit;
  const nav = Number((navPerShare.data as bigint) ?? 0n) / unit;

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
            <h3 className="text-white font-bold text-lg" style={{ fontFamily: "'Montserrat', sans-serif" }}>
              {meta.name}
            </h3>
          </div>
          <p className="text-xs" style={{ color: "rgba(106,111,117,0.7)", fontFamily: "'Montserrat', sans-serif" }}>
            {meta.asset} vault
          </p>
        </div>
        <div className="text-right">
          <div className="text-xl font-bold" style={{ color, fontFamily: "'Montserrat', sans-serif" }}>
            {totalAssets.isLoading ? "—" : fmt(tvl, 0)}
          </div>
          <div className="text-xs" style={{ color: "rgba(106,111,117,0.7)", fontFamily: "'Montserrat', sans-serif" }}>
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
            <div className="text-xs mb-1" style={{ color: "rgba(106,111,117,0.7)", fontFamily: "'Montserrat', sans-serif" }}>{label}</div>
            <div className="text-sm font-bold text-white" style={{ fontFamily: "'Montserrat', sans-serif" }}>{value}</div>
          </div>
        ))}
      </div>

      {/* NAV vs HODL chart */}
      <div className="mb-4">
        <p className="text-xs uppercase tracking-widest mb-3" style={{ color: "rgba(106,111,117,0.7)", fontFamily: "'Montserrat', sans-serif" }}>
          NAV vs HODL (14d)
        </p>
        <NAVChart vault={vault} />
      </div>

      {/* Flow chart */}
      <div>
        <p className="text-xs uppercase tracking-widest mb-3" style={{ color: "rgba(106,111,117,0.7)", fontFamily: "'Montserrat', sans-serif" }}>
          Deposit / Withdrawal Flow (14d)
        </p>
        <FlowChart vault={vault} />
      </div>
    </div>
  );
}

// ─── ZENT Token Metrics ────────────────────────────────────

function ZENTTokenMetrics() {
  const totalSupply = useReadContract({ address: addresses.ZENT, abi: ZENT_ABI, functionName: "totalSupply" } as any);
  const totalStaked = useReadContract({ address: addresses.ZENTStaking, abi: STAKING_ABI, functionName: "totalStaked" } as any);

  const supply = Number(((totalSupply.data as bigint) ?? 0n) / 10n ** 18n);
  const staked = Number(((totalStaked.data as bigint) ?? 0n) / 10n ** 18n);
  const stakePct = supply > 0 ? (staked / supply) * 100 : 0;
  const ZENT_PRICE = 0.08; // mock
  const marketCap = supply * ZENT_PRICE;

  const chartData = Array.from({ length: 30 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (29 - i));
    return {
      date: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      supply: supply * (0.98 + Math.random() * 0.02),
      staked: staked * (0.95 + Math.random() * 0.05),
    };
  });

  return (
    <div
      className="rounded-2xl p-6"
      style={{ background: "#1c1c21", border: "1px solid #2a2f3a" }}
    >
      <div className="flex items-center gap-2 mb-5">
        <div className="w-3 h-3 rounded-full" style={{ background: "#b08d57" }} />
        <h3 className="text-white font-bold text-lg" style={{ fontFamily: "'Montserrat', sans-serif" }}>
          ZENT Token
        </h3>
      </div>

      <div className="grid grid-cols-4 gap-3 mb-5">
        {[
          { label: "Total Supply", value: totalSupply.isLoading ? "—" : `${(supply / 1e6).toFixed(1)}B`, sub: "ZENT" },
          { label: "Market Cap", value: totalSupply.isLoading ? "—" : `$${(marketCap / 1e6).toFixed(1)}M`, sub: `@ $${ZENT_PRICE}` },
          { label: "Staked", value: totalStaked.isLoading ? "—" : `${(staked / 1e6).toFixed(1)}B`, sub: `${stakePct.toFixed(1)}% of supply` },
          { label: "Price", value: `$${ZENT_PRICE}`, sub: "Mock price" },
        ].map(({ label, value, sub }) => (
          <div key={label} className="rounded-xl p-3 text-center" style={{ background: "rgba(0,0,0,0.3)", border: "1px solid #2a2f3a" }}>
            <div className="text-xs mb-1" style={{ color: "rgba(106,111,117,0.7)", fontFamily: "'Montserrat', sans-serif" }}>{label}</div>
            <div className="text-sm font-bold text-white" style={{ fontFamily: "'Montserrat', sans-serif" }}>{value}</div>
            <div className="text-xs" style={{ color: "rgba(176,141,87,0.8)", fontFamily: "'Montserrat', sans-serif" }}>{sub}</div>
          </div>
        ))}
      </div>

      {/* Supply / Staked chart */}
      <p className="text-xs uppercase tracking-widest mb-3" style={{ color: "rgba(106,111,117,0.7)", fontFamily: "'Montserrat', sans-serif" }}>
        Supply & Staked (30d)
      </p>
      <ResponsiveContainer width="100%" height={160}>
        <AreaChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} />
          <XAxis dataKey="date" tick={{ fill: CHART_COLORS.text, fontSize: 10 }} tickLine={false} axisLine={false} />
          <YAxis tick={{ fill: CHART_COLORS.text, fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={(v) => `${(v / 1e6).toFixed(0)}M`} />
          <Tooltip
            contentStyle={{ background: "#1c1c21", border: "1px solid #2a2f3a", borderRadius: 8, color: "#eaeaea", fontSize: 12 }}
            labelStyle={{ color: "rgba(255,255,255,0.7)" }}
          />
          <Legend wrapperStyle={{ fontSize: 12, color: CHART_COLORS.text }} />
          <Area type="monotone" dataKey="supply" stroke="#b08d57" fill="rgba(176,141,87,0.15)" strokeWidth={2} name="Total Supply" />
          <Area type="monotone" dataKey="staked" stroke="#0d80fa" fill="rgba(13,128,250,0.1)" strokeWidth={2} name="Staked" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Protocol TVL Overview ──────────────────────────────────

function ProtocolTVLOverview() {
  const [stats, setStats] = useState<Awaited<ReturnType<typeof getProtocolStats>> | null>(null);

  useEffect(() => {
    getProtocolStats().then(setStats);
  }, []);

  if (!stats) {
    return (
      <div className="rounded-2xl p-6 flex items-center justify-center h-48" style={{ background: "#1c1c21", border: "1px solid #2a2f3a" }}>
        <span className="text-sm" style={{ color: "#6a6f75" }}>Loading protocol stats...</span>
      </div>
    );
  }

  const vaultColors: Record<string, string> = {
    zETH: CHART_COLORS.zETH,
    zBTC: CHART_COLORS.zBTC,
    zSOL: CHART_COLORS.zSOL,
    zXRP: CHART_COLORS.zXRP,
  };

  const chartData = stats.vaults.map((v) => ({
    name: v.symbol,
    TVL: v.totalAssets,
    alpha: v.cumulativeAlpha,
  }));

  return (
    <div
      className="rounded-2xl p-6"
      style={{ background: "#1c1c21", border: "1px solid #2a2f3a" }}
    >
      <div className="grid grid-cols-4 gap-3 mb-5">
        {[
          { label: "Total TVL", value: `$${(stats.totalTvl / 1e6).toFixed(2)}M`, accent: "#eaeaea" },
          { label: "Total Deposits", value: `$${(stats.totalDeposits / 1e6).toFixed(2)}M`, accent: CHART_COLORS.positive },
          { label: "Total Withdrawals", value: `$${(stats.totalWithdrawals / 1e6).toFixed(2)}M`, accent: CHART_COLORS.negative },
          { label: "Avg Alpha", value: fmtPct(stats.avgAlpha), accent: stats.avgAlpha >= 0 ? CHART_COLORS.positive : CHART_COLORS.negative, pill: fmtPct(stats.avgAlpha) },
        ].map(({ label, value, accent, pill }) => (
          <div key={label} className="rounded-xl p-4 text-center" style={{ background: "rgba(0,0,0,0.3)", border: "1px solid #2a2f3a" }}>
            <div className="text-xs mb-1" style={{ color: "rgba(106,111,117,0.7)", fontFamily: "'Montserrat', sans-serif" }}>{label}</div>
            <div className="text-xl font-bold" style={{ color: accent, fontFamily: "'Montserrat', sans-serif" }}>{value}</div>
            {pill && (
              <div className="text-xs mt-1 font-semibold" style={{ color: pill.startsWith("+") ? CHART_COLORS.positive : CHART_COLORS.negative, fontFamily: "'Montserrat', sans-serif" }}>{pill}</div>
            )}
          </div>
        ))}
      </div>

      {/* Stacked TVL by vault */}
      <p className="text-xs uppercase tracking-widest mb-3" style={{ color: "rgba(106,111,117,0.7)", fontFamily: "'Montserrat', sans-serif" }}>
        TVL by Vault
      </p>
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} />
          <XAxis dataKey="name" tick={{ fill: CHART_COLORS.text, fontSize: 11 }} tickLine={false} axisLine={false} />
          <YAxis tick={{ fill: CHART_COLORS.text, fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(v) => `${(v / 1e6).toFixed(1)}M`} />
          <Tooltip
            contentStyle={{ background: "#1c1c21", border: "1px solid #2a2f3a", borderRadius: 8, color: "#eaeaea", fontSize: 12 }}
            labelStyle={{ color: "rgba(255,255,255,0.7)" }}
            formatter={(v) => [`$${(Number(v) / 1e6).toFixed(2)}M`, "TVL"]}
          />
          <Legend wrapperStyle={{ fontSize: 12, color: CHART_COLORS.text }} />
          <Bar dataKey="TVL" name="TVL" radius={[4, 4, 0, 0]}>
            {chartData.map((entry) => (
              <rect key={entry.name} fill={vaultColors[entry.name] ?? "#0d80fa"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Execution trace (on-chain attempts + venue fills) ─────────

function ExecutionTraceSection() {
  const [fills, setFills] = useState<HlUserFillRow[]>([]);
  const [attempts, setAttempts] = useState<ExecutionAttemptRow[]>([]);
  const [accounts, setAccounts] = useState<VaultTradingAccountRow[]>([]);

  useEffect(() => {
    Promise.all([
      getRecentHlUserFills(40),
      getRecentExecutionAttempts(25),
      getVaultTradingAccounts(),
    ]).then(([f, a, acc]) => {
      setFills(f);
      setAttempts(a);
      setAccounts(acc);
    });
  }, []);

  const hasTraceData = fills.length > 0 || attempts.length > 0 || accounts.length > 0;

  return (
    <div
      className="rounded-2xl p-6 mb-8"
      style={{ background: "#1c1c21", border: "1px solid #2a2f3a" }}
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
        <div>
          <h2 className="text-xl font-bold text-white" style={{ fontFamily: "'Montserrat', sans-serif" }}>
            Execution trace
          </h2>
          <p className="text-xs mt-1" style={{ color: "rgba(106,111,117,0.85)", fontFamily: "'Montserrat', sans-serif" }}>
            On-chain <code className="text-[11px] px-1 rounded" style={{ background: "rgba(0,0,0,0.35)" }}>TradeSignalExecuted</code> rows and Hyperliquid{" "}
            <code className="text-[11px] px-1 rounded" style={{ background: "rgba(0,0,0,0.35)" }}>userFills</code> (when ingested).
          </p>
        </div>
        {!hasTraceData && (
          <span className="text-xs px-3 py-1 rounded-full border" style={{ borderColor: "#2a2f3a", color: "#6a6f75", fontFamily: "'Montserrat', sans-serif" }}>
            Run DB migration + indexer scripts to populate
          </span>
        )}
      </div>

      {accounts.length > 0 && (
        <div className="mb-6 overflow-x-auto">
          <p className="text-xs uppercase tracking-widest mb-2" style={{ color: "rgba(106,111,117,0.7)", fontFamily: "'Montserrat', sans-serif" }}>
            Vault → Hyperliquid mapping
          </p>
          <table className="w-full text-sm" style={{ fontFamily: "'Montserrat', sans-serif" }}>
            <thead>
              <tr style={{ color: "#6a6f75", textAlign: "left" }}>
                <th className="pb-2 pr-4">Vault</th>
                <th className="pb-2 pr-4">HL user</th>
                <th className="pb-2">Asset</th>
              </tr>
            </thead>
            <tbody style={{ color: "#eaeaea" }}>
              {accounts.map((r) => (
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
          <p className="text-xs uppercase tracking-widest mb-2" style={{ color: "rgba(106,111,117,0.7)", fontFamily: "'Montserrat', sans-serif" }}>
            Recent on-chain attempts
          </p>
          {attempts.length === 0 ? (
            <p className="text-sm" style={{ color: "#6a6f75" }}>No rows yet — run <span className="font-mono text-xs">index_strategy_executor_events.py</span>.</p>
          ) : (
            <table className="w-full text-sm" style={{ fontFamily: "'Montserrat', sans-serif" }}>
              <thead>
                <tr style={{ color: "#6a6f75", textAlign: "left" }}>
                  <th className="pb-2 pr-3">Vault</th>
                  <th className="pb-2 pr-3">Dir</th>
                  <th className="pb-2 pr-3">Nonce</th>
                  <th className="pb-2">Tx</th>
                </tr>
              </thead>
              <tbody style={{ color: "#eaeaea" }}>
                {attempts.map((a) => (
                  <tr key={a.id} style={{ borderTop: "1px solid #2a2f3a" }}>
                    <td className="py-2 pr-3 font-mono text-[11px]">{a.vault_address.slice(0, 8)}…</td>
                    <td className="py-2 pr-3">{a.direction ?? "—"}</td>
                    <td className="py-2 pr-3 font-mono text-[11px]">{a.nonce ?? "—"}</td>
                    <td className="py-2">
                      <a
                        href={`https://hypurrscan.io/tx/${a.tx_hash}`}
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
          <p className="text-xs uppercase tracking-widest mb-2" style={{ color: "rgba(106,111,117,0.7)", fontFamily: "'Montserrat', sans-serif" }}>
            Recent venue fills (Hyperliquid)
          </p>
          {fills.length === 0 ? (
            <p className="text-sm" style={{ color: "#6a6f75" }}>
              No fills yet — fund HL test accounts and run <span className="font-mono text-xs">poll_hyperliquid_fills.py</span>.
            </p>
          ) : (
            <table className="w-full text-sm" style={{ fontFamily: "'Montserrat', sans-serif" }}>
              <thead>
                <tr style={{ color: "#6a6f75", textAlign: "left" }}>
                  <th className="pb-2 pr-3">Coin</th>
                  <th className="pb-2 pr-3">Px</th>
                  <th className="pb-2 pr-3">Sz</th>
                  <th className="pb-2 pr-3">PnL</th>
                  <th className="pb-2">Time</th>
                </tr>
              </thead>
              <tbody style={{ color: "#eaeaea" }}>
                {fills.map((f) => (
                  <tr key={`${f.fill_key}-${f.id}`} style={{ borderTop: "1px solid #2a2f3a" }}>
                    <td className="py-2 pr-3">{f.coin ?? "—"}</td>
                    <td className="py-2 pr-3 font-mono text-[11px]">{f.px ?? "—"}</td>
                    <td className="py-2 pr-3 font-mono text-[11px]">{f.sz ?? "—"}</td>
                    <td className="py-2 pr-3 font-mono text-[11px]">{f.closed_pnl ?? "—"}</td>
                    <td className="py-2 text-[11px]" style={{ color: "#6a6f75" }}>
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
  return (
    <div className="w-full">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-2 h-2 rounded-full" style={{ background: "#22c55e", boxShadow: "0 0 8px #22c55e" }} />
          <span className="text-xs uppercase tracking-widest font-semibold" style={{ color: "#22c55e", fontFamily: "'Montserrat', sans-serif" }}>
            Live Protocol Analytics
          </span>
        </div>
        <h1 className="text-3xl font-bold text-white" style={{ fontFamily: "'Montserrat', sans-serif" }}>
          Protocol Dashboard
        </h1>
        <p className="text-sm mt-1" style={{ color: "rgba(106,111,117,0.8)", fontFamily: "'Montserrat', sans-serif" }}>
          Real-time performance, TVL, alpha generation, and capital flow metrics
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
        <h2 className="text-xl font-bold text-white mb-4" style={{ fontFamily: "'Montserrat', sans-serif" }}>
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
      <div className="text-center text-xs py-8" style={{ color: "rgba(106,111,117,0.5)", fontFamily: "'Montserrat', sans-serif" }}>
        Historical data shown is illustrative seed data for demonstration purposes. Past performance does not guarantee future results.
      </div>
    </div>
  );
}
