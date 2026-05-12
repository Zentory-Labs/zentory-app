"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { createClient } from "@/utils/supabase/client";

// ─── Types ────────────────────────────────────────────────────────────────────

interface OverviewStats {
  totalSignals: number;
  overallAccuracy: number;
  winRate: number;
  totalRewardsZent: string;
  totalSlashesZent: string;
  uniqueProviders: number;
  bestAssetClass: string;
  worstAssetClass: string;
}

interface AssetClassRow {
  assetClass: string;
  totalSignals: number;
  avgAccuracy: number;
  winRate: number;
  netPayoutZent: number;
  providers: number;
}

interface EpochRow {
  epochId: number;
  avgAccuracy: number;
  totalSignals: number;
  settledSignals: number;
  totalPayoutZent: number;
  startTime: string;
  endTime: string;
}

interface RecentSignal {
  id: string;
  provider: string;
  asset: string;
  direction: string;
  accuracy_bps: number;
  payout_zent: number;
  created_at: string;
}

// ─── API helpers ──────────────────────────────────────────────────────────────

async function fetchOverview(): Promise<OverviewStats | null> {
  try {
    const res = await fetch("/api/analytics/overview");
    if (!res.ok) return null;
    const json = await res.json();
    if (json.error) return null;
    return json as OverviewStats;
  } catch {
    return null;
  }
}

async function fetchAssetClasses(): Promise<AssetClassRow[]> {
  try {
    const res = await fetch("/api/analytics/asset-classes");
    if (!res.ok) return [];
    const json = await res.json();
    if (json.error) return [];
    return json.assetClasses as AssetClassRow[];
  } catch {
    return [];
  }
}

async function fetchEpochs(): Promise<EpochRow[]> {
  try {
    const res = await fetch("/api/analytics/epochs");
    if (!res.ok) return [];
    const json = await res.json();
    if (json.error) return [];
    return json.epochs as EpochRow[];
  } catch {
    return [];
  }
}

async function fetchRecentSignals(): Promise<RecentSignal[]> {
  try {
    const supabase = createClient();
    const { data } = await supabase
      .from("signals")
      .select("id, provider, asset, direction, accuracy_bps, payout_zent, created_at")
      .not("accuracy_bps", "is", null)
      .order("created_at", { ascending: false })
      .limit(20);
    return data ?? [];
  } catch {
    return [];
  }
}

// ─── Accuracy Over Time Chart ─────────────────────────────────────────────────

