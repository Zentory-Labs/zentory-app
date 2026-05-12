"use client";

import type { Research } from "@/lib/research";

const EXPLORER_BASE = "https://hypurrscan.io/tx";

function formatTimestamp(ts: number): string {
  return new Date(ts).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

function DirectionBadge({ direction }: { direction: Research["direction"] }) {
  const classes =
    direction === "LONG"
      ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
      : direction === "SHORT"
      ? "bg-red-500/10 text-red-400 border border-red-500/20"
      : "bg-white/[0.06] text-white/60 border border-white/10";
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-semibold uppercase tracking-wider ${classes}`}
    >
      {direction}
    </span>
  );
}

function StatusBadge({ status }: { status: Research["status"] }) {
  const classes =
    status === "executed"
      ? "bg-emerald-500/10 text-emerald-400"
      : status === "failed"
      ? "bg-red-500/10 text-red-400"
      : "bg-[#f59e0b]/10 text-[#f59e0b]";
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-semibold capitalize ${classes}`}
    >
      {status}
    </span>
  );
}

function ContributorBadge({ provider }: { provider: Research["provider"] }) {
  const label = provider === "gp" ? "GP" : provider === "lumibot" ? "Lumibot" : "Manual";
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono bg-white/[0.06] text-white/60 border border-white/10">
      {label}
    </span>
  );
}

function TxLink({ hash }: { hash: string }) {
  return (
    <a
      href={`${EXPLORER_BASE}/${hash}`}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 transition-colors text-xs"
      style={{ color: "#b08d57" }}
      onMouseEnter={(e) => (e.currentTarget.style.color = "#c2353f")}
      onMouseLeave={(e) => (e.currentTarget.style.color = "#b08d57")}
    >
      {hash.slice(0, 10)}…{hash.slice(-6)}
    </a>
  );
}

interface ResearchTableProps {
  research: Research[];
}

export default function ResearchTable({ research }: ResearchTableProps) {
  if (research.length === 0) {
    return (
      <div className="glass-card p-8 text-center">
        <svg
          className="mx-auto mb-4 h-12 w-12 opacity-30"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
        <p className="text-sm font-medium text-white/70">No research yet</p>
        <p className="mt-1 text-xs text-white/50">Publish research via the form below to get started.</p>
      </div>
    );
  }

  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full text-sm text-left">
        <thead className="border-b border-white/10 bg-white/[0.03]">
          <tr>
            <th className="px-4 py-3 text-xs font-medium text-white/50 uppercase tracking-wider">Timestamp</th>
            <th className="px-4 py-3 text-xs font-medium text-white/50 uppercase tracking-wider">Contributor</th>
            <th className="px-4 py-3 text-xs font-medium text-white/50 uppercase tracking-wider">Asset</th>
            <th className="px-4 py-3 text-xs font-medium text-white/50 uppercase tracking-wider">Direction</th>
            <th className="px-4 py-3 text-xs font-medium text-white/50 uppercase tracking-wider text-right">Size</th>
            <th className="px-4 py-3 text-xs font-medium text-white/50 uppercase tracking-wider text-right">Price</th>
            <th className="px-4 py-3 text-xs font-medium text-white/50 uppercase tracking-wider">Status</th>
            <th className="px-4 py-3 text-xs font-medium text-white/50 uppercase tracking-wider">TX Hash</th>
          </tr>
        </thead>
        <tbody>
          {research.map((sig, index) => (
            <tr
              key={sig.id}
              className={`transition-colors ${
                index % 2 === 0
                  ? "bg-white/[0.02] hover:bg-white/[0.04]"
                  : "bg-transparent hover:bg-white/[0.03]"
              }`}
            >
              <td className="px-4 py-3 text-white/70 font-mono text-xs whitespace-nowrap">
                {sig.timestamp ? formatTimestamp(sig.timestamp) : "—"}
              </td>
              <td className="px-4 py-3">
                <ContributorBadge provider={sig.provider} />
              </td>
              <td className="px-4 py-3">
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-white/[0.06] text-white/80 border border-white/10 font-mono">
                  {sig.asset}
                </span>
              </td>
              <td className="px-4 py-3">
                <DirectionBadge direction={sig.direction} />
              </td>
              <td className="px-4 py-3 text-right text-white/70 font-mono text-xs whitespace-nowrap">
                {sig.size.toLocaleString(undefined, { maximumFractionDigits: 4 })}
              </td>
              <td className="px-4 py-3 text-right text-white/70 font-mono text-xs whitespace-nowrap">
                ${sig.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </td>
              <td className="px-4 py-3">
                <StatusBadge status={sig.status} />
              </td>
              <td className="px-4 py-3">
                {sig.txHash ? <TxLink hash={sig.txHash} /> : <span className="text-white/30 text-xs">—</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
