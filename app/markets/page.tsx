"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { createPublicClient, formatUnits, http, parseAbi } from "viem";
import { addresses, VAULT_ABI, HYPEREVM_TESTNET } from "@/lib/contracts";
import { createClient } from "@/utils/supabase/client";
import type { NextPage } from "next";

// ─── Types ────────────────────────────────────────────────────────────────────

type AssetClass = "CRYPTO_SPOT" | "CRYPTO_PERP" | "EQUITY" | "FOREX" | "COMMODITY";

interface Market {
  id: string;
  name: string;
  symbol: string;
  assetClass: AssetClass;
  exchange: string;
  providerCount: number;
  avgAccuracy: number;
  sharpe: number;
  emoji: string;
}

interface RecentSignal {
  id: string;
  provider: string;
  market: string;
  direction: "BUY" | "SELL";
  price: number;
  confidence: number;
  time: string;
  assetClass: AssetClass;
}

interface TopContributor {
  rank: number;
  address: string;
  accuracy: number;
  research: number;
  zentStaked: number;
}

// ─── Mock data ────────────────────────────────────────────────────────────────

const MOCK_MARKETS: Market[] = [
  { id: "btc-perp", name: "Bitcoin Perpetual", symbol: "BTC-PERP", assetClass: "CRYPTO_PERP", exchange: "Hyperliquid", providerCount: 12, avgAccuracy: 67, sharpe: 1.4, emoji: "₿" },
  { id: "eth-perp", name: "Ethereum Perpetual", symbol: "ETH-PERP", assetClass: "CRYPTO_PERP", exchange: "Hyperliquid", providerCount: 9, avgAccuracy: 61, sharpe: 1.2, emoji: "Ξ" },
  { id: "sol-perp", name: "Solana Perpetual", symbol: "SOL-PERP", assetClass: "CRYPTO_PERP", exchange: "Hyperliquid", providerCount: 7, avgAccuracy: 58, sharpe: 0.9, emoji: "◎" },
  { id: "xrp-perp", name: "XRP Perpetual", symbol: "XRP-PERP", assetClass: "CRYPTO_PERP", exchange: "Hyperliquid", providerCount: 5, avgAccuracy: 54, sharpe: 0.7, emoji: "✕" },
  { id: "aapl", name: "Apple Inc.", symbol: "AAPL", assetClass: "EQUITY", exchange: "Ondo/Synthetix", providerCount: 4, avgAccuracy: 55, sharpe: 0.9, emoji: "" },
  { id: "msft", name: "Microsoft Corp.", symbol: "MSFT", assetClass: "EQUITY", exchange: "Ondo/Synthetix", providerCount: 3, avgAccuracy: 52, sharpe: 0.8, emoji: "Ⓜ" },
  { id: "eur-usd", name: "Euro / US Dollar", symbol: "EUR/USD", assetClass: "FOREX", exchange: "Chainlink", providerCount: 3, avgAccuracy: 58, sharpe: 1.1, emoji: "" },
  { id: "gbp-usd", name: "British Pound / USD", symbol: "GBP/USD", assetClass: "FOREX", exchange: "Chainlink", providerCount: 2, avgAccuracy: 56, sharpe: 1.0, emoji: "" },
  { id: "gold", name: "Gold / US Dollar", symbol: "XAU/USD", assetClass: "COMMODITY", exchange: "Chainlink", providerCount: 2, avgAccuracy: 52, sharpe: 0.8, emoji: "" },
  { id: "silver", name: "Silver / US Dollar", symbol: "XAG/USD", assetClass: "COMMODITY", exchange: "Chainlink", providerCount: 1, avgAccuracy: 49, sharpe: 0.6, emoji: "" },
];

const ASSET_CLASS_COLORS: Record<AssetClass, string> = {
  CRYPTO_SPOT: "#B08D57",
  CRYPTO_PERP: "#B08D57",
  EQUITY: "#627EEA",
  FOREX: "#14F195",
  COMMODITY: "#F7931A",
};

const ASSET_CLASS_LABELS: Record<AssetClass, string> = {
  CRYPTO_SPOT: "Crypto Spot",
  CRYPTO_PERP: "Crypto Perp",
  EQUITY: "Equity",
  FOREX: "Forex",
  COMMODITY: "Commodity",
};

