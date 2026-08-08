"use client";

import { useEffect, useState } from "react";

// ─── /track-record ────────────────────────────────────────────────────────────
// The protocol's proof asset: renders the REAL public forward ledger (the same
// hash-chained JSONL the Railway recorder publishes every 4h) with per-asset
// HOLD vs GHOST vs ACTUAL, the recent bars, and instructions to verify the
// chain independently. No mock data — if the fetch fails, we say so.

type Entry = {
  asset: string;
  bar_ts: string;
  /** Wall-clock time the recorder appended this line. Present on every entry. */
  recorded_at?: string;
  price: number;
  weight?: number;
  hold_nav: number;
  ghost_nav: number;
  actual_nav: number;
  prev_hash?: string;
  hash?: string;
};

const ASSETS = ["BTC", "ETH", "SOL", "XRP"] as const;
const BUDGET = 100_000; // paper budget each line starts from

// The recorder appends every 4h. Allow one missed bar plus slack before we call
// the record stale — anything past this and the publisher is not running.
const EPOCH_HOURS = 4;
const STALE_AFTER_HOURS = 9;

function pct(x: number, d = 1): string {
  return `${x >= 0 ? "+" : ""}${(x * 100).toFixed(d)}%`;
}

/** "3d 4h" / "5h" / "22m" — coarse, honest, no false precision. */
function humanAge(ms: number): string {
  const mins = Math.max(0, Math.floor(ms / 60_000));
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  const remHours = hours % 24;
  return remHours ? `${days}d ${remHours}h` : `${days}d`;
}