function AccuracyOverTimeChart({ epochs }: { epochs: EpochRow[] }) {
  const displayEpochs = useMemo(() => [...epochs].reverse().slice(-20), [epochs]);

  if (displayEpochs.length < 2) {
    return (
      <div className="flex items-center justify-center h-48 text-sm" style={{ color: "rgba(234,234,234,0.4)" }}>
        Not enough epoch data yet
      </div>
    );
  }

  const W = 700, H = 220, PAD = { top: 20, right: 20, bottom: 40, left: 45 };
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;

  const maxAcc = 100;
  const minAcc = 0;

  const xScale = (i: number) => (i / (displayEpochs.length - 1)) * innerW;
  const yScale = (v: number) => innerH - ((v - minAcc) / (maxAcc - minAcc)) * innerH;

  const points = displayEpochs.map((e, i) => ({
    x: PAD.left + xScale(i),
    y: PAD.top + yScale(e.avgAccuracy),
    epoch: e.epochId,
    accuracy: e.avgAccuracy,
  }));

  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  const areaPath =
    `${linePath} L ${points[points.length - 1].x} ${PAD.top + innerH} L ${PAD.left} ${PAD.top + innerH} Z`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ overflow: "visible" }}>
      <defs>
        <linearGradient id="accGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#b08d57" stopOpacity={0.35} />
          <stop offset="100%" stopColor="#b08d57" stopOpacity={0.02} />
        </linearGradient>
      </defs>

      {/* Grid lines */}
      {[0, 25, 50, 75, 100].map((v) => {
        const y = PAD.top + yScale(v);
        return (
          <g key={v}>
            <line x1={PAD.left} y1={y} x2={PAD.left + innerW} y2={y} stroke="#2a2f3a" strokeWidth={1} />
            <text x={PAD.left - 8} y={y + 4} textAnchor="end" fontSize={10} fill="rgba(234,234,234,0.4)" fontFamily="Montserrat, sans-serif">
              {v}%
            </text>
          </g>
        );
      })}

      {/* Area fill */}
      <path d={areaPath} fill="url(#accGrad)" />

      {/* Line */}
      <path d={linePath} fill="none" stroke="#b08d57" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />

      {/* Points */}
      {points.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={3.5} fill="#b08d57" />
      ))}

      {/* X-axis labels (epoch numbers) */}
      {displayEpochs.map((e, i) => {
        if (i % Math.max(1, Math.floor(displayEpochs.length / 6)) !== 0 && i !== displayEpochs.length - 1) return null;
        return (
          <text
            key={i}
            x={PAD.left + xScale(i)}
            y={PAD.top + innerH + 20}
            textAnchor="middle"
            fontSize={10}
            fill="rgba(234,234,234,0.4)"
            fontFamily="Montserrat, sans-serif"
          >
            #{e.epochId}
          </text>
        );
      })}

      {/* Axis labels */}
      <text
        x={PAD.left + innerW / 2}
        y={H - 4}
        textAnchor="middle"
        fontSize={10}
        fill="rgba(234,234,234,0.4)"
        fontFamily="Montserrat, sans-serif"
      >
        Epoch
      </text>
      <text
        x={12}
        y={PAD.top + innerH / 2}
        textAnchor="middle"
        fontSize={10}
        fill="rgba(234,234,234,0.4)"
        fontFamily="Montserrat, sans-serif"
        transform={`rotate(-90, 12, ${PAD.top + innerH / 2})`}
      >
        Accuracy %
      </text>
    </svg>
  );
}

// ─── Asset Class Bar Chart ────────────────────────────────────────────────────

const ASSET_COLORS: Record<string, string> = {
  CRYPTO_SPOT: "#B08D57",
  CRYPTO_PERP: "#B08D57",
  EQUITY: "#627EEA",
  FOREX: "#14F195",
  COMMODITY: "#F7931A",
  UNKNOWN: "#888",
};

