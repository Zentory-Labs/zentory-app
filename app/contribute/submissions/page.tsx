"use client";

import { useState, useEffect, useCallback } from "react";
import { useAccount } from "wagmi";

interface Research {
  id: number;
  research_id?: string;
  asset_class: string;
  asset_id: string;
  direction: number;
  confidence: number;
  expires_at: number;
  status: string;
  submitted_at: number;
  accuracy?: number;
  payout?: number;
  epoch?: number;
}

const ASSET_CLASSES_FILTER = [
  { value: "", label: "All Classes" },
  { value: "CRYPTO_PERP", label: "Crypto Perp" },
  { value: "CRYPTO_SPOT", label: "Crypto Spot" },
  { value: "EQUITY", label: "Equity" },
  { value: "FOREX", label: "Forex" },
  { value: "COMMODITY", label: "Commodity" },
];

const STATUS_FILTER = [
  { value: "", label: "All Statuses" },
  { value: "Active", label: "Active" },
  { value: "Resolved", label: "Resolved" },
  { value: "Expired", label: "Expired" },
];

function fmtTs(ts: number | null): string {
  if (!ts) return "—";
  return new Date(ts * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

async function fetchResearch(apiKey: string, params: { assetClass?: string; status?: string; limit?: number; offset?: number }): Promise<{ research: Research[]; total: number }> {
  const sp = new URLSearchParams();
  if (params.assetClass) sp.set("assetClass", params.assetClass);
  if (params.status) sp.set("status", params.status);
  if (params.limit) sp.set("limit", String(params.limit));
  if (params.offset) sp.set("offset", String(params.offset));

  const res = await fetch(`/api/contribute/research?${sp.toString()}`, {
    headers: { "x-api-key": apiKey },
  });
  if (!res.ok) return { research: [], total: 0 };
  return res.json();
}

function ResearchTable({ research }: { research: Research[] }) {
  if (research.length === 0) {
    return (
      <div className="text-center py-12">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="rgba(106,111,117,0.3)" strokeWidth="1.5" className="mx-auto mb-3">
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
        </svg>
        <p className="text-sm" style={{ color: "rgba(106,111,117,0.5)", fontFamily: "'Montserrat', sans-serif" }}>No research found</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm" style={{ fontFamily: "'Montserrat', sans-serif" }}>
        <thead>
          <tr style={{ color: "rgba(106,111,117,0.7)", textAlign: "left", borderBottom: "1px solid #2a2f3a" }}>
            {["Time", "Epoch", "Asset", "Class", "Direction", "Confidence", "Accuracy", "Payout", "Expires", "Status"].map((h) => (
              <th key={h} className="pb-3 pr-4 text-xs uppercase tracking-widest font-semibold whitespace-nowrap">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {research.map((s) => {
            const isLong = s.direction > 0;
            const statusColor = s.status === "Active" ? "#22c55e" : s.status === "Resolved" ? "#b08d57" : "#6a6f75";
            const accuracyPct = s.accuracy != null ? `${(s.accuracy / 100).toFixed(1)}%` : "—";
            const payoutColor = s.payout != null ? (s.payout >= 0 ? "#22c55e" : "#ef4444") : undefined;
            return (
              <tr key={s.id} style={{ borderTop: "1px solid #2a2f3a", color: "#eaeaea" }}>
                <td className="py-3 pr-4 text-xs whitespace-nowrap" style={{ color: "rgba(106,111,117,0.7)" }}>
                  {s.submitted_at ? fmtTs(s.submitted_at) : "—"}
                </td>
                <td className="py-3 pr-4 text-xs whitespace-nowrap" style={{ color: "rgba(106,111,117,0.6)" }}>
                  {s.epoch ?? "—"}
                </td>
                <td className="py-3 pr-4 font-semibold whitespace-nowrap">{s.asset_id}</td>
                <td className="py-3 pr-4 text-xs whitespace-nowrap" style={{ color: "rgba(106,111,117,0.6)" }}>{s.asset_class}</td>
                <td className="py-3 pr-4 font-semibold whitespace-nowrap" style={{ color: isLong ? "#22c55e" : "#ef4444" }}>
                  {isLong ? "+ LONG" : "- SHORT"}
                </td>
                <td className="py-3 pr-4 text-xs whitespace-nowrap">{Math.round((s.confidence / 10000) * 100)}%</td>
                <td className="py-3 pr-4 text-xs whitespace-nowrap" style={{ color: payoutColor ?? "inherit" }}>
                  {accuracyPct}
                </td>
                <td className="py-3 pr-4 text-xs whitespace-nowrap" style={{ color: payoutColor ?? "inherit" }}>
                  {s.payout != null ? `${s.payout >= 0 ? "+" : ""}${s.payout}` : "—"}
                </td>
                <td className="py-3 pr-4 text-xs whitespace-nowrap" style={{ color: "rgba(106,111,117,0.6)" }}>
                  {s.expires_at ? fmtTs(s.expires_at) : "—"}
                </td>
                <td className="py-3 pr-4">
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap" style={{ background: `${statusColor}20`, color: statusColor }}>
                    {s.status}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function SubmissionsPage() {
  const { isConnected } = useAccount();
  const [research, setResearch] = useState<Research[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [assetClass, setAssetClass] = useState("");
  const [status, setStatus] = useState("");
  const PAGE_SIZE = 20;

  const loadResearch = useCallback(async () => {
    const apiKey = localStorage.getItem("zent_provider_api_key");
    if (!apiKey) { setLoading(false); return; }
    setLoading(true);
    const result = await fetchResearch(apiKey, {
      assetClass: assetClass || undefined,
      status: status || undefined,
      limit: PAGE_SIZE,
      offset: page * PAGE_SIZE,
    });
    setResearch(result.research);
    setTotal(result.total);
    setLoading(false);
  }, [page, assetClass, status]);

  useEffect(() => { loadResearch(); }, [loadResearch]);

  function exportCsv() {
    if (research.length === 0) return;
    const headers = ["Time", "Epoch", "Asset", "Class", "Direction", "Confidence", "Accuracy", "Payout", "Expires", "Status"];
    const rows = research.map((s) => [
      s.submitted_at ? fmtTs(s.submitted_at) : "",
      s.epoch ?? "",
      s.asset_id,
      s.asset_class,
      s.direction > 0 ? "LONG" : "SHORT",
      `${Math.round((s.confidence / 10000) * 100)}%`,
      s.accuracy != null ? `${(s.accuracy / 100).toFixed(1)}%` : "",
      s.payout != null ? String(s.payout) : "",
      s.expires_at ? fmtTs(s.expires_at) : "",
      s.status,
    ]);
    const csv = [headers, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `research-submissions-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-6">
        <h1 className="text-2xl font-bold mb-3" style={{ color: "#eaeaea", fontFamily: "'Montserrat', sans-serif" }}>Connect your wallet</h1>
        <p className="text-sm" style={{ color: "rgba(234,234,234,0.5)", fontFamily: "'Montserrat', sans-serif" }}>Connect your wallet to view your research submissions.</p>
      </div>
    );
  }

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="w-full space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <div className="w-2 h-2 rounded-full" style={{ background: "#b08d57", boxShadow: "0 0 8px #b08d57" }} />
          <span className="text-xs uppercase tracking-widest font-semibold" style={{ color: "#b08d57", fontFamily: "'Montserrat', sans-serif" }}>Research Contributor</span>
        </div>
        <h1 className="text-3xl font-bold" style={{ color: "#eaeaea", fontFamily: "'Montserrat', sans-serif" }}>Research Submissions</h1>
        <p className="text-sm mt-1" style={{ color: "rgba(106,111,117,0.8)", fontFamily: "'Montserrat', sans-serif" }}>
          Full history of your submitted research across all epochs
        </p>
      </div>

      {/* Filters */}
      <div className="rounded-2xl p-5" style={{ background: "#1c1c21", border: "1px solid #2a2f3a" }}>
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-3 text-xs" style={{ color: "rgba(106,111,117,0.7)", fontFamily: "'Montserrat', sans-serif" }}>
            <span className="uppercase tracking-widest font-semibold">Filters</span>
            <span>·</span>
            <span>{total} total research</span>
          </div>
          <div className="flex items-center gap-3 flex-1 flex-wrap">
            <select
              value={assetClass}
              onChange={(e) => { setAssetClass(e.target.value); setPage(0); }}
              className="rounded-xl px-3 py-2 text-xs outline-none"
              style={{ background: "#0b0b0d", border: "1px solid #2a2f3a", color: "#eaeaea", fontFamily: "'Montserrat', sans-serif" }}
            >
              {ASSET_CLASSES_FILTER.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
            </select>
            <select
              value={status}
              onChange={(e) => { setStatus(e.target.value); setPage(0); }}
              className="rounded-xl px-3 py-2 text-xs outline-none"
              style={{ background: "#0b0b0d", border: "1px solid #2a2f3a", color: "#eaeaea", fontFamily: "'Montserrat', sans-serif" }}
            >
              {STATUS_FILTER.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
            </select>
          </div>
          <button
            onClick={exportCsv}
            disabled={research.length === 0}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all hover:scale-[1.03] disabled:opacity-40"
            style={{ background: "rgba(176,141,87,0.1)", border: "1px solid rgba(176,141,87,0.3)", color: "#b08d57", fontFamily: "'Montserrat', sans-serif" }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Export CSV
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-2xl overflow-hidden" style={{ background: "#1c1c21", border: "1px solid #2a2f3a" }}>
        {loading ? (
          <div className="p-8 space-y-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-10 rounded-xl animate-pulse" style={{ background: "rgba(0,0,0,0.3)" }} />
            ))}
          </div>
        ) : (
          <div className="p-6">
            <ResearchTable research={research} />
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="w-9 h-9 rounded-xl text-sm font-semibold transition-all disabled:opacity-30 hover:scale-[1.05]"
            style={{ background: "#1c1c21", border: "1px solid #2a2f3a", color: "#eaeaea", fontFamily: "'Montserrat', sans-serif" }}
          >
            ‹
          </button>
          <span className="text-sm" style={{ color: "rgba(106,111,117,0.7)", fontFamily: "'Montserrat', sans-serif" }}>
            Page {page + 1} of {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            className="w-9 h-9 rounded-xl text-sm font-semibold transition-all disabled:opacity-30 hover:scale-[1.05]"
            style={{ background: "#1c1c21", border: "1px solid #2a2f3a", color: "#eaeaea", fontFamily: "'Montserrat', sans-serif" }}
          >
            ›
          </button>
        </div>
      )}
    </div>
  );
}