export default function TrackRecordPage() {
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [error, setError] = useState(false);
  // Wall clock. null during SSR/first paint so the server and client agree;
  // set on mount and refreshed so a page left open goes stale on its own.
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    fetch("/forward_ledger.jsonl", { cache: "no-store" })
      .then((r) => (r.ok ? r.text() : Promise.reject(new Error(String(r.status)))))
      .then((text) => {
        const rows = text
          .split("\n")
          .filter(Boolean)
          .map((l) => {
            try { return JSON.parse(l) as Entry } catch { return null }
          })
          .filter((e): e is Entry => !!e && typeof e.hold_nav === "number");
        setEntries(rows);
      })
      .catch(() => setError(true));
  }, []);

  const latest = new Map<string, Entry>();
  const firstBar = entries?.[0]?.bar_ts;
  const headEntry = entries?.[entries.length - 1];
  const lastBar = headEntry?.bar_ts;
  if (entries) for (const e of entries) latest.set(e.asset, e);
  const daysLive =
    firstBar && lastBar
      ? Math.max(1, Math.round((Date.parse(lastBar) - Date.parse(firstBar)) / 86_400_000))
      : 0;
  const recent = entries ? entries.slice(-12).reverse() : [];

  // ─── Freshness ──────────────────────────────────────────────────────────────
  // Audit finding #30. `daysLive` is computed purely from the ledger's own
  // first and last bar, so a green "Recording live — day N" badge rendered
  // indefinitely no matter how old the head was — it sat over a 30-day-old
  // head for a month while the publisher was frozen. Liveness has to be
  // measured against the wall clock, not against the file's own endpoints.
  const headTsRaw = headEntry?.recorded_at ?? lastBar;
  const headMs = headTsRaw ? Date.parse(headTsRaw) : NaN;
  const headAgeMs =
    now !== null && Number.isFinite(headMs) ? Math.max(0, now - headMs) : null;
  const isStale = headAgeMs !== null && headAgeMs > STALE_AFTER_HOURS * 3_600_000;
  const isFresh = headAgeMs !== null && !isStale;
  const headIso = Number.isFinite(headMs)
    ? new Date(headMs).toISOString().replace("T", " ").slice(0, 16) + " UTC"
    : null;

  return (
    <div className="space-y-10 pb-16">
      <header className="space-y-3">
        <h1 className="text-4xl font-bold tracking-tight" style={{ color: "#eaeaea" }}>
          {isStale ? "Paper Track Record" : "Live Paper Track Record"}
        </h1>
        <p className="text-sm max-w-2xl" style={{ color: "#bfc3c7" }}>
          {isStale
            ? "The strategy's decision and three NAV lines are appended to a public, hash-chained ledger on a 4-hour cadence — published before the future is known, impossible to edit after the fact. Publishing is currently stalled; see the notice below."
            : "Every 4 hours, the strategy's decision and three NAV lines are appended to a public, hash-chained ledger — published before the future is known, impossible to edit after the fact."}{" "}
          <span style={{ color: "#eaeaea" }}>HOLD</span> = just holding,{" "}
          <span style={{ color: "#eaeaea" }}>GHOST</span> = the strategy at signed
          prices, <span style={{ color: "#eaeaea" }}>ACTUAL</span> = with simulated
          costs. Paper record on real market prices — not live capital, not a guarantee of future
          results.
        </p>
        <p className="text-sm max-w-2xl" style={{ color: "#bfc3c7" }}>
          <span style={{ color: "#b08d57", fontWeight: 600 }}>The benchmark is the asset, not dollars.</span>{" "}
          Each vault is denominated in its underlying, so &ldquo;ahead of holding&rdquo; below means
          <em> more of the coin</em> (more sats for BTC): the goal is to finish a cycle holding more of the
          asset than buy-and-hold, by sitting in cash through downturns and rebuying lower. It&apos;s drawdown
          insurance — in a straight-up rally the strategy can end with <em>less</em> than holding (the cost of
          stepping aside). This {daysLive}-day window is a single regime, far too short to judge; the 6-year
          backtest is what tests the full cycle.
        </p>
        {/* Liveness badge — gated on wall-clock freshness, never on daysLive
            alone. The absolute head timestamp is always printed next to it so
            staleness is visible even if the badge logic is ever wrong again. */}
        {isFresh && daysLive > 0 && (
          <p className="text-xs uppercase tracking-[0.2em]" style={{ color: "#34d399" }}>
            ● Recording live — day {daysLive}
            {headAgeMs !== null && headIso && (
              <span style={{ color: "#6a6f75", letterSpacing: "0.05em" }}>
                {" "}· last entry {humanAge(headAgeMs)} ago ({headIso})
              </span>
            )}
          </p>
        )}

        {isStale && headAgeMs !== null && (
          <div
            className="rounded-xl border p-4 text-sm max-w-2xl"
            style={{
              borderColor: "rgba(194,53,63,0.35)",
              background: "rgba(194,53,63,0.10)",
              color: "#eaeaea",
            }}
            role="alert"
          >
            <div
              className="text-xs uppercase tracking-[0.2em] mb-1"
              style={{ color: "#c2353f" }}
            >
              ● Publishing stalled — not recording
            </div>
            <p style={{ color: "#bfc3c7" }}>
              The newest ledger entry is <strong style={{ color: "#eaeaea" }}>{humanAge(headAgeMs)} old</strong>
              {headIso && <> ({headIso})</>}, against a {EPOCH_HOURS}-hour publishing cadence. The{" "}
              {daysLive}-day record below is real and its hash chain still verifies, but it stops at
              that entry — treat everything on this page as a snapshot as of then, not as live.
            </p>
          </div>
        )}
        <p className="text-sm" style={{ color: "#bfc3c7" }}>
          Want the long view?{" "}
          <a href="/backtest" className="underline" style={{ color: "#B08D57" }}>
            See the 6-year walk-forward backtest →
          </a>
        </p>
      </header>

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-6 text-sm" style={{ color: "#eaeaea" }}>
          Couldn&apos;t load the ledger right now — fetch{" "}
          <code className="text-xs">/forward_ledger.jsonl</code> directly or retry shortly.
        </div>
      )}

      {/* Per-asset summary */}
      {entries && (
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {ASSETS.filter((a) => latest.has(a)).map((a) => {
            const e = latest.get(a)!;
            const stratRet = e.actual_nav / BUDGET - 1;   // absolute: what the strategy actually did
            const holdRet = e.hold_nav / BUDGET - 1;       // absolute: what holding did
            const vsHold = e.actual_nav / e.hold_nav - 1;  // the gap = mostly loss avoided
            return (
              <div key={a} className="rounded-2xl border border-[#2a2f3a] bg-[#1c1c21] p-5 space-y-3">
                <div className="flex items-baseline justify-between">
                  <span className="text-lg font-semibold" style={{ color: "#eaeaea" }}>{a}</span>
                  <span className={`text-lg font-bold tabular-nums ${vsHold >= 0 ? "text-[#34d399]" : "text-[#c2353f]"}`}>
                    {pct(vsHold)}
                  </span>
                </div>
                <div className="text-[11px] uppercase tracking-wider" style={{ color: "#6a6f75" }}>
                  ahead of holding
                </div>
                {/* Make the decomposition explicit so "+X%" is never read as trading profit */}
                <div className="space-y-1 text-xs tabular-nums" style={{ color: "#bfc3c7" }}>
                  <div className="flex justify-between">
                    <span>Strategy return</span>
                    <span className={stratRet >= 0 ? "text-[#34d399]" : "text-[#c2353f]"}>{pct(stratRet, 1)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Holding return</span>
                    <span className={holdRet >= 0 ? "text-[#34d399]" : "text-[#c2353f]"}>{pct(holdRet, 1)}</span>
                  </div>
                  <div className="flex justify-between pt-1 border-t border-white/5" style={{ color: "#bfc3c7" }}>
                    <span>last price</span><span>${e.price.toLocaleString()}</span>
                  </div>
                </div>
                <div className="text-[10px] leading-snug" style={{ color: "#6a6f75" }}>
                  The gap is mostly <span style={{ color: "#bfc3c7" }}>loss avoided</span>, not trading
                  profit: when the asset falls and the strategy is in cash, it ends ahead by the drawdown it skipped.
                </div>
              </div>
            );
          })}
        </section>
      )}

      {/* Recent bars */}
      {entries && recent.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xl font-semibold" style={{ color: "#eaeaea" }}>Recent entries</h2>
          <div className="overflow-x-auto rounded-2xl border border-[#2a2f3a]">
            <table className="w-full min-w-[640px] text-xs tabular-nums">
              <thead>
                <tr className="border-b border-[#2a2f3a] text-left" style={{ color: "#bfc3c7" }}>
                  {["Bar (UTC)", "Asset", "Price", "HOLD", "ACTUAL", "Chain hash"].map((h) => (
                    <th key={h} className="px-4 py-3 font-medium uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody style={{ color: "#eaeaea" }}>
                {recent.map((e, i) => (
                  <tr key={`${e.asset}-${e.bar_ts}-${i}`} className="border-b border-white/5">
                    <td className="px-4 py-2.5">{e.bar_ts}</td>
                    <td className="px-4 py-2.5 font-semibold">{e.asset}</td>
                    <td className="px-4 py-2.5">${e.price.toLocaleString()}</td>
                    <td className="px-4 py-2.5">${e.hold_nav.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                    <td className="px-4 py-2.5">${e.actual_nav.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                    <td className="px-4 py-2.5 font-mono text-[10px]" style={{ color: "#6a6f75" }}>
                      {(e.hash ?? e.prev_hash ?? "").slice(0, 12)}…
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Verify in 60 seconds */}
      <section className="rounded-2xl border border-[#2a2f3a] bg-[#1c1c21] p-6 space-y-4">
        <h2 className="text-xl font-semibold" style={{ color: "#eaeaea" }}>Verify in 60 seconds</h2>
        <p className="text-sm" style={{ color: "#bfc3c7" }}>
          Each entry commits to the previous one via <code className="text-xs">prev_hash</code> — any edited,
          inserted or deleted entry breaks every hash after it. Recompute the whole chain yourself with two
          commands (Node 18+, no installs):
        </p>
        <pre className="rounded-xl border border-[#2a2f3a] bg-black/40 p-4 font-mono text-xs overflow-x-auto" style={{ color: "#eaeaea" }}>
{`curl -sO https://app.zentorylabs.com/verify_ledger.mjs
curl -s https://app.zentorylabs.com/forward_ledger.jsonl | node verify_ledger.mjs`}
        </pre>
        <div className="space-y-1">
          <div className="text-[11px] uppercase tracking-wider" style={{ color: "#6a6f75" }}>
            expected output
          </div>
          <pre className="rounded-xl border border-[#2a2f3a] bg-black/40 p-4 font-mono text-xs overflow-x-auto" style={{ color: "#34d399" }}>
            {"CHAIN OK — <entries> entries, <assets> assets, head <hash>"}
          </pre>
          <p className="text-xs" style={{ color: "#bfc3c7" }}>
            The entry count grows every 4 hours while the recorder is publishing (the badge above reports whether
            it currently is). Anything other than CHAIN OK exits non-zero and names the first broken line — note
            that the verifier checks the chain&apos;s integrity, not its freshness.
          </p>
        </div>
        <p className="text-sm" style={{ color: "#bfc3c7" }}>
          The verifier is ~100 lines of dependency-free code served from this site (
          <a href="/verify_ledger.mjs" target="_blank" rel="noopener noreferrer" className="underline" style={{ color: "#B08D57" }}>
            read it first
          </a>
          ) and versioned in the public{" "}
          <a href="https://github.com/Zentory-Labs/zentory-app" target="_blank" rel="noopener noreferrer" className="underline" style={{ color: "#B08D57" }}>
            zentory-app repo
          </a>{" "}
          (AGPL).
        </p>
        <ul className="list-disc list-inside space-y-2 text-sm" style={{ color: "#bfc3c7" }}>
          <li>
            Raw ledger:{" "}
            <a href="/forward_ledger.jsonl" target="_blank" rel="noopener noreferrer" className="underline" style={{ color: "#B08D57" }}>
              /forward_ledger.jsonl
            </a>{" "}
            — one JSON entry per asset per 4h bar.
          </li>
          <li>
            Cross-check any bar&apos;s price against a public exchange API (the feed uses Kraken/Coinbase 4h closes).
          </li>
          <li>
            Each 4h update lands as a timestamped pull request in the{" "}
            <a href="https://github.com/Zentory-Labs/zentory-app/pulls?q=is%3Apr+forward+ledger" target="_blank" rel="noopener noreferrer" className="underline" style={{ color: "#B08D57" }}>
              public repo history
            </a>{" "}
            — timestamps are held by GitHub, so entries can&apos;t be backdated.
          </li>
        </ul>
      </section>
    </div>
  );
}
