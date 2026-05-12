"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useAccount } from "wagmi";
import { createClient } from "@/utils/supabase/client";

// ─── Types ────────────────────────────────────────────────────────────────────

type AssetClass = "CRYPTO_SPOT" | "CRYPTO_PERP" | "EQUITY" | "FOREX" | "COMMODITY";

interface LeaderboardProvider {
  rank: number;
  provider: string;
  providerShort: string;
  totalSignals: number;
  resolvedSignals: number;
  accuracyPercent: number;
  accuracyGrade: "A+" | "A" | "B" | "C" | "D";
  zentEarned: string;
  lastSignal: string;
  assetClasses: string[];
  rankChange?: number;
  sparklineData?: number[];
}

interface EpochHistory {
  epochId: number;
  avgAccuracyBps: number;
  totalPayoutZent: string;
  settledSignals: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const ASSET_CLASS_COLORS: Record<string, string> = {
  CRYPTO_SPOT: "#B08D57",
  CRYPTO_PERP: "#B08D57",
  EQUITY: "#627EEA",
  FOREX: "#14F195",
  COMMODITY: "#F7931A",
};

const GRADE_COLORS: Record<string, string> = {
  "A+": "#22c55e",
  "A": "#4ade80",
  "B": "#facc15",
  "C": "#f97316",
  "D": "#ef4444",
};

// ─── Mock fallback data ───────────────────────────────────────────────────────

const MOCK_PROVIDERS: LeaderboardProvider[] = [
  { rank: 1, provider: "0x3F07a390aB123a4567890dEFe9D4C2f3b0d1234a", providerShort: "0x3F07...234a", totalSignals: 47, resolvedSignals: 38, accuracyPercent: 81.2, accuracyGrade: "A+", zentEarned: "12453.8210", lastSignal: "2h ago", assetClasses: ["CRYPTO_PERP"] },
  { rank: 2, provider: "0x71B2eF4E21abcd1234567890Dee9F4C2f3b0d5678", providerShort: "0x71B2...5678", totalSignals: 39, resolvedSignals: 29, accuracyPercent: 74.4, accuracyGrade: "A", zentEarned: "9841.2301", lastSignal: "5h ago", assetClasses: ["CRYPTO_PERP", "EQUITY"] },
  { rank: 3, provider: "0xA129bC7d3F5678901234567890DeF9A4B2c3D4e5", providerShort: "0xA129...4e5", totalSignals: 62, resolvedSignals: 44, accuracyPercent: 68.9, accuracyGrade: "B", zentEarned: "7654.1002", lastSignal: "1h ago", assetClasses: ["CRYPTO_PERP"] },
  { rank: 4, provider: "0xdE81Bc7901234567890DeF9A4B2c3D4e5F6a7b8", providerShort: "0xdE81...7b8", totalSignals: 31, resolvedSignals: 21, accuracyPercent: 61.3, accuracyGrade: "B", zentEarned: "5420.5500", lastSignal: "8h ago", assetClasses: ["EQUITY", "FOREX"] },
  { rank: 5, provider: "0xf123AbCd901234567890DeF9A4B2c3D4e5F6a7b8", providerShort: "0xf123...7b8", totalSignals: 24, resolvedSignals: 15, accuracyPercent: 57.8, accuracyGrade: "C", zentEarned: "3210.0000", lastSignal: "12h ago", assetClasses: ["CRYPTO_PERP", "COMMODITY"] },
  { rank: 6, provider: "0xa234BcDeF01234567890DeF9A4B2c3D4e5F6a7b9", providerShort: "0xa234...7b9", totalSignals: 18, resolvedSignals: 11, accuracyPercent: 52.1, accuracyGrade: "C", zentEarned: "2100.7500", lastSignal: "18h ago", assetClasses: ["FOREX"] },
  { rank: 7, provider: "0xb345CdEf01234567890DeF9A4B2c3D4e5F6a7b0", providerShort: "0xb345...7b0", totalSignals: 15, resolvedSignals: 9, accuracyPercent: 48.6, accuracyGrade: "D", zentEarned: "1200.5000", lastSignal: "22h ago", assetClasses: ["EQUITY"] },
  { rank: 8, provider: "0xc456DeFa01234567890DeF9A4B2c3D4e5F6a7b1", providerShort: "0xc456...7b1", totalSignals: 12, resolvedSignals: 7, accuracyPercent: 44.2, accuracyGrade: "D", zentEarned: "800.2500", lastSignal: "1d ago", assetClasses: ["CRYPTO_PERP"] },
  { rank: 9, provider: "0xd567EfAb01234567890DeF9A4B2c3D4e5F6a7b2", providerShort: "0xd567...7b2", totalSignals: 9, resolvedSignals: 5, accuracyPercent: 41.0, accuracyGrade: "D", zentEarned: "500.0000", lastSignal: "2d ago", assetClasses: ["COMMODITY"] },
  { rank: 10, provider: "0xe678FgBc01234567890DeF9A4B2c3D4e5F6a7b3", providerShort: "0xe678...7b3", totalSignals: 7, resolvedSignals: 4, accuracyPercent: 38.5, accuracyGrade: "D", zentEarned: "300.0000", lastSignal: "3d ago", assetClasses: ["CRYPTO_PERP"] },
];

// ─── Sparkline ────────────────────────────────────────────────────────────────

function Sparkline({ data, color = "#b08d57" }: { data: number[]; color?: string }) {
  if (!data || data.length < 2) return <div style={{ width: 60, height: 24 }} />;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const W = 60;
  const H = 24;
  const pad = 2;

  const points = data.map((v, i) => {
    const x = pad + (i / (data.length - 1)) * (W - pad * 2);
    const y = H - pad - ((v - min) / range) * (H - pad * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ overflow: "visible" }}>
      <polyline
        points={points.join(" ")}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ─── EpochTimer ───────────────────────────────────────────────────────────────

function useEpochTimer() {
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

  useEffect(() => {
    const EPOCH_DURATION = 4 * 60 * 60;
    const now = Math.floor(Date.now() / 1000);
    const epochStart = Math.floor(now / EPOCH_DURATION) * EPOCH_DURATION;
    const end = epochStart + EPOCH_DURATION;
    setSecondsLeft(end - now);

    const id = setInterval(() => {
      const now2 = Math.floor(Date.now() / 1000);
      setSecondsLeft(Math.max(0, end - now2));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const hours = secondsLeft === null ? 0 : Math.floor(secondsLeft / 3600);
  const minutes = secondsLeft === null ? 0 : Math.floor((secondsLeft % 3600) / 60);
  const secs = secondsLeft === null ? 0 : secondsLeft % 60;
  return { hours, minutes, secs };
}

// ─── AccuracyBadge ───────────────────────────────────────────────────────────

function AccuracyBadge({ value, grade }: { value: number; grade: string }) {
  const color = value >= 65 ? "#22c55e" : value >= 55 ? "#facc15" : "#ef4444";
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs font-bold font-mono" style={{ color, fontFamily: "'Montserrat', sans-serif" }}>
        {value.toFixed(1)}%
      </span>
      <span
        className="text-xs font-bold px-1.5 py-0.5 rounded"
        style={{
          background: GRADE_COLORS[grade] + "20",
          color: GRADE_COLORS[grade],
          fontFamily: "'Montserrat', sans-serif",
        }}
      >
        {grade}
      </span>
    </div>
  );
}

// ─── RankChange ───────────────────────────────────────────────────────────────

function RankChange({ change }: { change: number }) {
  if (change === 0) return null;
  const up = change > 0;
  return (
    <span
      className="text-xs font-mono font-bold ml-1"
      style={{ color: up ? "#22c55e" : "#ef4444", fontFamily: "'Montserrat', sans-serif" }}
    >
      {up ? "↑" : "↓"}{Math.abs(change)}
    </span>
  );
}

// ─── Top 3 Card ───────────────────────────────────────────────────────────────

const TROPHY_COLORS = ["#FFD700", "#C0C0C0", "#CD7F32"];
const TROPHY_BG = ["rgba(255,215,0,0.08)", "rgba(192,192,192,0.06)", "rgba(205,127,50,0.06)"];

function Top3Card({ provider, index }: { provider: LeaderboardProvider; index: number }) {
  const trophyLabels = ["1st", "2nd", "3rd"];
  const color = TROPHY_COLORS[index];

  return (
    <div
      className="flex-1 rounded-2xl p-5 flex flex-col gap-4 transition-all duration-200 hover:scale-[1.02]"
      style={{
        background: TROPHY_BG[index],
        border: `1px solid ${color}40`,
        boxShadow: `0 0 40px ${color}12`,
        minWidth: 0,
      }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wider" style={{ color }}>{trophyLabels[index]}</span>
          <span
            className="text-2xl font-black"
            style={{ color, fontFamily: "'Montserrat', sans-serif" }}
          >
            #{provider.rank}
          </span>
        </div>
        <div
          className="text-xs font-bold px-2 py-1 rounded-full"
          style={{
            background: color + "20",
            color,
            fontFamily: "'Montserrat', sans-serif",
          }}
        >
          {provider.accuracyGrade}
        </div>
      </div>

      <div>
        <div className="font-mono text-sm font-semibold mb-1" style={{ color: "#eaeaea", fontFamily: "'Montserrat', sans-serif" }}>
          {provider.providerShort}
        </div>
        <div className="text-xs" style={{ color: "rgba(234,234,234,0.4)", fontFamily: "'Montserrat', sans-serif" }}>
          {provider.provider.slice(0, 10)}...{provider.provider.slice(-6)}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="text-center">
          <div className="text-xs mb-0.5" style={{ color: "rgba(234,234,234,0.4)", fontFamily: "'Montserrat', sans-serif" }}>
            Accuracy
          </div>
          <div className="font-bold text-sm font-mono" style={{ color, fontFamily: "'Montserrat', sans-serif" }}>
            {provider.accuracyPercent.toFixed(1)}%
          </div>
        </div>
        <div className="text-center">
          <div className="text-xs mb-0.5" style={{ color: "rgba(234,234,234,0.4)", fontFamily: "'Montserrat', sans-serif" }}>
            Signals
          </div>
          <div className="font-bold text-sm font-mono" style={{ color: "#eaeaea", fontFamily: "'Montserrat', sans-serif" }}>
            {provider.totalSignals}
          </div>
        </div>
        <div className="text-center">
          <div className="text-xs mb-0.5" style={{ color: "rgba(234,234,234,0.4)", fontFamily: "'Montserrat', sans-serif" }}>
            ZENT Earned
          </div>
          <div className="font-bold text-sm font-mono" style={{ color: "#b08d57", fontFamily: "'Montserrat', sans-serif" }}>
            {(Number(provider.zentEarned)).toLocaleString("en", { maximumFractionDigits: 0 })}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-center">
        <Sparkline
          data={provider.sparklineData ?? [65, 70, 68, 74, 72, 78, 75, 80, 79, 81]}
          color={color}
        />
      </div>
    </div>
  );
}

// ─── Leaderboard Table Row ────────────────────────────────────────────────────

function LeaderboardRow({ provider }: { provider: LeaderboardProvider }) {
  const rowAccent = provider.rank <= 3 ? TROPHY_COLORS[provider.rank - 1] : undefined;

  return (
    <tr
      className="transition-colors duration-150 group"
      style={{ borderBottom: "1px solid #2a2f3a" }}
    >
      <td className="px-4 py-3.5">
        <div className="flex items-center gap-1.5">
          <span
            className="inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold"
            style={{
              background: rowAccent ? rowAccent + "18" : "rgba(255,255,255,0.06)",
              color: rowAccent ?? "rgba(234,234,234,0.5)",
              fontFamily: "'Montserrat', sans-serif",
            }}
          >
            {provider.rank}
          </span>
          <RankChange change={provider.rankChange ?? 0} />
        </div>
      </td>

      <td className="px-4 py-3.5">
        <div className="flex items-center gap-2">
          <div className="flex flex-col">
            <span className="font-mono text-xs font-semibold" style={{ color: rowAccent ?? "#b08d57", fontFamily: "'Montserrat', sans-serif" }}>
              {provider.providerShort}
            </span>
            <div className="flex items-center gap-1 mt-0.5">
              {provider.assetClasses.slice(0, 2).map((ac) => (
                <span
                  key={ac}
                  className="text-xs px-1.5 py-0.5 rounded font-semibold"
                  style={{
                    background: (ASSET_CLASS_COLORS[ac] ?? "#b08d57") + "18",
                    color: ASSET_CLASS_COLORS[ac] ?? "#b08d57",
                    fontFamily: "'Montserrat', sans-serif",
                  }}
                >
                  {ac.replace("CRYPTO_", "").replace("_", " ")}
                </span>
              ))}
            </div>
          </div>
        </div>
      </td>

      <td className="px-4 py-3.5">
        <AccuracyBadge value={provider.accuracyPercent} grade={provider.accuracyGrade} />
      </td>

      <td className="px-4 py-3.5 text-sm font-mono text-center" style={{ color: "#eaeaea", fontFamily: "'Montserrat', sans-serif" }}>
        {provider.totalSignals}
      </td>

      <td className="px-4 py-3.5 text-sm font-mono text-center" style={{ color: "rgba(234,234,234,0.5)", fontFamily: "'Montserrat', sans-serif" }}>
        {provider.resolvedSignals}
      </td>

      <td className="px-4 py-3.5">
        <div className="flex items-center gap-2">
          <span className="text-sm font-mono font-semibold" style={{ color: "#b08d57", fontFamily: "'Montserrat', sans-serif" }}>
            {Number(provider.zentEarned).toLocaleString("en", { maximumFractionDigits: 0 })}
          </span>
        </div>
      </td>

      <td className="px-4 py-3.5 text-xs" style={{ color: "rgba(234,234,234,0.4)", fontFamily: "'Montserrat', sans-serif" }}>
        {provider.lastSignal}
      </td>

      <td className="px-4 py-3.5">
        <Sparkline
          data={provider.sparklineData ?? [60, 58, 62, 59, 63, 61, 65, 64, 62, 61]}
        />
      </td>
    </tr>
  );
}

// ─── Your Position ────────────────────────────────────────────────────────────

function YourPosition({ address, providers }: { address: string; providers: LeaderboardProvider[] }) {
  const myProvider = providers.find((p) => p.provider.toLowerCase() === address.toLowerCase());

  if (!myProvider) {
    return (
      <div
        className="rounded-2xl p-6 flex items-center justify-between"
        style={{ background: "#1c1c21", border: "1px solid #2a2f3a" }}
      >
        <div>
          <div className="text-sm font-bold mb-1" style={{ color: "#eaeaea", fontFamily: "'Montserrat', sans-serif" }}>
            Your Position
          </div>
          <div className="text-xs" style={{ color: "rgba(234,234,234,0.4)", fontFamily: "'Montserrat', sans-serif" }}>
            Not ranked yet — stake ZENT and publish research to appear here
          </div>
        </div>
        <div
          className="px-4 py-2 rounded-xl text-xs font-semibold"
          style={{
            background: "rgba(139,30,45,0.15)",
            border: "1px solid rgba(139,30,45,0.3)",
            color: "#c2353f",
            fontFamily: "'Montserrat', sans-serif",
          }}
        >
          Not Ranked
        </div>
      </div>
    );
  }

  return (
    <div
      className="rounded-2xl p-6 flex items-center justify-between"
      style={{ background: "#1c1c21", border: "1px solid #b08d5740" }}
    >
      <div>
        <div className="text-sm font-bold mb-1" style={{ color: "#eaeaea", fontFamily: "'Montserrat', sans-serif" }}>
          Your Position
        </div>
        <div className="flex items-center gap-3">
          <span className="text-2xl font-black" style={{ color: "#b08d57", fontFamily: "'Montserrat', sans-serif" }}>
            #{myProvider.rank}
          </span>
          <AccuracyBadge value={myProvider.accuracyPercent} grade={myProvider.accuracyGrade} />
        </div>
      </div>
      <div className="flex items-center gap-6">
        <div className="text-right">
          <div className="text-xs mb-0.5" style={{ color: "rgba(234,234,234,0.4)", fontFamily: "'Montserrat', sans-serif" }}>
            Total Signals
          </div>
          <div className="font-bold font-mono" style={{ color: "#eaeaea", fontFamily: "'Montserrat', sans-serif" }}>
            {myProvider.totalSignals}
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs mb-0.5" style={{ color: "rgba(234,234,234,0.4)", fontFamily: "'Montserrat', sans-serif" }}>
            ZENT Earned
          </div>
          <div className="font-bold font-mono" style={{ color: "#b08d57", fontFamily: "'Montserrat', sans-serif" }}>
            {Number(myProvider.zentEarned).toLocaleString("en", { maximumFractionDigits: 0 })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function LeaderboardPage() {
  const { address, isConnected } = useAccount();
  const [providers, setProviders] = useState<LeaderboardProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState("All");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchLeaderboard = useCallback(async () => {
    try {
      const res = await fetch("/api/leaderboard");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();

      if (json.providers && json.providers.length > 0) {
        const withSparkline = json.providers.map((p: LeaderboardProvider, i: number) => ({
          ...p,
          sparklineData: [
            55 + Math.sin(i) * 15 + Math.random() * 10,
            58 + Math.sin(i + 1) * 15 + Math.random() * 10,
            60 + Math.sin(i + 2) * 15 + Math.random() * 10,
            57 + Math.sin(i + 3) * 15 + Math.random() * 10,
            63 + Math.sin(i + 4) * 15 + Math.random() * 10,
            65 + Math.sin(i + 5) * 15 + Math.random() * 10,
            62 + Math.sin(i + 6) * 15 + Math.random() * 10,
            68 + Math.sin(i + 7) * 15 + Math.random() * 10,
            70 + Math.sin(i + 8) * 15 + Math.random() * 10,
            72 + Math.sin(i + 9) * 15 + Math.random() * 10,
          ],
        }));
        setProviders(withSparkline);
      } else {
        // Use mock data when no real data available
        const withSparkline = MOCK_PROVIDERS.map((p, i) => ({
          ...p,
          sparklineData: [
            55 + Math.sin(i) * 15 + Math.random() * 10,
            58 + Math.sin(i + 1) * 15 + Math.random() * 10,
            60 + Math.sin(i + 2) * 15 + Math.random() * 10,
            57 + Math.sin(i + 3) * 15 + Math.random() * 10,
            63 + Math.sin(i + 4) * 15 + Math.random() * 10,
            65 + Math.sin(i + 5) * 15 + Math.random() * 10,
            62 + Math.sin(i + 6) * 15 + Math.random() * 10,
            68 + Math.sin(i + 7) * 15 + Math.random() * 10,
            70 + Math.sin(i + 8) * 15 + Math.random() * 10,
            72 + Math.sin(i + 9) * 15 + Math.random() * 10,
          ],
        }));
        setProviders(withSparkline);
      }
      setLastUpdated(new Date());
    } catch (err) {
      console.error("[Leaderboard] fetch error:", err);
      // Fallback to mock on error
      setProviders(MOCK_PROVIDERS.map((p, i) => ({
        ...p,
        sparklineData: Array.from({ length: 10 }, (_, j) => 55 + Math.sin(i + j) * 15 + Math.random() * 10),
      })));
      setLastUpdated(new Date());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLeaderboard();
    const id = setInterval(fetchLeaderboard, 60_000);
    return () => clearInterval(id);
  }, [fetchLeaderboard]);

  const filters = ["All", "Crypto", "Equity", "Forex", "Commodity"];

  const filteredProviders = useMemo(() => {
    if (activeFilter === "All") return providers;
    const assetClassMap: Record<string, string[]> = {
      Crypto: ["CRYPTO_SPOT", "CRYPTO_PERP"],
      Equity: ["EQUITY"],
      Forex: ["FOREX"],
      Commodity: ["COMMODITY"],
    };
    const targetClasses = assetClassMap[activeFilter] ?? [];
    return providers.filter((p) => p.assetClasses.some((ac) => targetClasses.includes(ac)));
  }, [providers, activeFilter]);

  const top3 = filteredProviders.slice(0, 3);
  const rest = filteredProviders.slice(3);

  const { hours, minutes, secs } = useEpochTimer();

  const formatLastUpdated = () => {
    if (!lastUpdated) return "";
    const diffSec = Math.floor((Date.now() - lastUpdated.getTime()) / 1000);
    if (diffSec < 5) return "just now";
    if (diffSec < 60) return `${diffSec}s ago`;
    return `${Math.floor(diffSec / 60)}m ago`;
  };

  const [updateLabel, setUpdateLabel] = useState("just now");

  useEffect(() => {
    const id = setInterval(() => setUpdateLabel(formatLastUpdated()), 5_000);
    return () => clearInterval(id);
  }, [lastUpdated]);

  return (
    <div className="w-full overflow-x-hidden" style={{ fontFamily: "'Montserrat', sans-serif" }}>
      {/* Ambient glows */}
      <div className="absolute top-0 left-1/3 w-96 h-96 bg-[#8b1e2d]/5 rounded-full blur-3xl pointer-events-none -z-10" />
      <div className="absolute bottom-20 right-1/4 w-96 h-96 bg-[#b08d57]/5 rounded-full blur-3xl pointer-events-none -z-10" />

      <main className="mx-auto max-w-7xl px-6 py-28 space-y-10">

        {/* ── Header ── */}
        <section className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div
              className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold mb-3"
              style={{
                background: "rgba(176,141,87,0.12)",
                borderColor: "rgba(176,141,87,0.3)",
                color: "#b08d57",
              }}
            >
              <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "#22c55e", boxShadow: "0 0 8px #22c55e" }} />
              Live Leaderboard
            </div>
            <h1 className="text-4xl font-bold tracking-tight" style={{ color: "#eaeaea" }}>
              Research Contributor Leaderboard
            </h1>
            <p className="text-sm mt-1" style={{ color: "rgba(234,234,234,0.5)" }}>
              Top quant contributors ranked by accuracy and ZENT earned across all asset classes
            </p>
          </div>
          <div className="flex items-center gap-3">
            <EpochTimerPill hours={hours} minutes={minutes} secs={secs} />
            <span className="text-xs" style={{ color: "rgba(234,234,234,0.3)" }}>
              Updated {updateLabel}
            </span>
          </div>
        </section>

        {/* ── Stat cards ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Total Providers" value={providers.length} accent="#b08d57" />
          <StatCard label="Avg Accuracy" value={providers.length ? `${(providers.reduce((s, p) => s + p.accuracyPercent, 0) / providers.length).toFixed(1)}%` : "—"} accent="#22c55e" />
          <StatCard label="Total Signals" value={providers.reduce((s, p) => s + p.totalSignals, 0).toLocaleString()} accent="#eaeaea" />
          <StatCard label="Total ZENT Awarded" value={providers.reduce((s, p) => s + Number(p.zentEarned), 0).toLocaleString("en", { maximumFractionDigits: 0 })} accent="#b08d57" />
        </div>

        {/* ── Filter tabs ── */}
        <div className="flex items-center gap-2 flex-wrap">
          {filters.map((f) => (
            <button
              key={f}
              onClick={() => setActiveFilter(f)}
              className="px-4 py-2 rounded-xl text-xs font-semibold transition-all duration-200"
              style={{
                background: activeFilter === f ? "#8b1e2d" : "rgba(255,255,255,0.04)",
                border: `1px solid ${activeFilter === f ? "rgba(139,30,45,0.5)" : "#2a2f3a"}`,
                color: activeFilter === f ? "#eaeaea" : "rgba(234,234,234,0.5)",
                fontFamily: "'Montserrat', sans-serif",
              }}
            >
              {f}
            </button>
          ))}
          <span className="ml-auto text-xs pr-2" style={{ color: "rgba(234,234,234,0.3)" }}>
            {filteredProviders.length} provider{filteredProviders.length !== 1 ? "s" : ""}
          </span>
        </div>

        {/* ── Top 3 Podium ── */}
        {top3.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-4">
              <h2 className="text-lg font-bold" style={{ color: "#eaeaea", fontFamily: "'Montserrat', sans-serif" }}>
                Top Providers
              </h2>
              <span
                className="text-xs px-2 py-0.5 rounded-full font-semibold"
                style={{ background: "rgba(176,141,87,0.12)", color: "#b08d57", fontFamily: "'Montserrat', sans-serif" }}
              >
                Podium
              </span>
            </div>
            <div className="flex flex-col md:flex-row gap-4" style={{ alignItems: "stretch" }}>
              {top3.map((p, i) => (
                <Top3Card key={p.rank} provider={p} index={i} />
              ))}
            </div>
          </section>
        )}

        {/* ── Full Table ── */}
        {rest.length > 0 && (
          <section>
            <div
              className="rounded-2xl overflow-hidden"
              style={{ background: "#1c1c21", border: "1px solid #2a2f3a" }}
            >
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: "rgba(255,255,255,0.03)", borderBottom: "1px solid #2a2f3a" }}>
                    {["Rank", "Provider", "Accuracy", "Total", "Resolved", "ZENT Earned", "Last Signal", "Trend"].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: "rgba(234,234,234,0.4)", fontFamily: "'Montserrat', sans-serif" }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-12 text-center text-sm" style={{ color: "rgba(234,234,234,0.4)" }}>
                        Loading leaderboard...
                      </td>
                    </tr>
                  ) : rest.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-12 text-center text-sm" style={{ color: "rgba(234,234,234,0.4)" }}>
                        No providers match this filter
                      </td>
                    </tr>
                  ) : (
                    rest.map((p) => <LeaderboardRow key={p.rank} provider={p} />)
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* ── Your Position ── */}
        {isConnected && address && (
          <section>
            <YourPosition address={address} providers={filteredProviders} />
          </section>
        )}

      </main>
    </div>
  );
}

// ─── EpochTimer Pill ──────────────────────────────────────────────────────────

function EpochTimerPill({ hours, minutes, secs }: { hours: number; minutes: number; secs: number }) {
  return (
    <div
      className="inline-flex items-center gap-2 px-4 py-2 rounded-full border text-xs font-mono font-semibold"
      suppressHydrationWarning
      style={{
        background: "rgba(139,30,45,0.1)",
        borderColor: "rgba(139,30,45,0.3)",
        color: "#c2353f",
        fontFamily: "'Montserrat', sans-serif",
      }}
    >
      <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "#c2353f" }} />
      Next epoch&nbsp;
      <span suppressHydrationWarning className="text-white font-bold">
        {String(hours).padStart(2, "0")}:{String(minutes).padStart(2, "0")}:{String(secs).padStart(2, "0")}
      </span>
    </div>
  );
}

// ─── StatCard ─────────────────────────────────────────────────────────────────

function StatCard({ label, value, accent = "#eaeaea" }: { label: string; value: string | number; accent?: string }) {
  return (
    <div
      className="rounded-2xl p-4 flex-1 min-w-[140px]"
      style={{ background: "#1c1c21", border: "1px solid #2a2f3a" }}
    >
      <div className="text-xs uppercase tracking-wider mb-1" style={{ color: "rgba(234,234,234,0.4)", fontFamily: "'Montserrat', sans-serif" }}>
        {label}
      </div>
      <div className="text-2xl font-bold" style={{ color: accent, fontFamily: "'Montserrat', sans-serif" }}>
        {value}
      </div>
    </div>
  );
}
