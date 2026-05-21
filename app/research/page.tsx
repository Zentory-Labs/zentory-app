"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useAccount } from "wagmi";
import { getResearch } from "@/lib/research";
import type { Research } from "@/lib/research";
import ResearchTable from "@/components/ResearchTable";
import TradeLoggerForm from "./TradeLoggerForm";

// ─── Performance Metrics ─────────────────────────────────────

const DEMO_BANNER = (
  <div style={{ background: "rgba(255,180,0,0.12)", border: "1px solid rgba(255,180,0,0.35)", borderRadius: 12, padding: "12px 16px", marginBottom: 16 }}>
    <span style={{ color: "#FFB400", fontWeight: 700, fontSize: 12 }}>IMPORTANT:</span>
    <span style={{ color: "rgba(234,234,234,0.7)", fontSize: 12, marginLeft: 8 }}>All performance data shown is for illustrative purposes only. No guarantees are made. Results may vary. This is not financial advice.</span>
  </div>
);

function ResearchPerformanceBar({ research }: { research: Research[] }) {
  const executedCount = useMemo(
    () => research.filter((s) => s.status === "executed").length,
    [research]
  );

  // P&L attribution requires per-signal entry/exit prices indexed from
  // hl_user_fills + on-chain price feeds. Until that pipeline is live we do
  // not synthesize numbers — an empty state is more honest than a 0% win rate.
  return (
    <div className="glass-card p-6">
      <p className="text-xs uppercase tracking-widest mb-4" style={{ color: "rgba(106,111,117,0.7)", fontFamily: "'Montserrat', sans-serif" }}>
        Performance Summary
      </p>
      <div className="flex flex-col items-center justify-center py-8 gap-2">
        <p className="text-sm text-white/60" style={{ fontFamily: "'Montserrat', sans-serif" }}>
          {executedCount > 0
            ? `${executedCount} executed signal${executedCount === 1 ? "" : "s"} — awaiting epoch settlement.`
            : "No executed signals yet."}
        </p>
        <p className="text-xs text-white/35 italic max-w-md text-center" style={{ fontFamily: "'Montserrat', sans-serif" }}>
          Live P&amp;L populates once on-chain fill prices are indexed and the first 4-hour epoch settles via EpochScoring.
        </p>
      </div>
    </div>
  );
}

// ─── Contributor Breakdown ─────────────────────────────────────

