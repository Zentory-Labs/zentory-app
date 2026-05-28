"use client";

/**
 * Live signal widget — shows the most recent forward-recorder entry for an
 * asset: deployed target (LONG / FLAT), raw continuous ensemble value, age
 * of the signal, and the stamped price. Reads the publicly-served snapshot
 * of the engine's forward_ledger.jsonl that `publish_ledger.py` pushes here.
 */

import { useEffect, useState } from "react";

type LedgerEntry = {
  bar_ts: string;          // ISO Z
  recorded_at: string;
  asset: string;
  model?: string;
  target_frac: number;     // raw continuous ensemble in [0,1]
  target_weight: number;   // deployed (post-hysteresis) in {0,1}
  price: number;
};

function timeAgo(iso: string): string {
  const t = new Date(iso).getTime();
  const dt = Math.max(0, Date.now() - t) / 1000;
  if (dt < 60) return `${Math.round(dt)}s ago`;
  if (dt < 3600) return `${Math.round(dt / 60)}m ago`;
  if (dt < 86400) return `${(dt / 3600).toFixed(1)}h ago`;
  return `${(dt / 86400).toFixed(1)}d ago`;
}

export default function LiveSignalWidget({ asset }: { asset: string }) {
  const [latest, setLatest] = useState<LedgerEntry | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/forward_ledger.jsonl", { cache: "no-store" })
      .then((r) => (r.ok ? r.text() : Promise.reject(r.status)))
      .then((txt) => {
        if (!alive) return;
        const rows: LedgerEntry[] = txt
          .split("\n")
          .filter(Boolean)
          .map((l) => {
            try { return JSON.parse(l); } catch { return null; }
          })
          .filter((e): e is LedgerEntry => e != null && e.asset === asset);
        setLatest(rows.length ? rows[rows.length - 1] : null);
      })
      .catch((e) => alive && setErr(String(e)));
    return () => { alive = false; };
  }, [asset]);

  if (err || !latest) {
    return (
      <div
        className="rounded-2xl p-4 mb-4 flex items-center justify-between"
        style={{ background: "#1c1c21", border: "1px solid #2a2f3a", color: "rgba(106,111,117,0.9)" }}
      >
        <div className="text-xs uppercase tracking-widest">Live signal</div>
        <div className="text-xs">{err ? "ledger not yet published" : "waiting for first entry…"}</div>
      </div>
    );
  }

  const isLong = latest.target_weight >= 0.5;
  const badgeBg = isLong ? "rgba(39,209,130,0.15)" : "rgba(255,255,255,0.06)";
  const badgeFg = isLong ? "#27d182" : "rgba(255,255,255,0.6)";

  return (
    <div
      className="rounded-2xl p-4 mb-4 flex flex-wrap items-center gap-4 justify-between"
      style={{ background: "#1c1c21", border: "1px solid #2a2f3a", fontFamily: "'Space Mono', monospace" }}
    >
      <div className="flex items-center gap-3">
        <div className="text-xs uppercase tracking-widest" style={{ color: "rgba(106,111,117,0.9)" }}>
          Live signal
        </div>
        <span
          className="text-xs px-2 py-0.5 rounded-full"
          style={{ background: badgeBg, color: badgeFg, fontWeight: 600 }}
        >
          {isLong ? "LONG" : "FLAT"}
        </span>
      </div>
      <div className="flex gap-5 text-xs" style={{ color: "rgba(255,255,255,0.7)" }}>
        <div>
          <span style={{ color: "rgba(106,111,117,0.9)" }}>raw ensemble </span>
          {latest.target_frac.toFixed(2)}
        </div>
        <div>
          <span style={{ color: "rgba(106,111,117,0.9)" }}>price </span>
          ${latest.price.toLocaleString("en-US", { maximumFractionDigits: 2 })}
        </div>
        <div>
          <span style={{ color: "rgba(106,111,117,0.9)" }}>bar </span>
          {latest.bar_ts.replace("T", " ").replace("Z", "")}Z
        </div>
        <div>
          <span style={{ color: "rgba(106,111,117,0.9)" }}>age </span>
          {timeAgo(latest.recorded_at)}
        </div>
      </div>
    </div>
  );
}
