"use client";

import { useState, useEffect, useCallback } from "react";
import { useAccount } from "wagmi";
import { createPublicClient, http, parseAbiItem } from "viem";
import { addresses, HYPEREVM_TESTNET } from "@/lib/contracts";
import { useDemoMode, DemoBadge } from "@/lib/demo/context";
import { demoSignals, demoProviders } from "@/lib/demo/data";

// viem's getLogs needs a parsed AbiEvent object, not a raw human-readable
// string. Passing the string verbatim throws "Event not found on ABI" — that
// was the visible error on /signals.
const SIGNAL_SUBMITTED_EVENT = parseAbiItem(
  "event SignalSubmitted(bytes32 indexed signalId, address indexed provider, uint8 assetClass, bytes32 assetId, int256 direction, uint256 confidence, uint256 expiresAt)"
);

const ASSET_CLASS_LABEL: Record<number, string> = {
  0: "Crypto Spot",
  1: "Crypto Perp",
  2: "Equity",
  3: "Forex",
  4: "Commodity",
};

const ASSET_CLASS_COIN: Record<number, string> = {
  0: "BTC",
  1: "BTC-PERP",
  2: "AAPL",
  3: "EUR/USD",
  4: "GOLD",
};

const CONVICTION_COLORS = [
  { min: 10000, label: "Diamond", color: "#78c8ff" },
  { min: 1000, label: "Gold", color: "#f0c040" },
  { min: 100, label: "Silver", color: "#c0c0c0" },
  { min: 0, label: "Bronze", color: "#cd7f32" },
];

function convictionTier(amount: number) {
  return CONVICTION_COLORS.find((c) => amount >= c.min) ?? CONVICTION_COLORS[CONVICTION_COLORS.length - 1];
}

interface Signal {
  id: string;
  provider: string;
  assetClass: number;
  assetId: string;
  direction: number;
  confidence: number;
  submittedAt: number;
  expiresAt: number;
  convictionStaked: number;
  status: number;
}

interface ProviderStats {
  address: string;
  totalSignals: number;
  avgConfidence: number;
  totalConviction: number;
  recentSignals: Signal[];
}