function AssetClassChart({ data }: { data: AssetClassRow[] }) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-sm" style={{ color: "rgba(234,234,234,0.4)" }}>
        No asset class data yet
      </div>
    );
  }

  const maxAcc = Math.max(...data.map((d) => d.avgAccuracy), 1);
  const BAR_H = 32, BAR_GAP = 14;
  const LABEL_W = 100;
  const H = data.length * (BAR_H + BAR_GAP) + BAR_GAP;

  return (
    <svg viewBox={`0 0 500 ${H}`} className="w-full" style={{ overflow: "visible" }}>
      {data.map((d, i) => {
        const y = BAR_GAP + i * (BAR_H + BAR_GAP);
        const barW = ((d.avgAccuracy) / maxAcc) * (500 - LABEL_W - 60);
        const color = ASSET_COLORS[d.assetClass] ?? "#888";

        return (
          <g key={d.assetClass}>
            {/* Label */}
            <text
              x={LABEL_W - 8}
              y={y + BAR_H / 2 + 4}
              textAnchor="end"
              fontSize={11}
              fill="rgba(234,234,234,0.7)"
              fontFamily="Montserrat, sans-serif"
            >
              {d.assetClass}
            </text>

            {/* Background bar */}
            <rect
              x={LABEL_W}
              y={y}
              width={500 - LABEL_W - 60}
              height={BAR_H}
              rx={4}
              fill="#1c1c21"
            />

            {/* Fill bar */}
            <rect
              x={LABEL_W}
              y={y}
              width={barW}
              height={BAR_H}
              rx={4}
              fill={color}
              fillOpacity={0.85}
            />

            {/* Value label */}
            <text
              x={LABEL_W + barW + 8}
              y={y + BAR_H / 2 + 4}
              fontSize={11}
              fill={color}
              fontFamily="Montserrat, sans-serif"
              fontWeight="600"
            >
              {d.avgAccuracy.toFixed(1)}%
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ─── Accuracy Distribution Histogram ─────────────────────────────────────────

function AccuracyHistogram({ signals }: { signals: RecentSignal[] }) {
  const buckets = useMemo(() => {
    const b: number[] = [0, 0, 0, 0, 0];
    for (const s of signals) {
      const a = s.accuracy_bps ?? 0;
      if (a < 2000) b[0]++;
      else if (a < 4000) b[1]++;
      else if (a < 6000) b[2]++;
      else if (a < 8000) b[3]++;
      else b[4]++;
    }
    return b;
  }, [signals]);

  const BUCKET_LABELS = ["<2k", "2-4k", "4-6k", "6-8k", ">8k"];
  const BUCKET_COLORS = ["#ef4444", "#f59e0b", "#6b7280", "#86efac", "#22c55e"];
  const maxVal = Math.max(...buckets, 1);

  const W = 500, H = 180, PAD = { top: 20, right: 20, bottom: 40, left: 40 };
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const barW = innerW / 5 - 12;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ overflow: "visible" }}>
      {[0, Math.ceil(maxVal / 2), maxVal].map((v, i) => {
        const y = PAD.top + innerH - (v / maxVal) * innerH;
        return (
          <g key={i}>
            <line x1={PAD.left} y1={y} x2={PAD.left + innerW} y2={y} stroke="#2a2f3a" strokeWidth={1} />
            <text x={PAD.left - 6} y={y + 4} textAnchor="end" fontSize={9} fill="rgba(234,234,234,0.4)" fontFamily="Montserrat, sans-serif">
              {v}
            </text>
          </g>
        );
      })}

      {buckets.map((v, i) => {
        const barH = (v / maxVal) * innerH;
        const x = PAD.left + i * (innerW / 5) + 6;
        const y = PAD.top + innerH - barH;

        return (
          <g key={i}>
            <rect x={x} y={y} width={barW} height={barH} rx={3} fill={BUCKET_COLORS[i]} fillOpacity={0.8} />
            <text
              x={x + barW / 2}
              y={PAD.top + innerH + 16}
              textAnchor="middle"
              fontSize={9}
              fill="rgba(234,234,234,0.5)"
              fontFamily="Montserrat, sans-serif"
            >
              {BUCKET_LABELS[i]}
            </text>
            {v > 0 && (
              <text
                x={x + barW / 2}
                y={y - 5}
                textAnchor="middle"
                fontSize={10}
                fill={BUCKET_COLORS[i]}
                fontFamily="Montserrat, sans-serif"
                fontWeight="600"
              >
                {v}
              </text>
            )}
          </g>
        );
      })}

      {/* Y-axis label */}
      <text
        x={12}
        y={PAD.top + innerH / 2}
        textAnchor="middle"
        fontSize={9}
        fill="rgba(234,234,234,0.4)"
        fontFamily="Montserrat, sans-serif"
        transform={`rotate(-90, 12, ${PAD.top + innerH / 2})`}
      >
        Signals
      </text>
    </svg>
  );
}

// ─── Recent Signals Table ──────────────────────────────────────────────────────

function SignalsTable({ signals }: { signals: RecentSignal[] }) {
  if (signals.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-sm" style={{ color: "rgba(234,234,234,0.4)" }}>
        No research yet — research will appear after the first epoch settles
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr style={{ background: "rgba(255,255,255,0.03)" }}>
            {["Provider", "Asset", "Dir", "Accuracy", "Payout ZENT"].map((h) => (
              <th
                key={h}
                className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider"
                style={{ color: "rgba(234,234,234,0.4)", fontFamily: "'Montserrat', sans-serif" }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {signals.map((s, i) => {
            const isBuy = s.direction === "LONG" || s.direction === "BUY";
            const payoutColor = (s.payout_zent ?? 0) >= 0 ? "#22c55e" : "#ef4444";
            const accColor = (s.accuracy_bps ?? 0) >= 65 ? "#22c55e" : (s.accuracy_bps ?? 0) >= 50 ? "#f59e0b" : "#ef4444";

            return (
              <tr
                key={s.id}
                style={{ borderBottom: i < signals.length - 1 ? "1px solid #2a2f3a" : undefined }}
              >
                <td className="px-4 py-3 font-mono text-xs" style={{ color: "#b08d57", fontFamily: "'Montserrat', sans-serif" }}>
                  {s.provider ?? "—"}
                </td>
                <td className="px-4 py-3 font-mono text-xs" style={{ color: "#eaeaea", fontFamily: "'Montserrat', sans-serif" }}>
                  {s.asset ?? "—"}
                </td>
                <td className="px-4 py-3">
                  <span
                    className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold"
                    style={{
                      background: isBuy ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)",
                      border: `1px solid ${isBuy ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)"}`,
                      color: isBuy ? "#22c55e" : "#ef4444",
                      fontFamily: "'Montserrat', sans-serif",
                    }}
                  >
                    {isBuy ? "BUY" : "SELL"}
                  </span>
                </td>
                <td className="px-4 py-3 font-mono text-xs" style={{ color: accColor, fontFamily: "'Montserrat', sans-serif" }}>
                  {((s.accuracy_bps ?? 0) / 100).toFixed(1)}%
                </td>
                <td className="px-4 py-3 font-mono text-xs font-semibold" style={{ color: payoutColor, fontFamily: "'Montserrat', sans-serif" }}>
                  {(s.payout_zent ?? 0) >= 0 ? "+" : ""}{(s.payout_zent ?? 0).toFixed(4)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Win Rate Bar ─────────────────────────────────────────────────────────────

function WinRateBar({ winRate }: { winRate: number }) {
  const pct = Math.min(100, Math.max(0, winRate));
  const color = pct >= 65 ? "#22c55e" : pct >= 50 ? "#f59e0b" : "#ef4444";

  return (
    <div>
      <div className="flex justify-between items-center mb-1.5">
        <span className="text-xs" style={{ color: "rgba(234,234,234,0.5)", fontFamily: "'Montserrat', sans-serif" }}>
          Win Rate
        </span>
        <span className="text-sm font-bold" style={{ color, fontFamily: "'Montserrat', sans-serif" }}>
          {pct.toFixed(1)}%
        </span>
      </div>
      <div className="w-full h-2 rounded-full" style={{ background: "#2a2f3a" }}>
        <div
          className="h-2 rounded-full transition-all duration-500"
          style={{
            width: `${pct}%`,
            background: color,
            boxShadow: `0 0 8px ${color}60`,
          }}
        />
      </div>
    </div>
  );
}

// ─── Section Card ─────────────────────────────────────────────────────────────

function SectionCard({
  title,
  children,
  className = "",
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl p-6 ${className}`}
      style={{ background: "#1c1c21", border: "1px solid #2a2f3a" }}
    >
      <h2 className="text-base font-semibold mb-4" style={{ color: "#eaeaea", fontFamily: "'Montserrat', sans-serif" }}>
        {title}
      </h2>
      {children}
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded ${className}`}
      style={{ background: "rgba(255,255,255,0.06)" }}
    />
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const [overview, setOverview] = useState<OverviewStats | null>(null);
  const [assetClasses, setAssetClasses] = useState<AssetClassRow[]>([]);
  const [epochs, setEpochs] = useState<EpochRow[]>([]);
  const [signals, setSignals] = useState<RecentSignal[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<"7d" | "30d" | "all">("all");
  const [assetFilter, setAssetFilter] = useState("All");

  const load = useCallback(async () => {
    const [ov, ac, ep, sig] = await Promise.all([
      fetchOverview(),
      fetchAssetClasses(),
      fetchEpochs(),
      fetchRecentSignals(),
    ]);
    setOverview(ov);
    setAssetClasses(ac);
    setEpochs(ep);
    setSignals(sig);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 60_000);
    return () => clearInterval(id);
  }, [load]);

  const filteredAssetClasses = useMemo(() => {
    if (assetFilter === "All") return assetClasses;
    return assetClasses.filter((a) => a.assetClass.toLowerCase().includes(assetFilter.toLowerCase()));
  }, [assetClasses, assetFilter]);

  const recentSignalsFiltered = useMemo(() => {
    if (timeRange === "all") return signals;
    const cutoff = Date.now() - (timeRange === "7d" ? 7 : 30) * 24 * 60 * 60 * 1000;
    return signals.filter((s) => new Date(s.created_at).getTime() >= cutoff);
  }, [signals, timeRange]);

  return (
    <div className="w-full overflow-x-hidden" style={{ fontFamily: "'Montserrat', sans-serif" }}>
      {/* Ambient glow — gold accent on analytics */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-[#b08d57]/5 rounded-full blur-3xl pointer-events-none -z-10" />

      <main className="mx-auto max-w-7xl px-6 py-28 space-y-8">

        {/* ── Header ── */}
        <section className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div
              className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold mb-3"
              style={{
                background: "rgba(176,141,87,0.1)",
                borderColor: "rgba(176,141,87,0.3)",
                color: "#b08d57",
              }}
            >
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#b08d57", boxShadow: "0 0 8px #b08d57" }} />
              Performance Analytics
            </div>
            <h1 className="text-4xl font-bold tracking-tight" style={{ color: "#eaeaea" }}>
              Research Analytics
            </h1>
            <p className="text-sm mt-1" style={{ color: "rgba(234,234,234,0.5)" }}>
              Comprehensive performance metrics and research distribution across all epochs
            </p>
          </div>

          {/* Filters */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1 p-1 rounded-xl" style={{ background: "#1c1c21", border: "1px solid #2a2f3a" }}>
              {(["7d", "30d", "all"] as const).map((r) => (
                <button
                  key={r}
                  onClick={() => setTimeRange(r)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                  style={{
                    background: timeRange === r ? "rgba(176,141,87,0.2)" : "transparent",
                    color: timeRange === r ? "#b08d57" : "rgba(234,234,234,0.5)",
                    fontFamily: "'Montserrat', sans-serif",
                  }}
                >
                  {r === "all" ? "All Time" : r}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* ── Summary Cards ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {loading ? (
            <>
              <Skeleton className="h-24 rounded-2xl" />
              <Skeleton className="h-24 rounded-2xl" />
              <Skeleton className="h-24 rounded-2xl" />
              <Skeleton className="h-24 rounded-2xl" />
            </>
          ) : overview ? (
            <>
              {/* Total Signals */}
              <div className="rounded-2xl p-4" style={{ background: "#1c1c21", border: "1px solid #2a2f3a" }}>
                <div className="text-xs uppercase tracking-wider mb-1" style={{ color: "rgba(234,234,234,0.4)" }}>
                  Total Signals
                </div>
                <div className="text-3xl font-bold" style={{ color: "#eaeaea" }}>
                  {overview.totalSignals.toLocaleString()}
                </div>
              </div>

              {/* Win Rate */}
              <div className="rounded-2xl p-4" style={{ background: "#1c1c21", border: "1px solid #2a2f3a" }}>
                <WinRateBar winRate={overview.winRate} />
              </div>

              {/* Avg Accuracy */}
              <div className="rounded-2xl p-4" style={{ background: "#1c1c21", border: "1px solid #2a2f3a" }}>
                <div className="text-xs uppercase tracking-wider mb-1" style={{ color: "rgba(234,234,234,0.4)" }}>
                  Avg Accuracy
                </div>
                <div
                  className="text-3xl font-bold"
                  style={{
                    color: overview.overallAccuracy >= 65 ? "#22c55e" : overview.overallAccuracy >= 50 ? "#f59e0b" : "#ef4444",
                  }}
                >
                  {overview.overallAccuracy.toFixed(1)}%
                </div>
              </div>

              {/* Total ZENT Distributed */}
              <div className="rounded-2xl p-4" style={{ background: "#1c1c21", border: "1px solid #2a2f3a" }}>
                <div className="text-xs uppercase tracking-wider mb-1" style={{ color: "rgba(234,234,234,0.4)" }}>
                  ZENT Distributed
                </div>
                <div className="text-3xl font-bold" style={{ color: "#b08d57" }}>
                  {parseFloat(overview.totalRewardsZent).toFixed(0)}
                </div>
                <div className="text-xs mt-1" style={{ color: "#ef4444" }}>
                  −{parseFloat(overview.totalSlashesZent).toFixed(0)} slashed
                </div>
              </div>
            </>
          ) : (
            <div className="col-span-4 text-center py-8 text-sm" style={{ color: "rgba(234,234,234,0.4)" }}>
              No data yet — signals will appear after the first epoch settles
            </div>
          )}
        </div>

        {/* ── Accuracy Over Time + Asset Class (side by side) ── */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <SectionCard title="Accuracy Over Time (Last 20 Epochs)" className="lg:col-span-3">
            {loading ? (
              <Skeleton className="h-56 rounded-xl" />
            ) : (
              <AccuracyOverTimeChart epochs={epochs} />
            )}
          </SectionCard>

          <SectionCard title="Asset Class Comparison" className="lg:col-span-2">
            {/* Asset filter */}
            <div className="flex gap-2 mb-4 flex-wrap">
              {["All", "CRYPTO", "EQUITY", "FOREX", "COMMODITY"].map((f) => (
                <button
                  key={f}
                  onClick={() => setAssetFilter(f)}
                  className="px-2 py-1 rounded text-xs font-medium transition-all"
                  style={{
                    background: assetFilter === f ? "rgba(176,141,87,0.15)" : "transparent",
                    border: `1px solid ${assetFilter === f ? "rgba(176,141,87,0.4)" : "#2a2f3a"}`,
                    color: assetFilter === f ? "#b08d57" : "rgba(234,234,234,0.4)",
                    fontFamily: "'Montserrat', sans-serif",
                  }}
                >
                  {f}
                </button>
              ))}
            </div>
            {loading ? <Skeleton className="h-48 rounded-xl" /> : <AssetClassChart data={filteredAssetClasses} />}
          </SectionCard>
        </div>

        {/* ── Distribution + Table (side by side) ── */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <SectionCard title="Accuracy Distribution" className="lg:col-span-2">
            {loading ? (
              <Skeleton className="h-44 rounded-xl" />
            ) : (
              <AccuracyHistogram signals={signals} />
            )}
          </SectionCard>

          <SectionCard title={`Recent Signals (${recentSignalsFiltered.length})`} className="lg:col-span-3">
            {loading ? (
              <Skeleton className="h-64 rounded-xl" />
            ) : (
              <SignalsTable signals={recentSignalsFiltered} />
            )}
          </SectionCard>
        </div>

        {/* ── Additional Stats Row ── */}
        {overview && !loading && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-2xl p-4 text-center" style={{ background: "#1c1c21", border: "1px solid #2a2f3a" }}>
              <div className="text-xs uppercase tracking-wider mb-1" style={{ color: "rgba(234,234,234,0.4)" }}>
                Unique Providers
              </div>
              <div className="text-2xl font-bold" style={{ color: "#b08d57" }}>
                {overview.uniqueProviders}
              </div>
            </div>
            <div className="rounded-2xl p-4 text-center" style={{ background: "#1c1c21", border: "1px solid #2a2f3a" }}>
              <div className="text-xs uppercase tracking-wider mb-1" style={{ color: "rgba(234,234,234,0.4)" }}>
                Best Asset Class
              </div>
              <div className="text-2xl font-bold" style={{ color: "#22c55e" }}>
                {overview.bestAssetClass}
              </div>
            </div>
            <div className="rounded-2xl p-4 text-center" style={{ background: "#1c1c21", border: "1px solid #2a2f3a" }}>
              <div className="text-xs uppercase tracking-wider mb-1" style={{ color: "rgba(234,234,234,0.4)" }}>
                Worst Asset Class
              </div>
              <div className="text-2xl font-bold" style={{ color: "#ef4444" }}>
                {overview.worstAssetClass}
              </div>
            </div>
            <div className="rounded-2xl p-4 text-center" style={{ background: "#1c1c21", border: "1px solid #2a2f3a" }}>
              <div className="text-xs uppercase tracking-wider mb-1" style={{ color: "rgba(234,234,234,0.4)" }}>
                Net ZENT P&L
              </div>
              <div
                className="text-2xl font-bold"
                style={{
                  color:
                    parseFloat(overview.totalRewardsZent) - parseFloat(overview.totalSlashesZent) >= 0
                      ? "#22c55e"
                      : "#ef4444",
                }}
              >
                {(parseFloat(overview.totalRewardsZent) - parseFloat(overview.totalSlashesZent)).toFixed(0)}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
