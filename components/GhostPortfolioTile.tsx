"use client";

/**
 * Ghost Portfolio tile (#69) — the proof artifact.
 *
 * Reads the forward-recorder ledger published at /forward_ledger.jsonl and
 * renders the three-line attribution in the UNDERLYING numeraire (BTC for
 * zBTC, etc.) — the same definition the SpotVault and the engine's Ghost
 * Portfolio engine use.
 *
 *   HOLD   = passive hold of the underlying            (= 1.0 per share)
 *   GHOST  = signals at stamped price (perfect fill)
 *   ACTUAL = paper fills including cost
 *
 * Decomposition (exact, in underlying):
 *   total alpha     = ACTUAL - HOLD
 *   signal alpha    = GHOST  - HOLD       (call quality)
 *   execution alpha = ACTUAL - GHOST      (cost / slippage)
 *
 * Once a deployed SpotVault is live for an asset, ACTUAL can be cross-
 * checked against vault.getNavPerShare() (read on-chain via wagmi) — the
 * paper line and the on-chain line should track within trade-cost noise.
 */

import { useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Entry = {
  bar_ts: string;
  asset: string;
  price: number;
  hold_nav: number;
  ghost_nav: number;
  actual_nav: number;
};

type Point = {
  t: string;
  hold: number;
  ghost: number;
  actual: number;
};

const COLOR = {
  hold:   "rgba(255,255,255,0.45)",
  ghost:  "#7c5cff",
  actual: "#27d182",
  grid:   "rgba(255,255,255,0.06)",
  text:   "rgba(255,255,255,0.5)",
};

const BUDGET = 100_000;   // matches forward_recorder.py's BUDGET constant

export default function GhostPortfolioTile({ asset }: { asset: string }) {
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/forward_ledger.jsonl", { cache: "no-store" })
      .then((r) => (r.ok ? r.text() : Promise.reject(r.status)))
      .then((txt) => {
        if (!alive) return;
        const rows: Entry[] = txt
          .split("\n")
          .filter(Boolean)
          .map((l) => {
            try { return JSON.parse(l); } catch { return null; }
          })
          .filter((e): e is Entry => e != null && e.asset === asset);
        setEntries(rows);
      })
      .catch((e) => alive && setErr(String(e)));
    return () => { alive = false; };
  }, [asset]);

  const { data, finals } = useMemo(() => {
    if (!entries || entries.length === 0)
      return { data: [] as Point[], finals: null as null | { hold: number; ghost: number; actual: number } };

    const p0 = entries[0].price;
    const data: Point[] = entries.map((e) => ({
      t: e.bar_ts.slice(0, 10),                                  // YYYY-MM-DD
      hold: 1.0,                                                 // passive HOLD per share, normalised
      ghost:  (e.ghost_nav  * p0) / (BUDGET * e.price),
      actual: (e.actual_nav * p0) / (BUDGET * e.price),
    }));
    const last = data[data.length - 1];
    return { data, finals: { hold: last.hold, ghost: last.ghost, actual: last.actual } };
  }, [entries]);

  return (
    <div
      className="rounded-2xl p-6 mb-8"
      style={{ background: "#1c1c21", border: "1px solid #2a2f3a" }}
    >
      <div className="flex items-center justify-between mb-4">
        <h3
          className="text-sm font-semibold uppercase tracking-widest"
          style={{ color: "rgba(106,111,117,0.9)" }}
        >
          Strategy attribution — HOLD / GHOST / ACTUAL (in {asset})
        </h3>
        <span
          className="text-xs px-2 py-0.5 rounded-full"
          style={{ background: "rgba(124,92,255,0.15)", color: COLOR.ghost, fontWeight: 600 }}
        >
          forward-only, hash-chained
        </span>
      </div>

      {err && (
        <div className="text-xs py-6 text-center" style={{ color: "rgba(255,107,107,0.8)" }}>
          ledger not yet published — {err}
        </div>
      )}

      {!err && (!entries || entries.length === 0) && (
        <div className="text-xs py-6 text-center" style={{ color: "rgba(106,111,117,0.8)" }}>
          Track record starts when the first signal posts. The forward
          recorder runs hourly; once it has data for {asset}, this tile lights up.
        </div>
      )}

      {!err && entries && entries.length > 0 && (
        <>
          <ResponsiveContainer width="100%" height={240}>
            {/* left:-20 clipped the leading digits off longer Y ticks ("1.3455"
                read as "3455"); keep the axis fully visible. */}
            <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -6 }}>
              <defs>
                <linearGradient id="actualGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={COLOR.actual} stopOpacity={0.22} />
                  <stop offset="95%" stopColor={COLOR.actual} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={COLOR.grid} />
              <XAxis dataKey="t" tick={{ fill: COLOR.text, fontSize: 11 }} />
              <YAxis tick={{ fill: COLOR.text, fontSize: 11 }} domain={["dataMin", "dataMax"]} tickFormatter={(v) => Number(v).toFixed(3)} width={52} />
              <Tooltip
                contentStyle={{ background: "#1c1c21", border: "1px solid #2a2f3a", borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: "rgba(255,255,255,0.5)" }}
                formatter={(v) => (typeof v === "number" ? v.toFixed(4) : String(v))}
              />
              <Legend wrapperStyle={{ fontSize: 12, color: COLOR.text }} />
              {/* Animation disabled: the entry animation raced visibility on
                  slow renders and the chart could screenshot/paint empty. */}
              <Line type="monotone" dataKey="hold"  stroke={COLOR.hold}  strokeWidth={1.5} dot={false} name="HOLD" isAnimationActive={false} />
              <Line type="monotone" dataKey="ghost" stroke={COLOR.ghost} strokeWidth={2}   dot={false} name="GHOST" isAnimationActive={false} />
              <Area type="monotone" dataKey="actual" stroke={COLOR.actual} strokeWidth={2} fill="url(#actualGrad)" dot={false} name="ACTUAL" isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>

          {finals && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-5 text-xs">
              <Stat label="HOLD per share"   value={finals.hold.toFixed(4) + ` ${asset}`} hint="passive baseline" />
              <Stat label="GHOST per share"  value={finals.ghost.toFixed(4) + ` ${asset}`} hint="perfect-fill signals" tone="ghost" />
              <Stat label="ACTUAL per share" value={finals.actual.toFixed(4) + ` ${asset}`} hint="paper fills, incl. cost" tone="actual" />
              <Stat label="Total alpha"      value={pct(finals.actual - finals.hold)} hint="ACTUAL − HOLD" />
              <Stat label="Signal alpha"     value={pct(finals.ghost - finals.hold)}  hint="GHOST − HOLD (call quality)" tone="ghost" />
              <Stat label="Execution alpha"  value={pct(finals.actual - finals.ghost)} hint="ACTUAL − GHOST (cost/slippage)" tone="actual" />
            </div>
          )}
        </>
      )}
    </div>
  );
}

function pct(x: number): string {
  return (x >= 0 ? "+" : "") + (x * 100).toFixed(1) + "%";
}

function Stat({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: "ghost" | "actual" }) {
  const accent = tone === "ghost" ? COLOR.ghost : tone === "actual" ? COLOR.actual : "rgba(255,255,255,0.85)";
  return (
    <div
      className="p-3 rounded-lg"
      style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(42,47,58,0.6)", fontFamily: "'Space Mono', monospace" }}
    >
      <div className="uppercase tracking-widest" style={{ color: "rgba(106,111,117,0.9)", fontSize: 10 }}>
        {label}
      </div>
      <div className="mt-1" style={{ color: accent, fontSize: 14, fontWeight: 600 }}>
        {value}
      </div>
      {hint && (
        <div className="mt-0.5" style={{ color: "rgba(106,111,117,0.7)", fontSize: 10 }}>
          {hint}
        </div>
      )}
    </div>
  );
}