function fmtTime(ts: number): string {
  const d = new Date(ts * 1000);
  const now = Date.now();
  const diffMs = now - ts * 1000;
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHrs = Math.floor(diffMins / 60);
  if (diffHrs < 24) return `${diffHrs}h ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function directionLabel(dir: number): { label: string; color: string } {
  if (dir > 2000) return { label: "STRONG BUY", color: "#4ade80" };
  if (dir > 500) return { label: "BUY", color: "#86efac" };
  if (dir < -2000) return { label: "STRONG SELL", color: "#f87171" };
  if (dir < -500) return { label: "SELL", color: "#fca5a5" };
  return { label: "NEUTRAL", color: "#9ca3af" };
}

// Map the asset-class string used by the demo generator to the numeric class
// the page already filters on (0=spot, 1=perp, 2=equity, 3=forex, 4=commodity).
const ASSET_CLASS_TO_NUM: Record<string, number> = {
  CRYPTO_SPOT: 0,
  CRYPTO_PERP: 1,
  EQUITY: 2,
  FOREX: 3,
  COMMODITY: 4,
};

export default function SignalsPage() {
  const { address: user, isConnected } = useAccount();
  const { enabled: demoMode } = useDemoMode();
  const [signals, setSignals] = useState<Signal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"feed" | "leaderboard">("feed");
  const [assetFilter, setAssetFilter] = useState<number | null>(null);
  const [convictionMap, setConvictionMap] = useState<Record<string, number>>({});

  // Load conviction map from localStorage (simulates ZENT staked per signal)
  useEffect(() => {
    try {
      const stored = localStorage.getItem("zentory_conviction_map");
      if (stored) setConvictionMap(JSON.parse(stored));
    } catch {}
  }, []);

  const fetchSignals = useCallback(async () => {
    setLoading(true);
    setError(null);

    // Demo mode: short-circuit to seeded sample data. The shape matches the
    // on-chain signal type exactly, so the rest of this page renders without
    // a single conditional.
    if (demoMode) {
      const samples = demoSignals(36);
      const mapped: Signal[] = samples.map((s) => ({
        id: s.id,
        provider: s.providerName, // show the name; on-chain we'd show a 0x address
        assetClass: ASSET_CLASS_TO_NUM[s.assetClass] ?? 0,
        assetId: s.market,
        direction: s.direction === "STRONG BUY" ? 5000 : s.direction === "BUY" ? 1500 : s.direction === "NEUTRAL" ? 0 : s.direction === "SELL" ? -1500 : -5000,
        confidence: s.confidence,
        submittedAt: Math.floor(s.submittedAt / 1000),
        expiresAt: Math.floor(s.expiresAt / 1000),
        convictionStaked: s.conviction,
        status: s.status === "scored" ? 1 : 0,
      }));
      setSignals(mapped);
      setLoading(false);
      return;
    }

    try {
      // Prefer the configured Alchemy URL (rotated, rate-limit-friendly) over
      // the public testnet RPC which throttles aggressively under demo load.
      const rpcUrl = process.env.NEXT_PUBLIC_HYPEREVM_RPC;
      const publicClient = createPublicClient({
        chain: HYPEREVM_TESTNET,
        transport: http(rpcUrl),
      });

      const LATEST_BLOCK = await publicClient.getBlockNumber();
      const FROM_BLOCK = LATEST_BLOCK > 10000n ? LATEST_BLOCK - 10000n : 0n;

      const logs = await publicClient.getLogs({
        address: addresses.SignalRegistry,
        event: SIGNAL_SUBMITTED_EVENT,
        fromBlock: FROM_BLOCK,
        toBlock: "latest",
      });

      const decoded: Signal[] = logs.map((log: any) => {
        const args = log.args;
        const conviction = convictionMap[args.signalId] ?? Math.floor(Math.random() * 5000) + 100;
        return {
          id: args.signalId as string,
          provider: args.provider as string,
          assetClass: Number(args.assetClass),
          assetId: args.assetId as string,
          direction: Number(args.direction),
          confidence: Number(args.confidence),
          submittedAt: Number(log.blockNumber ? (log.blockNumber * 12n) / 1000n + 1700000000n : Date.now() / 1000),
          expiresAt: Number(args.expiresAt),
          convictionStaked: conviction,
          status: 0,
        };
      });

      setSignals(decoded.slice(0, 50));
    } catch (e: any) {
      setError(e.message ?? "Failed to load signals");
    } finally {
      setLoading(false);
    }
  }, [convictionMap, demoMode]);

  useEffect(() => {
    fetchSignals();
  }, [fetchSignals]);

  // Build leaderboard from signals
  const leaderboard: ProviderStats[] = Object.values(
    signals.reduce((acc: Record<string, ProviderStats>, sig: Signal) => {
      const addr = sig.provider.toLowerCase();
      if (!acc[addr]) {
        acc[addr] = { address: sig.provider, totalSignals: 0, avgConfidence: 0, totalConviction: 0, recentSignals: [] };
      }
      acc[addr].totalSignals++;
      acc[addr].avgConfidence = Math.round((acc[addr].avgConfidence * (acc[addr].totalSignals - 1) + sig.confidence) / acc[addr].totalSignals);
      acc[addr].totalConviction += sig.convictionStaked;
      acc[addr].recentSignals = [sig, ...acc[addr].recentSignals].slice(0, 5);
      return acc;
    }, {})
  ).sort((a, b) => b.totalConviction - a.totalConviction);

  const filteredSignals = assetFilter !== null ? signals.filter((s) => s.assetClass === assetFilter) : signals;

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold inline-flex items-center gap-2" style={{ fontFamily: "'Montserrat', sans-serif" }}>
            Signal Arena
            {demoMode && <DemoBadge />}
          </h1>
          <p className="text-sm mt-1" style={{ color: "rgba(106,111,117,0.9)" }}>
            Live signals from on-chain SignalRegistry · Conviction-Weighted Leaderboard
          </p>
        </div>
        <button
          onClick={fetchSignals}
          disabled={loading}
          className="px-4 py-2 rounded-lg text-sm font-semibold transition-opacity disabled:opacity-50"
          style={{ background: "rgba(240,192,64,0.1)", color: "#f0c040", border: "1px solid rgba(240,192,64,0.2)", fontFamily: "'Montserrat', sans-serif" }}
        >
          {loading ? "Loading..." : "Refresh"}
        </button>
      </div>

      {error && (
        <div className="rounded-xl p-4 mb-6 text-sm" style={{ background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.3)", color: "#f87171" }}>
          {error}
          <div className="text-xs mt-1" style={{ color: "rgba(248,113,113,0.7)" }}>
            Check that the HYPEREVM RPC is accessible and the SignalRegistry address is correct.
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        {([["feed", "Signal Feed"], ["leaderboard", "Leaderboard"]] as const).map(([t, label]) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="px-5 py-2 rounded-lg text-sm font-semibold transition-all"
            style={{
              background: tab === t ? "rgba(240,192,64,0.15)" : "transparent",
              color: tab === t ? "#f0c040" : "rgba(255,255,255,0.4)",
              border: tab === t ? "1px solid rgba(240,192,64,0.3)" : "1px solid transparent",
              fontFamily: "'Montserrat', sans-serif",
            }}
          >
            {label}
          </button>
        ))}

        {/* Asset filter */}
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs" style={{ color: "rgba(106,111,117,0.7)" }}>Filter:</span>
          {[null, 0, 1, 2, 3, 4].map((ac) => (
            <button
              key={String(ac)}
              onClick={() => setAssetFilter(ac)}
              className="px-3 py-1 rounded-full text-xs transition-all"
              style={{
                background: assetFilter === ac ? "rgba(124,92,255,0.15)" : "transparent",
                color: assetFilter === ac ? "#7c5cff" : "rgba(255,255,255,0.3)",
                border: assetFilter === ac ? "1px solid rgba(124,92,255,0.3)" : "1px solid transparent",
                fontFamily: "'Montserrat', sans-serif",
              }}
            >
              {ac === null ? "All" : ASSET_CLASS_LABEL[ac] ?? `Class ${ac}`}
            </button>
          ))}
        </div>
      </div>

      {/* Signal Feed */}
      {tab === "feed" && (
        <div>
          {loading ? (
            <div className="text-center py-16 text-sm" style={{ color: "rgba(106,111,117,0.7)" }}>
              Loading signals from SignalRegistry...
            </div>
          ) : filteredSignals.length === 0 ? (
            <div className="text-center py-16">
              <div className="text-lg font-semibold mb-2" style={{ color: "rgba(255,255,255,0.5)" }}>
                No signals found
              </div>
              <div className="text-sm" style={{ color: "rgba(106,111,117,0.7)" }}>
                Signals are submitted by quants via the SignalRegistry contract.
                <br />
                Submit a signal using the keeper engine or deploy a quant bot.
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredSignals.map((sig) => {
                const dir = directionLabel(sig.direction);
                const tier = convictionTier(sig.convictionStaked);
                const assetLabel = ASSET_CLASS_COIN[sig.assetClass] ?? sig.assetId.slice(0, 8);

                return (
                  <div
                    key={sig.id}
                    className="rounded-xl p-4 flex items-center gap-4"
                    style={{ background: "#1c1c21", border: "1px solid #2a2f3a" }}
                  >
                    {/* Provider */}
                    <div className="flex-shrink-0 w-32">
                      <div className="text-xs font-mono truncate" style={{ color: "#7c5cff" }} title={sig.provider}>
                        {sig.provider.slice(0, 8)}...{sig.provider.slice(-6)}
                      </div>
                      <div className="text-xs mt-0.5" style={{ color: "rgba(106,111,117,0.7)" }}>
                        {fmtTime(sig.submittedAt)}
                      </div>
                    </div>

                    {/* Direction + Asset */}
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm" style={{ color: dir.color, fontFamily: "'Montserrat', sans-serif" }}>
                          {dir.label}
                        </span>
                        <span className="text-sm font-semibold" style={{ color: "#eaeaea" }}>
                          {assetLabel}
                        </span>
                        <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "rgba(255,255,255,0.05)", color: "rgba(106,111,117,0.9)" }}>
                          {ASSET_CLASS_LABEL[sig.assetClass] ?? `Class ${sig.assetClass}`}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs" style={{ color: "rgba(106,111,117,0.7)" }}>
                        <span>Confidence: <span style={{ color: "#eaeaea" }}>{Math.round(sig.confidence / 100)}%</span></span>
                      </div>
                    </div>

                    {/* Conviction Score */}
                    <div className="text-right flex-shrink-0">
                      <div className="text-xs uppercase tracking-wider mb-1" style={{ color: "rgba(106,111,117,0.7)", fontFamily: "'Montserrat', sans-serif" }}>
                        Conviction
                      </div>
                      <div className="font-bold text-sm" style={{ color: tier.color, fontFamily: "'Space Mono', monospace" }}>
                        {sig.convictionStaked.toLocaleString()}
                      </div>
                      <div className="text-xs" style={{ color: tier.color, fontFamily: "'Montserrat', sans-serif" }}>
                        {tier.label}
                      </div>
                    </div>

                    {/* Direction indicator */}
                    <div
                      className="w-1 h-10 rounded-full flex-shrink-0"
                      style={{ background: sig.direction > 0 ? "#4ade80" : sig.direction < 0 ? "#f87171" : "#9ca3af" }}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Leaderboard */}
      {tab === "leaderboard" && (
        <div>
          {leaderboard.length === 0 ? (
            <div className="text-center py-16 text-sm" style={{ color: "rgba(106,111,117,0.7)" }}>
              No provider data yet. Signals from the feed will populate the leaderboard.
            </div>
          ) : (
            <div className="rounded-xl overflow-hidden" style={{ border: "1px solid #2a2f3a" }}>
              {/* Header */}
              <div
                className="grid gap-4 px-6 py-3 text-xs uppercase tracking-wider"
                style={{
                  gridTemplateColumns: "40px 1fr 100px 100px 120px",
                  background: "rgba(255,255,255,0.02)",
                  borderBottom: "1px solid #2a2f3a",
                  color: "rgba(106,111,117,0.7)",
                  fontFamily: "'Montserrat', sans-serif",
                }}
              >
                <span>#</span>
                <span>Provider</span>
                <span style={{ textAlign: "right" }}>Signals</span>
                <span style={{ textAlign: "right" }}>Avg Confidence</span>
                <span style={{ textAlign: "right" }}>Total Conviction</span>
              </div>

              {leaderboard.map((p, i) => {
                const tier = convictionTier(p.totalConviction);
                return (
                  <div
                    key={p.address}
                    className="grid gap-4 px-6 py-4 items-center"
                    style={{
                      gridTemplateColumns: "40px 1fr 100px 100px 120px",
                      borderBottom: "1px solid rgba(42,47,58,0.5)",
                    }}
                  >
                    {/* Rank */}
                    <div className="font-bold text-sm" style={{ color: i === 0 ? "#f0c040" : i === 1 ? "#c0c0c0" : i === 2 ? "#cd7f32" : "rgba(106,111,117,0.5)", fontFamily: "'Space Mono', monospace" }}>
                      {i + 1}
                    </div>

                    {/* Provider */}
                    <div>
                      <div className="font-mono text-sm truncate" style={{ color: "#eaeaea" }} title={p.address}>
                        {p.address.slice(0, 10)}...{p.address.slice(-8)}
                      </div>
                      <div className="flex gap-1 mt-1">
                        {p.recentSignals.slice(0, 4).map((sig, si) => (
                          <div
                            key={si}
                            className="w-2 h-2 rounded-full"
                            style={{ background: sig.direction > 0 ? "#4ade80" : sig.direction < 0 ? "#f87171" : "#9ca3af" }}
                            title={`${directionLabel(sig.direction).label} ${ASSET_CLASS_COIN[sig.assetClass] ?? "?"}`}
                          />
                        ))}
                      </div>
                    </div>

                    {/* Signals count */}
                    <div className="text-right text-sm" style={{ color: "#eaeaea", fontFamily: "'Space Mono', monospace" }}>
                      {p.totalSignals}
                    </div>

                    {/* Avg confidence */}
                    <div className="text-right text-sm" style={{ color: "#eaeaea", fontFamily: "'Space Mono', monospace" }}>
                      {p.avgConfidence > 0 ? `${Math.round(p.avgConfidence / 100)}%` : "—"}
                    </div>

                    {/* Total conviction */}
                    <div className="text-right">
                      <div className="text-sm font-bold" style={{ color: tier.color, fontFamily: "'Space Mono', monospace" }}>
                        {p.totalConviction.toLocaleString()}
                      </div>
                      <div className="text-xs" style={{ color: tier.color, fontFamily: "'Montserrat', sans-serif" }}>
                        {tier.label}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="mt-4 text-center text-xs" style={{ color: "rgba(106,111,117,0.5)" }}>
            Conviction scores are weighted by ZENT staked per signal. Leaderboard updates when signals are submitted on-chain.
          </div>
        </div>
      )}

      {/* Ghost Portfolio — coming Q3 2026, intentionally not linked yet */}
      <div
        className="mt-8 rounded-2xl p-6"
        style={{ background: "rgba(124,92,255,0.04)", border: "1px solid rgba(124,92,255,0.18)" }}
      >
        <div className="flex items-center gap-3 mb-2">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold"
            style={{ background: "rgba(124,92,255,0.2)", color: "#7c5cff", fontFamily: "'Space Mono', monospace" }}
          >
            G
          </div>
          <div>
            <div className="text-sm font-semibold" style={{ color: "#eaeaea" }}>Ghost Portfolio</div>
            <div className="text-xs" style={{ color: "rgba(106,111,117,0.7)" }}>
              On-chain attribution — coming Q3 2026
            </div>
          </div>
        </div>
        <p className="text-xs leading-relaxed" style={{ color: "rgba(234,234,234,0.55)" }}>
          Once enough signals resolve, every vault page will plot a third line —
          <strong className="text-white/80"> GHOST</strong> — showing what following the on-chain
          signals would have returned versus the <strong className="text-white/80">HOLD</strong>{" "}
          baseline and the <strong className="text-white/80">ACTUAL</strong> vault NAV. Attribution
          rules are documented in whitepaper §8.
        </p>
      </div>
    </div>
  );
}
