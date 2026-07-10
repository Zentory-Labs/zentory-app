"use client";

import { useState, useEffect, useCallback } from "react";
import { useAccount } from "wagmi";
import { createPublicClient, http, parseAbi } from "viem";
import { addresses, HYPEREVM_TESTNET, demoProviderLabel } from "@/lib/contracts";
import { useDemoMode, DemoBadge } from "@/lib/demo/context";
import { demoSignals, demoProviders } from "@/lib/demo/data";

// Registry STATE reads. Signals post once per 4h epoch, but the RPC caps
// eth_getLogs at 1000 blocks (~10 min of HyperEVM chain) — so any log-scan
// window was almost always empty and the arena rendered "No signals found"
// while 40+ signals sat on-chain. The registry keeps a public signalIds array,
// so we page through state instead: no range limit, real submittedAt times.
const REGISTRY_INDEX_ABI = parseAbi([
  "function getSignalCount() view returns (uint256)",
  "function signalIds(uint256) view returns (bytes32)",
]);

// getSignal returns a struct — parseAbi can't express inline tuples, so this
// one entry is spelled out as a JSON ABI fragment.
const GET_SIGNAL_ABI = [
  {
    name: "getSignal",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "signalId", type: "bytes32" }],
    outputs: [
      {
        type: "tuple",
        components: [
          { name: "signalId", type: "bytes32" },
          { name: "provider", type: "address" },
          { name: "assetClass", type: "uint8" },
          { name: "assetId", type: "bytes32" },
          { name: "direction", type: "int256" },
          { name: "confidence", type: "uint256" },
          { name: "submittedAt", type: "uint256" },
          { name: "expiresAt", type: "uint256" },
          { name: "signature", type: "bytes" },
          { name: "status", type: "uint8" },
        ],
      },
    ],
  },
] as const;

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
  { min: 1000, label: "Gold", color: "#b08d57" },
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
  if (dir > 2000) return { label: "STRONG BUY", color: "#34d399" };
  if (dir > 500) return { label: "BUY", color: "#34d399" };
  if (dir < -2000) return { label: "STRONG SELL", color: "#c2353f" };
  if (dir < -500) return { label: "SELL", color: "#fca5a5" };
  return { label: "NEUTRAL", color: "#bfc3c7" };
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
      // Read through the server-side proxy (/api/rpc) rather than the raw
      // provider URL — the upstream endpoint (and its API key) never reaches
      // the browser or client error messages. The proxy applies the same
      // allowlist to each call in a batch, so batching stays on.
      const publicClient = createPublicClient({
        chain: HYPEREVM_TESTNET,
        transport: http("/api/rpc", { batch: true }),
      });

      const registry = addresses.SignalRegistry as `0x${string}`;
      const count = Number(
        await publicClient.readContract({
          address: registry,
          abi: REGISTRY_INDEX_ABI,
          functionName: "getSignalCount",
        })
      );
      const take = Math.min(count, 25);
      const idxs = Array.from({ length: take }, (_, i) => BigInt(count - take + i));
      const ids = await Promise.all(
        idxs.map((i) =>
          publicClient.readContract({ address: registry, abi: REGISTRY_INDEX_ABI, functionName: "signalIds", args: [i] })
        )
      );
      const raw = await Promise.all(
        ids.map((id) =>
          publicClient.readContract({ address: registry, abi: GET_SIGNAL_ABI, functionName: "getSignal", args: [id] })
        )
      );

      const decoded: Signal[] = raw
        .map((s: any) => ({
          id: s.signalId as string,
          provider: s.provider as string,
          assetClass: Number(s.assetClass),
          assetId: s.assetId as string,
          direction: Number(s.direction),
          confidence: Number(s.confidence),
          submittedAt: Number(s.submittedAt),
          expiresAt: Number(s.expiresAt),
          // Real conviction from the off-chain indexer's stake mirror; if it
          // hasn't caught up, 0 — an honest blank beats a fake number.
          convictionStaked: convictionMap[s.signalId as string] ?? 0,
          status: Number(s.status),
        }))
        .reverse(); // newest first

      setSignals(decoded);
    } catch {
      // Raw RPC errors can echo transport details — show a friendly degraded
      // state instead and let the retry effect below re-poll.
      setError("Live feed temporarily unavailable — retrying");
    } finally {
      setLoading(false);
    }
  }, [convictionMap, demoMode]);

  useEffect(() => {
    fetchSignals();
  }, [fetchSignals]);

  // Auto-retry while degraded, so the "retrying" copy is honest.
  useEffect(() => {
    if (!error) return;
    const timer = setTimeout(fetchSignals, 15_000);
    return () => clearTimeout(timer);
  }, [error, fetchSignals]);

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
          <h1 className="text-3xl font-bold inline-flex items-center gap-2" style={{ fontFamily: "var(--font-montserrat), sans-serif" }}>
            Signal Arena
            {demoMode && <DemoBadge />}
          </h1>
          <p className="text-sm mt-1" style={{ color: "#6a6f75" }}>
            Live signals from on-chain SignalRegistry · Conviction-Weighted Leaderboard
          </p>
        </div>
        <button
          onClick={fetchSignals}
          disabled={loading}
          className="px-4 py-2 rounded-lg text-sm font-semibold transition-opacity disabled:opacity-50"
          style={{ background: "rgba(176,141,87,0.1)", color: "#b08d57", border: "1px solid rgba(176,141,87,0.2)", fontFamily: "var(--font-montserrat), sans-serif" }}
        >
          {loading ? "Loading..." : "Refresh"}
        </button>
      </div>

      {error && (
        <div
          className="rounded-xl p-4 mb-6 text-sm flex items-center justify-between gap-4"
          style={{ background: "rgba(176,141,87,0.08)", border: "1px solid rgba(176,141,87,0.25)", color: "#b08d57" }}
        >
          <div>
            {error}
            <div className="text-xs mt-1" style={{ color: "#6a6f75" }}>
              On-chain signals will reappear automatically once the connection recovers.
            </div>
          </div>
          <button
            onClick={fetchSignals}
            disabled={loading}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold flex-shrink-0 transition-opacity disabled:opacity-50"
            style={{ background: "rgba(176,141,87,0.12)", color: "#b08d57", border: "1px solid rgba(176,141,87,0.3)", fontFamily: "var(--font-montserrat), sans-serif" }}
          >
            Retry now
          </button>
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
              background: tab === t ? "rgba(176,141,87,0.15)" : "transparent",
              color: tab === t ? "#b08d57" : "rgba(255,255,255,0.4)",
              border: tab === t ? "1px solid rgba(176,141,87,0.3)" : "1px solid transparent",
              fontFamily: "var(--font-montserrat), sans-serif",
            }}
          >
            {label}
          </button>
        ))}

        {/* Asset filter */}
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs" style={{ color: "#6a6f75" }}>Filter:</span>
          {[null, 0, 1, 2, 3, 4].map((ac) => (
            <button
              key={String(ac)}
              onClick={() => setAssetFilter(ac)}
              className="px-3 py-1 rounded-full text-xs transition-all"
              style={{
                background: assetFilter === ac ? "rgba(194,53,63,0.15)" : "transparent",
                color: assetFilter === ac ? "#c2353f" : "rgba(255,255,255,0.3)",
                border: assetFilter === ac ? "1px solid rgba(194,53,63,0.3)" : "1px solid transparent",
                fontFamily: "var(--font-montserrat), sans-serif",
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
            <div className="text-center py-16 text-sm" style={{ color: "#6a6f75" }}>
              Loading signals from SignalRegistry...
            </div>
          ) : filteredSignals.length === 0 ? (
            <div className="text-center py-16">
              <div className="text-lg font-semibold mb-2" style={{ color: "rgba(255,255,255,0.5)" }}>
                No signals found
              </div>
              <div className="text-sm" style={{ color: "#6a6f75" }}>
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
                    {/* Provider — a labeled demo account shows its name + a Demo
                        badge; a known human name shows in full; otherwise a raw
                        0x address is truncated. */}
                    <div className="flex-shrink-0 w-36">
                      {(() => {
                        const demoLabel = demoProviderLabel(sig.provider);
                        if (demoLabel) {
                          return (
                            <div className="flex items-center gap-1.5" title={sig.provider}>
                              <span className="text-xs font-semibold truncate" style={{ color: "#c2353f" }}>{demoLabel}</span>
                              <span className="text-[9px] px-1 py-0.5 rounded uppercase tracking-wide flex-shrink-0"
                                style={{ background: "rgba(194,53,63,0.15)", color: "#c2353f", border: "1px solid rgba(194,53,63,0.3)" }}>
                                Demo
                              </span>
                            </div>
                          );
                        }
                        return (
                          <div
                            className={`text-xs truncate ${sig.provider.startsWith("0x") ? "font-mono" : "font-semibold"}`}
                            style={{ color: "#c2353f" }}
                            title={sig.provider}
                          >
                            {sig.provider.startsWith("0x") && sig.provider.length === 42
                              ? `${sig.provider.slice(0, 8)}…${sig.provider.slice(-6)}`
                              : sig.provider}
                          </div>
                        );
                      })()}
                      <div className="text-xs mt-0.5" style={{ color: "#6a6f75" }}>
                        {fmtTime(sig.submittedAt)}
                      </div>
                    </div>

                    {/* Direction + Asset */}
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm" style={{ color: dir.color, fontFamily: "var(--font-montserrat), sans-serif" }}>
                          {dir.label}
                        </span>
                        <span className="text-sm font-semibold" style={{ color: "#eaeaea" }}>
                          {assetLabel}
                        </span>
                        <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "rgba(255,255,255,0.05)", color: "#6a6f75" }}>
                          {ASSET_CLASS_LABEL[sig.assetClass] ?? `Class ${sig.assetClass}`}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs" style={{ color: "#6a6f75" }}>
                        <span>Confidence: <span style={{ color: "#eaeaea" }}>{Math.round(sig.confidence / 100)}%</span></span>
                      </div>
                    </div>

                    {/* Conviction Score */}
                    <div className="text-right flex-shrink-0">
                      <div className="text-xs uppercase tracking-wider mb-1" style={{ color: "#6a6f75", fontFamily: "var(--font-montserrat), sans-serif" }}>
                        Conviction
                      </div>
                      <div className="font-bold text-sm" style={{ color: tier.color, fontFamily: "var(--font-space-mono), monospace" }}>
                        {sig.convictionStaked.toLocaleString()}
                      </div>
                      <div className="text-xs" style={{ color: tier.color, fontFamily: "var(--font-montserrat), sans-serif" }}>
                        {tier.label}
                      </div>
                    </div>

                    {/* Direction indicator */}
                    <div
                      className="w-1 h-10 rounded-full flex-shrink-0"
                      style={{ background: sig.direction > 0 ? "#34d399" : sig.direction < 0 ? "#c2353f" : "#bfc3c7" }}
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
            <div className="text-center py-16 text-sm" style={{ color: "#6a6f75" }}>
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
                  color: "#6a6f75",
                  fontFamily: "var(--font-montserrat), sans-serif",
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
                    <div className="font-bold text-sm" style={{ color: i === 0 ? "#b08d57" : i === 1 ? "#c0c0c0" : i === 2 ? "#cd7f32" : "rgba(106,111,117,0.5)", fontFamily: "var(--font-space-mono), monospace" }}>
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
                            style={{ background: sig.direction > 0 ? "#34d399" : sig.direction < 0 ? "#c2353f" : "#bfc3c7" }}
                            title={`${directionLabel(sig.direction).label} ${ASSET_CLASS_COIN[sig.assetClass] ?? "?"}`}
                          />
                        ))}
                      </div>
                    </div>

                    {/* Signals count */}
                    <div className="text-right text-sm" style={{ color: "#eaeaea", fontFamily: "var(--font-space-mono), monospace" }}>
                      {p.totalSignals}
                    </div>

                    {/* Avg confidence */}
                    <div className="text-right text-sm" style={{ color: "#eaeaea", fontFamily: "var(--font-space-mono), monospace" }}>
                      {p.avgConfidence > 0 ? `${Math.round(p.avgConfidence / 100)}%` : "—"}
                    </div>

                    {/* Total conviction */}
                    <div className="text-right">
                      <div className="text-sm font-bold" style={{ color: tier.color, fontFamily: "var(--font-space-mono), monospace" }}>
                        {p.totalConviction.toLocaleString()}
                      </div>
                      <div className="text-xs" style={{ color: tier.color, fontFamily: "var(--font-montserrat), sans-serif" }}>
                        {tier.label}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="mt-4 text-center text-xs" style={{ color: "#6a6f75" }}>
            Conviction scores are weighted by ZENT staked per signal. Leaderboard updates when signals are submitted on-chain.
          </div>
        </div>
      )}

      {/* Ghost Portfolio — coming Q3 2026, intentionally not linked yet */}
      <div
        className="mt-8 rounded-2xl p-6"
        style={{ background: "rgba(194,53,63,0.04)", border: "1px solid rgba(194,53,63,0.18)" }}
      >
        <div className="flex items-center gap-3 mb-2">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold"
            style={{ background: "rgba(194,53,63,0.2)", color: "#c2353f", fontFamily: "var(--font-space-mono), monospace" }}
          >
            G
          </div>
          <div>
            <div className="text-sm font-semibold" style={{ color: "#eaeaea" }}>Ghost Portfolio</div>
            <div className="text-xs" style={{ color: "#6a6f75" }}>
              On-chain attribution — coming Q3 2026
            </div>
          </div>
        </div>
        <p className="text-xs leading-relaxed" style={{ color: "#bfc3c7" }}>
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