function ContributorBreakdown({ research }: { research: Research[] }) {
  const contributorDefs = useMemo(() => {
    const executed = research.filter((s) => s.status === "executed");
    const allContributors = ["gp", "lumibot", "manual"] as const;
    return allContributors.map((p) => {
      const pResearch = executed.filter((s) => s.provider === p);
      // Win rate will be computed from real P&L data when available via keeper_audit
      return {
        name: p,
        label: p === "gp" ? "Genesis Pulse" : p === "lumibot" ? "Lumibot" : "Manual",
        count: pResearch.length,
        winRate: 0,
      };
    });
  }, [research]);

  const contributorColors: Record<string, string> = {
    gp: "#0d80fa",
    lumibot: "#9945FF",
    manual: "#b08d57",
  };

  return (
    <div className="glass-card p-6">
      <p className="text-xs uppercase tracking-widest mb-4" style={{ color: "rgba(106,111,117,0.7)", fontFamily: "'Montserrat', sans-serif" }}>
        Research Contributors
      </p>
      {DEMO_BANNER}
      <div className="space-y-3">
        {contributorDefs.map(({ name, label, count, winRate }) => (
          <div key={name} className="flex items-center gap-3">
            <div className="w-20 text-xs" style={{ color: "rgba(106,111,117,0.8)", fontFamily: "'Montserrat', sans-serif" }}>{label}</div>
            <div className="flex-1 rounded-full h-2 overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{ width: `${Math.min(winRate, 100)}%`, background: contributorColors[name] ?? "#0d80fa" }}
              />
            </div>
            <div className="w-16 text-right text-xs font-mono" style={{ color: "rgba(106,111,117,0.8)", fontFamily: "'Montserrat', sans-serif" }}>
              {count} trades
            </div>
            <div className="w-12 text-right text-xs font-bold" style={{ color: winRate >= 55 ? "#22c55e" : "#ef4444", fontFamily: "'Montserrat', sans-serif" }}>
              {winRate.toFixed(0)}%
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────

export default function ResearchPage() {
  const { address, isConnected } = useAccount();
  const [research, setResearch] = useState<Research[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchResearch = useCallback(async () => {
    try {
      const data = await getResearch();
      setResearch(data);
      setError(null);
    } catch {
      setError("Failed to load research.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchResearch();
    const interval = setInterval(fetchResearch, 30_000);
    return () => clearInterval(interval);
  }, [fetchResearch]);

  return (
    <div className="min-h-screen relative" style={{ background: "#0b0b0d" }}>
      {/* Ambient glows */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-[#8b1e2d]/5 rounded-full blur-3xl pointer-events-none -z-10" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-[#b08d57]/5 rounded-full blur-3xl pointer-events-none -z-10" />

      <main className="mx-auto max-w-7xl px-6 py-10 space-y-8">
        {/* Header */}
        <div className="glass-card p-6 flex items-center justify-between">
          <div>
            <div
              className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium mb-2"
              style={{
                background: "rgba(139, 30, 45, 0.15)",
                borderColor: "rgba(139, 30, 45, 0.4)",
                color: "#c2353f",
                fontFamily: "'Montserrat', sans-serif",
              }}
            >
              <div className="h-1.5 w-1.5 rounded-full animate-pulse" style={{ background: "#c2353f", boxShadow: "0 0 8px #c2353f" }} />
              LIVE
            </div>
            <h1 className="text-3xl font-bold tracking-tight" style={{ fontFamily: "'Montserrat', sans-serif" }}>
              <span className="gradient-text-gold">Research Dashboard</span>
            </h1>
            <p className="mt-1 text-sm text-white/40">
              Multi-asset market structure analysis. Published research from the ZENT network. Not investment advice.
            </p>
          </div>
          {isConnected && address && (
            <div className="rounded-2xl border border-white/[0.1] bg-black/60 backdrop-blur-xl px-4 py-2">
              <span className="font-mono text-xs text-white/60">Keeper: </span>
              <span className="font-mono text-xs" style={{ color: "#b08d57" }}>{address.slice(0, 6)}…{address.slice(-4)}</span>
            </div>
          )}
        </div>

        {/* Performance metrics */}
        {!loading && research.length > 0 && (
          <>
            <ResearchPerformanceBar research={research} />
            <ContributorBreakdown research={research} />
          </>
        )}

        {error && (
          <div className="rounded-2xl border border-red-500/20 bg-red-500/5 glass-card px-4 py-3 text-sm text-red-400 backdrop-blur-sm">
            {error}
          </div>
        )}

        {/* Research table — public */}
        <section>
          {loading ? (
            <div className="flex items-center justify-center py-24">
              <div className="h-8 w-8 rounded-full border-2 border-amber-500 border-t-transparent animate-spin" />
            </div>
          ) : (
            <div className="glass-card overflow-hidden">
              <ResearchTable research={research} />
            </div>
          )}
        </section>

        {/* Trade form — keeper only */}
        {isConnected ? (
          <div className="glass-card p-6" style={{ borderColor: "rgba(139, 30, 45, 0.3)" }}>
            <TradeLoggerForm />
          </div>
        ) : (
          <div className="rounded-2xl border border-white/[0.1] bg-black/60 backdrop-blur-xl p-8 text-center">
            <div className="mb-4 flex justify-center">
              <div
                className="h-12 w-12 rounded-full flex items-center justify-center border"
                style={{ background: "rgba(139, 30, 45, 0.12)", borderColor: "rgba(139, 30, 45, 0.25)" }}
              >
                <svg
                  className="h-6 w-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  style={{ color: "#c2353f" }}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">Keeper Access Required</h3>
            <p className="text-sm text-white/50 max-w-sm mx-auto">
              Connect your wallet to publish research and execute trades on-chain.
              Only the keeper wallet can execute transactions.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
