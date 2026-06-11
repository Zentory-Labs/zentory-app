"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine,
} from "recharts";
import { useDemoMode, DemoBadge } from "@/lib/demo/context";
import { addresses, demoProviderLabel } from "@/lib/contracts";

// ─── /providers/[provider] ────────────────────────────────────────────────────
// Public, verifiable track record for a single signal/research provider. Renders
// REAL settled-epoch history from /api/leaderboard/[provider] (Supabase epoch_history,
// fed by the on-chain EpochScoring contract). On testnet, most providers have no
// settled epochs yet — we show an honest empty state rather than invent numbers.
// Demo mode synthesizes a clearly-labelled sample so the investor walkthrough is whole.

const GOLD = "#B08D57";
const GRAY = "#8A8F98";
const RED = "#C2353F";
const TEXT = "#eaeaea";
const EXPLORER = "https://app.hyperliquid-testnet.xyz/explorer/address";

type Epoch = { epochId: number; avgAccuracyBps: number; totalPayoutZent: string; settledSignals: number };
type Summary = {
  rank: number; provider: string; providerShort: string;
  totalSignals: number; resolvedSignals: number;
  accuracyPercent: number; accuracyGrade: string;
  zentEarned: string; lastSignal: string; assetClasses: string[];
};

function short(addr: string) {
  return addr.length > 12 ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : addr;
}

// Deterministic demo history so a given address always renders the same sample.
function demoEpochs(addr: string): Epoch[] {
  let seed = 0;
  for (let i = 0; i < addr.length; i++) seed = (seed * 31 + addr.charCodeAt(i)) % 100000;
  const rng = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
  const out: Epoch[] = [];
  let acc = 58 + rng() * 12;
  for (let e = 12; e >= 1; e--) {
    acc = Math.max(48, Math.min(82, acc + (rng() - 0.45) * 7));
    out.push({
      epochId: e,
      avgAccuracyBps: Math.round(acc * 100),
      totalPayoutZent: (rng() * 800 + 50).toFixed(2),
      settledSignals: Math.floor(rng() * 8) + 2,
    });
  }
  return out;
}

function StatCard({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <div className="text-[11px] uppercase tracking-wider mb-2" style={{ color: "rgba(234,234,234,0.45)" }}>{label}</div>
      <div className="text-2xl font-bold tabular-nums" style={{ color: accent ?? TEXT }}>{value}</div>
      {sub && <div className="text-[10px] mt-1" style={{ color: "rgba(234,234,234,0.4)" }}>{sub}</div>}
    </div>
  );
}

