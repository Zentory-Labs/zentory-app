"use client";

import Link from "next/link";

/**
 * FoundingProviderCard — features the house systematic bot ("Zentory Core") as the
 * protocol's first, founding provider, using REAL metrics from the live forward
 * ledger. This is the whole thesis: our own engine is provider #1 with a public,
 * verifiable track record, before any third-party quant joins. Presentational;
 * the leaderboard page fetches the ledger and passes computed stats in.
 */

const GOLD = "#B08D57";

export type HouseStats = {
  daysLive: number;
  assets: number;
  avgAhead: number;
  perAsset: { asset: string; ahead: number; strat: number; hold: number }[];
};

function pct(x: number) {
  return `${x >= 0 ? "+" : ""}${(x * 100).toFixed(1)}%`;
}

export default function FoundingProviderCard({ house, loading = false }: { house: HouseStats | null; loading?: boolean }) {
  // The "Recording live" indicator and the metrics must move together. Showing
  // a pulsing green "RECORDING LIVE" next to "—" (the null/loading state) reads
  // as fake on the protocol's flagship trust surface, so gate the live badge on
  // having real ledger stats. While the ledger fetch is in flight, show a muted
  // "Loading track record…" instead of asserting "live".
  const liveLabel = house ? `Recording · Day ${house.daysLive}` : loading ? "Loading track record…" : "Track record initializing";
  const showLivePulse = !!house;
  return (
    <section
      className="relative rounded-2xl p-6 md:p-7 overflow-hidden"
      style={{
        background: "linear-gradient(135deg, rgba(139,30,45,0.12), rgba(176,141,87,0.08))",
        border: "1px solid rgba(176,141,87,0.35)",
        boxShadow: "0 0 50px rgba(176,141,87,0.08)",
      }}
    >
      {/* corner glow */}
      <div className="absolute -top-16 -right-16 w-56 h-56 rounded-full pointer-events-none" style={{ background: "radial-gradient(circle, rgba(176,141,87,0.18), transparent 70%)" }} />

      <div className="relative flex flex-col lg:flex-row lg:items-center gap-6">
        {/* Identity */}
        <div className="flex items-center gap-4 min-w-0">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 text-2xl font-black text-white"
            style={{ background: `linear-gradient(135deg, #8B1E2D, ${GOLD})`, fontFamily: "'Montserrat', sans-serif" }}
          >
            Z
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="text-[10px] font-bold uppercase tracking-[0.18em] px-2 py-0.5 rounded-full" style={{ background: "rgba(176,141,87,0.18)", color: GOLD }}>
                Founding Provider
              </span>
              <span
                className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider"
                style={{ color: showLivePulse ? "#34d399" : "rgba(234,234,234,0.4)" }}
              >
                {showLivePulse && (
                  <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "#34d399", boxShadow: "0 0 8px #34d399" }} />
                )}
                {liveLabel}
              </span>
            </div>
            <h3 className="text-xl font-bold truncate" style={{ color: "#eaeaea", fontFamily: "'Montserrat', sans-serif" }}>
              Zentory Core
            </h3>
            <p className="text-xs" style={{ color: "rgba(234,234,234,0.55)" }}>
              The protocol&apos;s own systematic engine — trend + volatility, long/flat spot. Provider #1.
            </p>
          </div>
        </div>

        {/* Metrics */}
        <div className="flex-1 grid grid-cols-3 gap-4 lg:border-l lg:pl-6" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
          <div>
            <div className="text-[10px] uppercase tracking-wider mb-1" style={{ color: "rgba(234,234,234,0.4)" }}>Days live</div>
            <div className="text-2xl font-bold tabular-nums" style={{ color: "#eaeaea" }}>{house ? house.daysLive : "—"}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider mb-1" style={{ color: "rgba(234,234,234,0.4)" }}>Assets tracked</div>
            <div className="text-2xl font-bold tabular-nums" style={{ color: "#eaeaea" }}>{house ? house.assets : "—"}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider mb-1" style={{ color: "rgba(234,234,234,0.4)" }}>Avg ahead of holding</div>
            <div className="text-2xl font-bold tabular-nums" style={{ color: GOLD }}>{house ? pct(house.avgAhead) : "—"}</div>
          </div>
        </div>
      </div>

      {/* Per-asset chips */}
      {house && house.perAsset.length > 0 && (
        <div className="relative flex flex-wrap gap-2 mt-5">
          {house.perAsset.map((p) => (
            <div
              key={p.asset}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
            >
              <span className="font-bold" style={{ color: "#eaeaea" }}>{p.asset}</span>
              <span className="font-mono font-semibold" style={{ color: GOLD }}>{pct(p.ahead)}</span>
              <span className="text-[10px]" style={{ color: "rgba(234,234,234,0.4)" }}>vs holding</span>
            </div>
          ))}
        </div>
      )}

      <div className="relative flex flex-wrap items-center gap-4 mt-5 pt-4" style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}>
        <Link href="/track-record" className="text-xs font-semibold uppercase tracking-wider hover:underline" style={{ color: GOLD }}>
          View live track record →
        </Link>
        <Link href="/backtest" className="text-xs font-semibold uppercase tracking-wider hover:underline" style={{ color: GOLD }}>
          6-year backtest →
        </Link>
        <span className="text-[11px]" style={{ color: "rgba(234,234,234,0.4)" }}>
          The lead is loss avoided (strategy in cash through the downturn), not trading profit — hash-chained &amp; verifiable.
        </span>
      </div>
    </section>
  );
}