const ASSET_CLASS_FILTER_LABELS: Record<string, string> = {
  All: "All",
  Crypto: "Crypto",
  Equity: "Equity",
  Forex: "Forex",
  Commodity: "Commodity",
};

// ─── Hooks ────────────────────────────────────────────────────────────────────

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
  return { hours, minutes, secs, total: secondsLeft ?? 0 };
}

function useRecentSignals() {
  const [signals, setSignals] = useState<RecentSignal[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSignals = useCallback(async () => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("signals")
      .select("id, provider, asset, direction, price, created_at")
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) {
      console.error("[fetchSignals] Supabase error:", error.message);
      setLoading(false);
      return;
    }

    const dataArr = data ?? [];
    if (dataArr.length > 0) {
      const mapped: RecentSignal[] = dataArr.map((s) => {
        const assetLower = (s.asset ?? "").toLowerCase();
        const market = MOCK_MARKETS.find((m) =>
          m.symbol.toLowerCase().startsWith(assetLower) ||
          assetLower.startsWith(m.symbol.toLowerCase().replace("-perp", "").replace("-spot", ""))
        );
        const hoursAgo = s.created_at
          ? Math.floor((Date.now() - new Date(s.created_at).getTime()) / 3600000)
          : 0;
        return {
          id: s.id,
          provider: s.provider === "gp" ? "Genesis Pulse" : s.provider === "lumibot" ? "Lumibot" : "Manual",
          market: market?.symbol ?? `${s.asset}-PERP`,
          direction: s.direction === "LONG" ? "BUY" : s.direction === "SHORT" ? "SELL" : "BUY",
          price: s.price ?? 0,
          confidence: market?.avgAccuracy ?? 65,
          time: hoursAgo <= 0 ? "<1h ago" : `${hoursAgo}h ago`,
          assetClass: market?.assetClass ?? "CRYPTO_PERP",
        };
      });
      setSignals(mapped);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchSignals();
    const id = setInterval(fetchSignals, 30_000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // fetchSignals is stable via useCallback

  return { signals, loading };
}

function useTopContributors() {
  const [contributors, setContributors] = useState<TopContributor[]>([]);

  useEffect(() => {
    // Mock top contributors — in production, read from provider_stats table
    setContributors([
      { rank: 1, address: "0x3F07...a390a", accuracy: 78, research: 24, zentStaked: 12000 },
      { rank: 2, address: "0x71B2...f4E21", accuracy: 71, research: 18, zentStaked: 8500 },
      { rank: 3, address: "0xA129...3Cb7d", accuracy: 65, research: 31, zentStaked: 6200 },
      { rank: 4, address: "0xdE81...9AaBc", accuracy: 59, research: 15, zentStaked: 4100 },
      { rank: 5, address: "0xf123...5CdEf", accuracy: 54, research: 9, zentStaked: 2800 },
    ]);
  }, []);

  return contributors;
}

// ─── Accuracy badge ───────────────────────────────────────────────────────────

function AccuracyBadge({ value }: { value: number }) {
  const color = value >= 65 ? "#22c55e" : value >= 50 ? "#f59e0b" : "#ef4444";
  return (
    <span
      className="text-xs font-bold font-mono"
      style={{ color, fontFamily: "'Montserrat', sans-serif" }}
    >
      {value}%
    </span>
  );
}

// ─── EpochTimer ───────────────────────────────────────────────────────────────

function EpochTimer() {
  const { hours, minutes, secs } = useEpochTimer();

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
      Next epoch in&nbsp;
      <span suppressHydrationWarning className="text-white font-bold">
        {String(hours).padStart(2, "0")}:{String(minutes).padStart(2, "0")}:{String(secs).padStart(2, "0")}
      </span>
    </div>
  );
}

// ─── MarketCard ───────────────────────────────────────────────────────────────

function MarketCard({ market, onViewResearch }: { market: Market; onViewResearch: (symbol: string) => void }) {
  const color = ASSET_CLASS_COLORS[market.assetClass];

  return (
    <div
      className="p-5 rounded-2xl flex flex-col gap-4 transition-all duration-200 hover:scale-[1.01] cursor-pointer group"
      style={{
        background: "#1c1c21",
        border: "1px solid #2a2f3a",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.borderColor = color + "60";
        (e.currentTarget as HTMLDivElement).style.boxShadow = `0 0 30px ${color}18`;
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.borderColor = "#2a2f3a";
        (e.currentTarget as HTMLDivElement).style.boxShadow = "none";
      }}
    >
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-xl font-bold"
            style={{ background: color + "18", border: `1px solid ${color}40`, fontFamily: "'Montserrat', sans-serif" }}
          >
            {market.emoji}
          </div>
          <div>
            <div className="font-semibold text-sm" style={{ color: "#eaeaea", fontFamily: "'Montserrat', sans-serif" }}>
              {market.symbol}
            </div>
            <div className="text-xs" style={{ color: "rgba(234,234,234,0.4)", fontFamily: "'Montserrat', sans-serif" }}>
              {market.exchange}
            </div>
          </div>
        </div>
        <span
          className="px-2 py-0.5 rounded-full text-xs font-semibold border"
          style={{
            background: color + "18",
            borderColor: color + "40",
            color: color,
            fontFamily: "'Montserrat', sans-serif",
          }}
        >
          {ASSET_CLASS_LABELS[market.assetClass]}
        </span>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2">
        <div className="text-center">
          <div className="text-xs mb-0.5" style={{ color: "rgba(234,234,234,0.4)", fontFamily: "'Montserrat', sans-serif" }}>
            Providers
          </div>
          <div className="font-bold text-sm" style={{ color: "#eaeaea", fontFamily: "'Montserrat', sans-serif" }}>
            {market.providerCount}
          </div>
        </div>
        <div className="text-center">
          <div className="text-xs mb-0.5" style={{ color: "rgba(234,234,234,0.4)", fontFamily: "'Montserrat', sans-serif" }}>
            Accuracy
          </div>
          <AccuracyBadge value={market.avgAccuracy} />
        </div>
        <div className="text-center">
          <div className="text-xs mb-0.5" style={{ color: "rgba(234,234,234,0.4)", fontFamily: "'Montserrat', sans-serif" }}>
            Sharpe
          </div>
          <div className="font-bold text-sm font-mono" style={{ color: "#b08d57", fontFamily: "'Montserrat', sans-serif" }}>
            {market.sharpe.toFixed(1)}
          </div>
        </div>
      </div>

      {/* CTA */}
      <button
        onClick={() => onViewResearch(market.symbol)}
        className="w-full py-2 rounded-xl text-xs font-semibold transition-all duration-200 hover:scale-[1.02]"
        style={{
          background: color + "15",
          border: `1px solid ${color}40`,
          color: color,
          fontFamily: "'Montserrat', sans-serif",
        }}
      >
        View Research
      </button>
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

// ─── TopContributors ─────────────────────────────────────────────────────────────

function TopContributors({ contributors }: { contributors: TopContributor[] }) {
  return (
    <section>
      <div className="flex items-center gap-2 mb-4">
        <h2 className="text-lg font-bold" style={{ color: "#eaeaea", fontFamily: "'Montserrat', sans-serif" }}>
          Top Contributors This Epoch
        </h2>
      </div>
      <div
        className="rounded-2xl overflow-hidden"
        style={{ background: "#1c1c21", border: "1px solid #2a2f3a" }}
      >
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: "rgba(255,255,255,0.03)", borderBottom: "1px solid #2a2f3a" }}>
              {["Rank", "Contributor", "Accuracy", "Research", "ZENT Staked"].map((h) => (
                <th key={h} className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: "rgba(234,234,234,0.4)", fontFamily: "'Montserrat', sans-serif" }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {contributors.map((p, i) => (
              <tr
                key={p.rank}
                style={{ borderBottom: i < contributors.length - 1 ? "1px solid #2a2f3a" : undefined }}
              >
                <td className="px-5 py-3.5">
                  <span
                    className="inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold"
                    style={{
                      background: p.rank === 1 ? "rgba(255,215,0,0.15)" : p.rank === 2 ? "rgba(192,192,192,0.12)" : p.rank === 3 ? "rgba(205,127,50,0.12)" : "rgba(255,255,255,0.06)",
                      color: p.rank === 1 ? "#ffd700" : p.rank === 2 ? "#c0c0c0" : p.rank === 3 ? "#cd7f32" : "rgba(234,234,234,0.5)",
                      fontFamily: "'Montserrat', sans-serif",
                    }}
                  >
                    {p.rank}
                  </span>
                </td>
                <td className="px-5 py-3.5 font-mono text-xs" style={{ color: "#b08d57", fontFamily: "'Montserrat', sans-serif" }}>
                  {p.address}
                </td>
                <td className="px-5 py-3.5">
                  <AccuracyBadge value={p.accuracy} />
                </td>
                <td className="px-5 py-3.5 text-sm font-mono" style={{ color: "#eaeaea", fontFamily: "'Montserrat', sans-serif" }}>
                  {p.research}
                </td>
                <td className="px-5 py-3.5 text-sm font-mono" style={{ color: "#b08d57", fontFamily: "'Montserrat', sans-serif" }}>
                  {p.zentStaked.toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// ─── SSR-disabled wrapper to avoid hydration mismatch ──────────────────────────
const LiveSignalFeedNoSSR = dynamic(() => import("./LiveSignalFeedWrapper"), { ssr: false });

// ─── Page ─────────────────────────────────────────────────────────────────────

const MarketsPage: NextPage = () => {
  const router = useRouter();
  const [activeFilter, setActiveFilter] = useState("All");
  const { signals } = useRecentSignals();
  const contributors = useTopContributors();

  const filters = ["All", "Crypto", "Equity", "Forex", "Commodity"];

  const filteredMarkets = useMemo(() => {
    if (activeFilter === "All") return MOCK_MARKETS;
    return MOCK_MARKETS.filter((m) => {
      if (activeFilter === "Crypto") return m.assetClass === "CRYPTO_SPOT" || m.assetClass === "CRYPTO_PERP";
      if (activeFilter === "Equity") return m.assetClass === "EQUITY";
      if (activeFilter === "Forex") return m.assetClass === "FOREX";
      if (activeFilter === "Commodity") return m.assetClass === "COMMODITY";
      return true;
    });
  }, [activeFilter]);

  function handleViewResearch(symbol: string) {
    router.push(`/research?market=${encodeURIComponent(symbol)}`);
  }

  const totalProviders = MOCK_MARKETS.reduce((sum, m) => sum + m.providerCount, 0);
  const avgAccuracy = Math.round(MOCK_MARKETS.reduce((sum, m) => sum + m.avgAccuracy, 0) / MOCK_MARKETS.length);

  return (
    <div className="w-full overflow-x-hidden" style={{ fontFamily: "'Montserrat', sans-serif" }}>
      {/* Ambient glows */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-[#8b1e2d]/5 rounded-full blur-3xl pointer-events-none -z-10" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-[#b08d57]/5 rounded-full blur-3xl pointer-events-none -z-10" />

      <main className="mx-auto max-w-7xl px-6 py-28 space-y-10">

        {/* ── Header ── */}
        <section className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div
              className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold mb-3"
              style={{
                background: "rgba(139, 30, 45, 0.15)",
                borderColor: "rgba(139, 30, 45, 0.4)",
                color: "#c2353f",
              }}
            >
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#c2353f", boxShadow: "0 0 8px #c2353f" }} />
              Multi-Asset
            </div>
            <h1 className="text-4xl font-bold tracking-tight" style={{ color: "#eaeaea" }}>
              Research Markets
            </h1>
            <p className="text-sm mt-1" style={{ color: "rgba(234,234,234,0.5)" }}>
              Browse quant research across crypto, equities, forex, and commodities
            </p>
          </div>
          <EpochTimer />
        </section>

        {/* ── Stat cards ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Active Contributors" value={totalProviders} accent="#b08d57" />
          <StatCard label="Markets Covered" value={MOCK_MARKETS.length} accent="#eaeaea" />
          <StatCard label="Avg Accuracy" value={`${avgAccuracy}%`} accent={avgAccuracy >= 60 ? "#22c55e" : "#f59e0b"} />
          <StatCard label="Asset Classes" value={4} accent="#627EEA" />
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
          <span className="ml-auto text-xs" style={{ color: "rgba(234,234,234,0.3)" }}>
            {filteredMarkets.length} market{filteredMarkets.length !== 1 ? "s" : ""}
          </span>
        </div>

        {/* ── Markets grid ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredMarkets.map((market) => (
            <MarketCard key={market.id} market={market} onViewResearch={handleViewResearch} />
          ))}
        </div>

        {/* ── Live signal feed ── */}
        <LiveSignalFeedNoSSR signals={signals} />

        {/* ── Top providers ── */}
        <TopContributors contributors={contributors} />

      </main>
    </div>
  );
};

export default MarketsPage;