export default function ProviderPage() {
  const params = useParams<{ provider: string }>();
  const provider = (params?.provider ?? "").toLowerCase();
  const { enabled: demoMode } = useDemoMode();

  const [epochs, setEpochs] = useState<Epoch[] | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!provider) return;
    let cancelled = false;
    setLoading(true);
    Promise.all([
      fetch(`/api/leaderboard/${provider}`, { cache: "no-store" }).then((r) => r.ok ? r.json() : { epochs: [] }).catch(() => ({ epochs: [] })),
      fetch(`/api/leaderboard`, { cache: "no-store" }).then((r) => r.ok ? r.json() : { providers: [] }).catch(() => ({ providers: [] })),
    ]).then(([detail, list]) => {
      if (cancelled) return;
      const real: Epoch[] = detail?.epochs ?? [];
      const sum: Summary | null = (list?.providers ?? []).find((p: Summary) => p.provider?.toLowerCase() === provider) ?? null;
      if (real.length === 0 && demoMode) {
        setEpochs(demoEpochs(provider));
      } else {
        setEpochs(real);
      }
      setSummary(sum);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [provider, demoMode]);

  const chartData = useMemo(
    () => (epochs ?? []).slice().sort((a, b) => a.epochId - b.epochId).map((e) => ({
      epoch: `#${e.epochId}`,
      accuracy: e.avgAccuracyBps / 100,
      payout: Number(e.totalPayoutZent),
      signals: e.settledSignals,
    })),
    [epochs],
  );

  const derived = useMemo(() => {
    if (!epochs || epochs.length === 0) return null;
    const totalSignals = epochs.reduce((s, e) => s + e.settledSignals, 0);
    const totalPayout = epochs.reduce((s, e) => s + Number(e.totalPayoutZent), 0);
    const avgAcc = epochs.reduce((s, e) => s + e.avgAccuracyBps, 0) / epochs.length / 100;
    return { totalSignals, totalPayout, avgAcc, settledEpochs: epochs.length };
  }, [epochs]);

  const label = demoProviderLabel(provider) ?? short(provider);
  const accPct = summary?.accuracyPercent ?? derived?.avgAcc ?? 0;
  const isDemoData = demoMode && (summary == null) && (epochs?.length ?? 0) > 0 && !loading;

  return (
    <div className="space-y-8 pb-16">
      <Link href="/leaderboard" className="text-xs uppercase tracking-wider" style={{ color: GOLD }}>← Leaderboard</Link>

      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-bold tracking-tight" style={{ color: TEXT }}>{label}</h1>
          {summary && summary.rank > 0 && (
            <span className="px-2.5 py-1 rounded-lg text-xs font-semibold" style={{ background: `${GOLD}22`, color: GOLD }}>Rank #{summary.rank}</span>
          )}
          {isDemoData && <DemoBadge />}
        </div>
        <p className="font-mono text-xs break-all" style={{ color: "rgba(234,234,234,0.5)" }}>{provider}</p>
        <p className="text-sm max-w-2xl" style={{ color: "rgba(234,234,234,0.6)" }}>
          A provider&apos;s track record is built from signals scored on-chain in 4-hour epochs by the{" "}
          <a href={`${EXPLORER}/${addresses.EpochScoring}`} target="_blank" rel="noopener noreferrer" className="underline" style={{ color: GOLD }}>EpochScoring</a>{" "}
          contract — append-only and independently verifiable. This is the reputation layer: performance is
          recorded, not advertised.
        </p>
      </header>

      {loading && <div className="text-sm" style={{ color: "rgba(234,234,234,0.5)" }}>Loading track record…</div>}

      {!loading && (!epochs || epochs.length === 0) && (
        <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-8 space-y-3">
          <h2 className="text-lg font-semibold" style={{ color: TEXT }}>No scored epochs yet</h2>
          <p className="text-sm max-w-2xl" style={{ color: "rgba(234,234,234,0.6)" }}>
            A signal goes through two stages: it <em>resolves</em> when its horizon expires (the outcome is
            known), then its accuracy is <em>scored</em> in a settled epoch by EpochScoring. We don&apos;t show
            projected or sample numbers on a real profile — the moment this provider has a scored epoch, the
            charts render here.
            {summary && (
              <> Live so far: <strong style={{ color: TEXT }}>{summary.totalSignals}</strong> signals submitted,{" "}
              <strong style={{ color: TEXT }}>{summary.resolvedSignals}</strong> resolved and awaiting accuracy
              settlement.</>
            )}
          </p>
          <p className="text-sm" style={{ color: "rgba(234,234,234,0.6)" }}>
            Want to see a record that <em>is</em> running? The house systematic strategy publishes a live,
            hash-chained track record every 4 hours —{" "}
            <Link href="/track-record" className="underline" style={{ color: GOLD }}>see it here</Link> and the{" "}
            <Link href="/backtest" className="underline" style={{ color: GOLD }}>6-year backtest here</Link>.
          </p>
        </section>
      )}

      {!loading && epochs && epochs.length > 0 && (
        <>
          {isDemoData && (
            <p className="text-xs" style={{ color: "rgba(234,234,234,0.5)" }}>
              Demo mode: sample epoch history shown for walkthrough. Real profiles render only on-chain-settled data.
            </p>
          )}

          <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Accuracy (avg)" value={`${accPct.toFixed(1)}%`} sub={summary ? `grade ${summary.accuracyGrade}` : undefined} accent={accPct >= 60 ? "#34d399" : RED} />
            <StatCard label="Settled epochs" value={String(derived?.settledEpochs ?? 0)} sub="scored on-chain" />
            <StatCard label="Signals (settled)" value={String(derived?.totalSignals ?? summary?.resolvedSignals ?? 0)} sub={summary ? `${summary.totalSignals} submitted` : undefined} />
            <StatCard label="ZENT earned" value={(summary ? Number(summary.zentEarned) : (derived?.totalPayout ?? 0)).toLocaleString("en", { maximumFractionDigits: 0 })} sub="accuracy payouts" accent={GOLD} />
          </section>

          <section className="space-y-2">
            <h3 className="text-lg font-semibold" style={{ color: TEXT }}>Accuracy by epoch</h3>
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4" style={{ height: 300 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 10, right: 16, bottom: 0, left: 0 }}>
                  <CartesianGrid stroke="rgba(255,255,255,0.06)" />
                  <XAxis dataKey="epoch" tick={{ fill: "rgba(234,234,234,0.4)", fontSize: 11 }} />
                  <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fill: "rgba(234,234,234,0.4)", fontSize: 11 }} width={40} />
                  <Tooltip
                    contentStyle={{ background: "#12141a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, color: TEXT }}
                    formatter={((v: unknown) => [`${Number(v).toFixed(1)}%`, "Accuracy"]) as never}
                  />
                  <ReferenceLine y={50} stroke="rgba(255,255,255,0.2)" strokeDasharray="3 3" />
                  <Line type="monotone" dataKey="accuracy" stroke={GOLD} dot={{ r: 2 }} strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className="space-y-2">
            <h3 className="text-lg font-semibold" style={{ color: TEXT }}>ZENT payout by epoch</h3>
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4" style={{ height: 240 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 16, bottom: 0, left: 0 }}>
                  <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                  <XAxis dataKey="epoch" tick={{ fill: "rgba(234,234,234,0.4)", fontSize: 11 }} />
                  <YAxis tick={{ fill: "rgba(234,234,234,0.4)", fontSize: 11 }} width={48} />
                  <Tooltip
                    contentStyle={{ background: "#12141a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, color: TEXT }}
                    formatter={((v: unknown) => [`${Number(v).toLocaleString()} ZENT`, "Payout"]) as never}
                  />
                  <Bar dataKey="payout" fill={GOLD} radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className="space-y-2">
            <h3 className="text-lg font-semibold" style={{ color: TEXT }}>Epoch history</h3>
            <div className="overflow-x-auto rounded-2xl border border-white/10">
              <table className="w-full min-w-[480px] text-xs tabular-nums">
                <thead>
                  <tr className="border-b border-white/10 text-left" style={{ color: "rgba(234,234,234,0.5)" }}>
                    {["Epoch", "Accuracy", "Settled signals", "ZENT payout"].map((h) => (
                      <th key={h} className="px-4 py-3 font-medium uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody style={{ color: "rgba(234,234,234,0.75)" }}>
                  {chartData.slice().reverse().map((e) => (
                    <tr key={e.epoch} className="border-b border-white/5">
                      <td className="px-4 py-2.5 font-semibold">{e.epoch}</td>
                      <td className="px-4 py-2.5" style={{ color: e.accuracy >= 50 ? "#34d399" : RED }}>{e.accuracy.toFixed(1)}%</td>
                      <td className="px-4 py-2.5">{e.signals}</td>
                      <td className="px-4 py-2.5">{e.payout.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      {/* Persistent reference: how this record is verified + the house benchmark. */}
      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 space-y-2 text-sm" style={{ color: "rgba(234,234,234,0.7)" }}>
        <h3 className="text-base font-semibold" style={{ color: TEXT }}>The verification standard</h3>
        <p>
          Every provider is scored the same way the house strategy is: append-only, hash-chained, and reproducible.
          Compare against the reference systematic strategy —{" "}
          <Link href="/track-record" className="underline" style={{ color: GOLD }}>live track record</Link>{" "}and the{" "}
          <Link href="/backtest" className="underline" style={{ color: GOLD }}>6-year walk-forward backtest</Link>.
          Accuracy is settled on-chain by{" "}
          <a href={`${EXPLORER}/${addresses.EpochScoring}`} target="_blank" rel="noopener noreferrer" className="underline" style={{ color: GOLD }}>EpochScoring</a>.
        </p>
      </section>
    </div>
  );
}
