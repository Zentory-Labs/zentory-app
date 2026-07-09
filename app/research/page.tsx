"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { getResearch } from "@/lib/research";
import type { Research } from "@/lib/research";
import ResearchTable from "@/components/ResearchTable";
import { useDemoMode, DemoBadge } from "@/lib/demo/context";
import { demoResearch } from "@/lib/demo/data";

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
      <p className="text-xs uppercase tracking-widest mb-4" style={{ color: "rgba(106,111,117,0.7)", fontFamily: "var(--font-montserrat), sans-serif" }}>
        Performance Summary
      </p>
      <div className="flex flex-col items-center justify-center py-8 gap-2">
        <p className="text-sm text-white/60" style={{ fontFamily: "var(--font-montserrat), sans-serif" }}>
          {executedCount > 0
            ? `${executedCount} executed signal${executedCount === 1 ? "" : "s"} — awaiting epoch settlement.`
            : "No executed signals yet."}
        </p>
        <p className="text-xs text-white/35 italic max-w-md text-center" style={{ fontFamily: "var(--font-montserrat), sans-serif" }}>
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
    gp: "#b08d57",
    lumibot: "#c2353f",
    manual: "#b08d57",
  };

  // Bars reflect each contributor's share of recorded research volume (real data).
  const maxCount = Math.max(1, ...contributorDefs.map((d) => d.count));

  return (
    <div className="glass-card p-6">
      <p className="text-xs uppercase tracking-widest mb-4" style={{ color: "rgba(106,111,117,0.7)", fontFamily: "var(--font-montserrat), sans-serif" }}>
        Research Contributors
      </p>
      {DEMO_BANNER}
      <div className="space-y-3">
        {contributorDefs.map(({ name, label, count }) => (
          <div key={name} className="flex items-center gap-3">
            <div className="w-20 text-xs" style={{ color: "rgba(106,111,117,0.8)", fontFamily: "var(--font-montserrat), sans-serif" }}>{label}</div>
            <div className="flex-1 rounded-full h-2 overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{ width: `${(count / maxCount) * 100}%`, background: contributorColors[name] ?? "#b08d57" }}
              />
            </div>
            <div className="w-16 text-right text-xs font-mono" style={{ color: "rgba(106,111,117,0.8)", fontFamily: "var(--font-montserrat), sans-serif" }}>
              {count} trades
            </div>
            {/* Win rate intentionally not shown until it can be computed from
                settled P&L (keeper_audit) — never a fabricated 0%. */}
            <div className="w-24 text-right text-[11px]" style={{ color: "rgba(106,111,117,0.7)", fontFamily: "var(--font-montserrat), sans-serif" }}>
              win rate pending
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────

export default function ResearchPage() {
  const { enabled: demoMode } = useDemoMode();
  const [research, setResearch] = useState<Research[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchResearch = useCallback(async () => {
    if (demoMode) {
      // Map demo research items into the Research shape the table consumes.
      // - Distribute across the three valid provider enums so the
      //   contributor-breakdown chips above the table populate evenly.
      // - Realistic per-asset spot prices (anchored, not live).
      // - Unique tx hashes per executed row so investors don't see the
      //   same 0xc0ffee for every line.
      const ASSET_PRICES: Record<string, number> = {
        BTC: 97_420, ETH: 3_586, SOL: 188, XRP: 2.46,
      };
      const samples = demoResearch(8);
      const rows: Research[] = samples.map((s, i) => {
        const asset = (["BTC", "ETH", "SOL", "XRP"].includes(s.asset) ? s.asset : "BTC") as Research["asset"];
        const basePrice = ASSET_PRICES[asset] ?? 0;
        // ±0.5% drift around base so prices look like snapshots.
        const drift = ((i * 7919) % 1000) / 100_000 - 0.005;
        const price = Math.round(basePrice * (1 + drift) * 100) / 100;
        const provider = (["gp", "lumibot", "manual"] as const)[i % 3];
        return {
          id: s.id,
          timestamp: s.publishedAt,
          provider,
          asset,
          direction: s.direction === "LONG" ? "LONG" : s.direction === "SHORT" ? "SHORT" : "CLOSE",
          size: Math.round((0.25 + (i % 5) * 0.5) * 100) / 100,
          price,
          status: s.status === "executed" ? "executed" : s.status === "expired" ? "failed" : "pending",
          txHash: s.txHash
            ? `0x${(0xdec0de00 + i * 17).toString(16).padStart(8, "0")}${"abcdef0123456789".repeat(4).slice(0, 56)}`
            : undefined,
        };
      });
      setResearch(rows);
      setError(null);
      setLoading(false);
      return;
    }
    try {
      const data = await getResearch();
      setResearch(data);
      setError(null);
    } catch {
      setError("Failed to load research.");
    } finally {
      setLoading(false);
    }
  }, [demoMode]);

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

      <div className="space-y-8">
        {/* Header */}
        <div className="glass-card p-6 flex items-center justify-between">
          <div>
            <div
              className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium mb-2"
              style={{
                background: "rgba(176, 141, 87, 0.12)",
                borderColor: "rgba(176, 141, 87, 0.3)",
                color: "#b08d57",
                fontFamily: "var(--font-montserrat), sans-serif",
              }}
            >
              <div className="h-1.5 w-1.5 rounded-full" style={{ background: "#b08d57" }} />
              Testnet
            </div>
            <h1 className="text-3xl font-bold tracking-tight inline-flex items-center gap-3" style={{ fontFamily: "var(--font-montserrat), sans-serif" }}>
              <span className="gradient-text-gold">Research Dashboard</span>
              {demoMode && <DemoBadge />}
            </h1>
            <p className="mt-1 text-sm text-white/40">
              Multi-asset market structure analysis. Published research from the ZENT network. Not investment advice.
            </p>
          </div>
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

        {/* Public signal submission — coming Q3 2026 */}
        <div
          className="rounded-2xl p-8"
          style={{ background: "rgba(176, 141, 87, 0.04)", border: "1px solid rgba(176, 141, 87, 0.2)" }}
        >
          <div
            className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold mb-4"
            style={{ background: "rgba(176,141,87,0.12)", borderColor: "rgba(176,141,87,0.3)", color: "#b08d57" }}
          >
            Coming Q3 2026
          </div>
          <h3 className="text-xl font-bold mb-3" style={{ color: "#eaeaea" }}>
            Public signal submission via SignalRegistry
          </h3>
          <p className="text-sm mb-4 max-w-2xl" style={{ color: "rgba(234,234,234,0.65)" }}>
            Quants will submit signals directly to the on-chain
            {" "}<code className="px-1 rounded" style={{ background: "rgba(255,255,255,0.06)", color: "#b08d57" }}>SignalRegistry</code>{" "}
            contract via EIP-712 signature: <strong className="text-white/80">asset, direction, confidence</strong>, and a ZENT conviction stake.
            Accuracy is settled every 4 hours by <code className="px-1 rounded" style={{ background: "rgba(255,255,255,0.06)", color: "#b08d57" }}>EpochScoring</code> using Chainlink price feeds.
          </p>
          <p className="text-sm max-w-2xl" style={{ color: "rgba(234,234,234,0.55)" }}>
            <strong className="text-white/80">Why no &ldquo;size&rdquo; field?</strong> Signal authors don&rsquo;t pick the trade
            size — the vault does, scaled by the author&rsquo;s conviction (ZENT staked) and the vault&rsquo;s own
            risk mandate (see <code className="px-1 rounded" style={{ background: "rgba(255,255,255,0.06)", color: "#b08d57" }}>StrategyExecutor.maxPositionSize</code>).
            That keeps signal submission cheap, signer-agnostic, and free from front-running on size disclosure.
          </p>
          <div className="mt-6 text-xs" style={{ color: "rgba(234,234,234,0.4)" }}>
            Until then, signals come from the ZENTORY engine. Track build progress on{" "}
            <a href="/state-of-protocol" className="underline" style={{ color: "#b08d57" }}>State of Protocol</a>.
          </div>
        </div>
      </div>
    </div>
  );
}
