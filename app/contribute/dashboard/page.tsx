"use client";

import { useState, useEffect, useCallback } from "react";
import { useAccount } from "wagmi";

const HYPER_EVM_CHAIN_ID = 998;

const ASSET_CLASSES = [
  { value: "CRYPTO_PERP", label: "Crypto Perpetual" },
  { value: "CRYPTO_SPOT", label: "Crypto Spot" },
  { value: "EQUITY", label: "Equity" },
  { value: "FOREX", label: "Forex" },
  { value: "COMMODITY", label: "Commodity" },
] as const;

const ASSETS_BY_CLASS: Record<string, { value: string; label: string }[]> = {
  CRYPTO_PERP: [
    { value: "BTC", label: "BTC-PERP" },
    { value: "ETH", label: "ETH-PERP" },
    { value: "SOL", label: "SOL-PERP" },
    { value: "XRP", label: "XRP-PERP" },
  ],
  CRYPTO_SPOT: [
    { value: "BTC", label: "BTC" },
    { value: "ETH", label: "ETH" },
    { value: "SOL", label: "SOL" },
    { value: "XRP", label: "XRP" },
  ],
  EQUITY: [
    { value: "AAPL", label: "AAPL" },
    { value: "TSLA", label: "TSLA" },
    { value: "NVDA", label: "NVDA" },
    { value: "MSFT", label: "MSFT" },
  ],
  FOREX: [
    { value: "EURUSD", label: "EUR/USD" },
    { value: "GBPUSD", label: "GBP/USD" },
  ],
  COMMODITY: [
    { value: "GOLD", label: "Gold (XAU)" },
    { value: "OIL", label: "Oil (WTI)" },
  ],
};

const EXPIRY_OPTIONS = [
  { label: "1h", seconds: 3600 },
  { label: "4h", seconds: 14400 },
  { label: "24h", seconds: 86400 },
] as const;

interface ApiKeyInfo {
  id: number;
  label: string;
  prefix: string;
  createdAt: number;
  lastUsedAt: number | null;
  isActive: boolean;
}

interface Research {
  id: number;
  asset_class: string;
  asset_id: string;
  direction: number;
  confidence: number;
  expires_at: number;
  status: string;
  submitted_at: number;
  accuracy?: number;
  payout?: number;
}

interface Analytics {
  totalResearch: number;
  resolvedResearch: number;
  avgAccuracy: number;
  totalPayout: number;
  currentRank: number | null;
  accuracyHistory: { epoch: number; accuracy: number }[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtTs(ts: number | null): string {
  if (!ts) return "—";
  return new Date(ts * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function fmtRelative(ts: number | null): string {
  if (!ts) return "Never";
  const diff = Math.floor(Date.now() / 1000) - ts;
  if (diff < 60) return "Just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

// ─── API helpers ─────────────────────────────────────────────────────────────

async function fetchApiKeys(apiKey: string): Promise<ApiKeyInfo[]> {
  const res = await fetch("/api/contribute/api-keys", {
    headers: { "x-api-key": apiKey },
  });
  if (!res.ok) return [];
  const data = await res.json();
  return data.keys ?? [];
}

async function createApiKey(apiKey: string, label: string): Promise<{ key: string; id: number } | null> {
  const res = await fetch("/api/contribute/api-keys", {
    method: "POST",
    headers: { "x-api-key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({ label }),
  });
  if (!res.ok) return null;
  return res.json();
}

async function revokeApiKey(apiKey: string, keyId: number): Promise<boolean> {
  const res = await fetch("/api/contribute/api-keys", {
    method: "DELETE",
    headers: { "x-api-key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({ keyId }),
  });
  return res.ok;
}

async function fetchAnalytics(apiKey: string, epochs = 20): Promise<Analytics | null> {
  const res = await fetch(`/api/contribute/analytics?epochs=${epochs}`, {
    headers: { "x-api-key": apiKey },
  });
  if (!res.ok) return null;
  return res.json();
}

async function fetchRecentResearch(apiKey: string): Promise<Research[]> {
  const res = await fetch("/api/contribute/research?limit=10", {
    headers: { "x-api-key": apiKey },
  });
  if (!res.ok) return [];
  return res.json();
}

async function submitResearch(
  apiKey: string,
  payload: { assetClass: string; assetId: string; direction: number; confidence: number; expiresAt: number }
): Promise<{ researchId: string; dbId: number } | null> {
  const res = await fetch("/api/contribute", {
    method: "POST",
    headers: { "x-api-key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) return null;
  return res.json();
}

// ─── CopyButton ───────────────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  function handleCopy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }
  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 hover:scale-[1.03]"
      style={{
        background: copied ? "rgba(34,197,94,0.12)" : "rgba(176,141,87,0.1)",
        border: `1px solid ${copied ? "rgba(34,197,94,0.3)" : "rgba(176,141,87,0.3)"}`,
        color: copied ? "#22c55e" : "#b08d57",
        fontFamily: "'Montserrat', sans-serif",
      }}
    >
      {copied ? (
        <>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
          Copied
        </>
      ) : (
        <>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
          Copy
        </>
      )}
    </button>
  );
}

// ─── MetricCard ───────────────────────────────────────────────────────────────

function MetricCard({ label, value, accent, pill }: { label: string; value: string; accent?: string; pill?: string }) {
  return (
    <div className="rounded-2xl p-5" style={{ background: "#1c1c21", border: "1px solid #2a2f3a" }}>
      <span className="text-xs uppercase tracking-widest" style={{ color: "rgba(106,111,117,0.9)", fontFamily: "'Montserrat', sans-serif" }}>
        {label}
      </span>
      <div className="flex items-end gap-2 flex-wrap mt-1">
        <span className="text-2xl font-bold" style={{ color: accent ?? "#eaeaea", fontFamily: "'Montserrat', sans-serif" }}>
          {value}
        </span>
        {pill && (
          <span
            className="text-xs px-2 py-0.5 rounded-full font-semibold"
            style={{ background: pill.startsWith("+") ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)", color: pill.startsWith("+") ? "#22c55e" : "#ef4444", fontFamily: "'Montserrat', sans-serif" }}
          >
            {pill}
          </span>
        )}
      </div>
    </div>
  );
}

// ─── PublishResearchForm ─────────────────────────────────────────────────────────

function PublishResearchForm({ apiKey, onSuccess }: { apiKey: string; onSuccess: () => void }) {
  const [assetClass, setAssetClass] = useState<string>("CRYPTO_PERP");
  const [assetId, setAssetId] = useState<string>("BTC");
  const [direction, setDirection] = useState<number>(10000);
  const [confidence, setConfidence] = useState<number>(75);
  const [expiryIdx, setExpiryIdx] = useState<number>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const assets = ASSETS_BY_CLASS[assetClass] ?? [];

  useEffect(() => {
    setAssetId(assets[0]?.value ?? "");
  }, [assetClass, assets]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    setLoading(true);
    try {
      const now = Math.floor(Date.now() / 1000);
      const expiresAt = now + EXPIRY_OPTIONS[expiryIdx].seconds;
      const confidenceBps = Math.round(confidence * 100);
      const result = await submitResearch(apiKey, { assetClass, assetId, direction, confidence: confidenceBps, expiresAt });
      if (!result) {
        setError("Submission failed. Check your API key or try again.");
      } else {
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
        onSuccess();
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const dirLong = direction > 0;
  const confidencePct = Math.round((confidence / 10000) * 100);

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Asset class + asset */}
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs uppercase tracking-wider" style={{ color: "rgba(106,111,117,0.8)", fontFamily: "'Montserrat', sans-serif" }}>Asset Class</label>
          <select
            value={assetClass}
            onChange={(e) => setAssetClass(e.target.value)}
            className="rounded-xl px-3 py-2.5 text-sm outline-none transition-all"
            style={{ background: "#0b0b0d", border: "1px solid #2a2f3a", color: "#eaeaea", fontFamily: "'Montserrat', sans-serif" }}
          >
            {ASSET_CLASSES.map((ac) => (
              <option key={ac.value} value={ac.value}>{ac.label}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs uppercase tracking-wider" style={{ color: "rgba(106,111,117,0.8)", fontFamily: "'Montserrat', sans-serif" }}>Asset</label>
          <select
            value={assetId}
            onChange={(e) => setAssetId(e.target.value)}
            className="rounded-xl px-3 py-2.5 text-sm outline-none transition-all"
            style={{ background: "#0b0b0d", border: "1px solid #2a2f3a", color: "#eaeaea", fontFamily: "'Montserrat', sans-serif" }}
          >
            {assets.map((a) => (
              <option key={a.value} value={a.value}>{a.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Direction */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs uppercase tracking-wider" style={{ color: "rgba(106,111,117,0.8)", fontFamily: "'Montserrat', sans-serif" }}>Direction</label>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setDirection(10000)}
            className="py-3 rounded-xl text-sm font-bold transition-all duration-200"
            style={{
              background: dirLong ? "rgba(34,197,94,0.15)" : "rgba(0,0,0,0.3)",
              border: `1px solid ${dirLong ? "rgba(34,197,94,0.4)" : "#2a2f3a"}`,
              color: dirLong ? "#22c55e" : "rgba(234,234,234,0.4)",
              fontFamily: "'Montserrat', sans-serif",
            }}
          >
            + LONG
          </button>
          <button
            type="button"
            onClick={() => setDirection(-10000)}
            className="py-3 rounded-xl text-sm font-bold transition-all duration-200"
            style={{
              background: !dirLong ? "rgba(239,68,68,0.15)" : "rgba(0,0,0,0.3)",
              border: `1px solid ${!dirLong ? "rgba(239,68,68,0.4)" : "#2a2f3a"}`,
              color: !dirLong ? "#ef4444" : "rgba(234,234,234,0.4)",
              fontFamily: "'Montserrat', sans-serif",
            }}
          >
            - SHORT
          </button>
        </div>
      </div>

      {/* Confidence */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <label className="text-xs uppercase tracking-wider" style={{ color: "rgba(106,111,117,0.8)", fontFamily: "'Montserrat', sans-serif" }}>Confidence</label>
          <span className="text-sm font-bold" style={{ color: "#b08d57", fontFamily: "'Montserrat', sans-serif" }}>{confidencePct}%</span>
        </div>
        <input
          type="range"
          min={1}
          max={100}
          step={1}
          value={Math.round(confidence / 100)}
          onChange={(e) => setConfidence(Number(e.target.value) * 100)}
          className="w-full accent-[#b08d57]"
          style={{ accentColor: "#b08d57" }}
        />
        <div className="flex justify-between text-[10px]" style={{ color: "rgba(106,111,117,0.5)", fontFamily: "'Montserrat', sans-serif" }}>
          <span>Low</span><span>High</span>
        </div>
      </div>

      {/* Expiry */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs uppercase tracking-wider" style={{ color: "rgba(106,111,117,0.8)", fontFamily: "'Montserrat', sans-serif" }}>Expires In</label>
        <div className="grid grid-cols-3 gap-2">
          {EXPIRY_OPTIONS.map((opt, i) => (
            <button
              key={opt.label}
              type="button"
              onClick={() => setExpiryIdx(i)}
              className="py-2.5 rounded-xl text-sm font-semibold transition-all duration-200"
              style={{
                background: expiryIdx === i ? "rgba(176,141,87,0.15)" : "rgba(0,0,0,0.3)",
                border: `1px solid ${expiryIdx === i ? "rgba(176,141,87,0.4)" : "#2a2f3a"}`,
                color: expiryIdx === i ? "#b08d57" : "rgba(234,234,234,0.4)",
                fontFamily: "'Montserrat', sans-serif",
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <p className="text-xs rounded-lg px-3 py-2" style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "#ef4444", fontFamily: "'Montserrat', sans-serif" }}>
          {error}
        </p>
      )}
      {success && (
        <p className="text-xs rounded-lg px-3 py-2" style={{ background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.3)", color: "#22c55e", fontFamily: "'Montserrat', sans-serif" }}>
          Research published successfully
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full py-3 rounded-xl font-bold text-sm transition-all duration-200 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-60"
        style={{
          background: "linear-gradient(135deg, #b08d57 0%, #8b6635 100%)",
          color: "#0b0b0d",
          fontFamily: "'Montserrat', sans-serif",
          boxShadow: "0 0 30px rgba(176,141,87,0.2)",
        }}
      >
        {loading ? "Publishing…" : "Publish Research"}
      </button>
    </form>
  );
}

// ─── ResearchTable ─────────────────────────────────────────────────────────────

function ResearchTable({ research }: { research: Research[] }) {
  if (research.length === 0) {
    return (
      <div className="text-center py-10">
        <p className="text-sm" style={{ color: "rgba(106,111,117,0.6)", fontFamily: "'Montserrat', sans-serif" }}>
          No research published yet
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm" style={{ fontFamily: "'Montserrat', sans-serif" }}>
        <thead>
          <tr style={{ color: "rgba(106,111,117,0.7)", textAlign: "left", borderBottom: "1px solid #2a2f3a" }}>
            {["Time", "Asset", "Class", "Direction", "Confidence", "Expires", "Status"].map((h) => (
              <th key={h} className="pb-3 pr-4 text-xs uppercase tracking-widest font-semibold">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {research.map((s) => {
            const isLong = s.direction > 0;
            const statusColor = s.status === "Active" ? "#22c55e" : s.status === "Resolved" ? "#b08d57" : "#6a6f75";
            return (
              <tr key={s.id} style={{ borderTop: "1px solid #2a2f3a", color: "#eaeaea" }}>
                <td className="py-3 pr-4 text-xs" style={{ color: "rgba(106,111,117,0.7)" }}>
                  {s.submitted_at ? new Date(s.submitted_at * 1000).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"}
                </td>
                <td className="py-3 pr-4 font-semibold">{s.asset_id}</td>
                <td className="py-3 pr-4 text-xs" style={{ color: "rgba(106,111,117,0.7)" }}>{s.asset_class}</td>
                <td className="py-3 pr-4 font-semibold" style={{ color: isLong ? "#22c55e" : "#ef4444" }}>
                  {isLong ? "+ LONG" : "- SHORT"}
                </td>
                <td className="py-3 pr-4 text-xs">{Math.round((s.confidence / 10000) * 100)}%</td>
                <td className="py-3 pr-4 text-xs" style={{ color: "rgba(106,111,117,0.7)" }}>
                  {s.expires_at ? new Date(s.expires_at * 1000).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"}
                </td>
                <td className="py-3 pr-4">
                  <span className="text-xs font-semibold px-2 py-1 rounded-full" style={{ background: `${statusColor}20`, color: statusColor }}>
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

// ─── Dashboard Content ─────────────────────────────────────────────────────────

function DashboardContent({ apiKey }: { apiKey: string }) {
  const [keys, setKeys] = useState<ApiKeyInfo[]>([]);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [research, setResearch] = useState<Research[]>([]);
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [loadingKeys, setLoadingKeys] = useState(true);
  const [loadingAnalytics, setLoadingAnalytics] = useState(true);
  const [generatingKey, setGeneratingKey] = useState(false);
  const [newKeyLabel, setNewKeyLabel] = useState("");
  const [refreshCounter, setRefreshCounter] = useState(0);

  const loadData = useCallback(async () => {
    const [k, a, s] = await Promise.all([
      fetchApiKeys(apiKey).catch(() => []),
      fetchAnalytics(apiKey).catch(() => null),
      fetchRecentResearch(apiKey).catch(() => []),
    ]);
    setKeys(k);
    setAnalytics(a);
    setResearch(s);
    setLoadingKeys(false);
    setLoadingAnalytics(false);
  }, [apiKey]);

  useEffect(() => {
    loadData();
  }, [loadData, refreshCounter]);

  async function handleGenerateKey() {
    setGeneratingKey(true);
    try {
      const result = await createApiKey(apiKey, newKeyLabel || "Unnamed");
      if (result) {
        setGeneratedKey(result.key);
        setNewKeyLabel("");
        setRefreshCounter((c) => c + 1);
      }
    } finally {
      setGeneratingKey(false);
    }
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <div className="w-2 h-2 rounded-full" style={{ background: "#b08d57", boxShadow: "0 0 8px #b08d57" }} />
          <span className="text-xs uppercase tracking-widest font-semibold" style={{ color: "#b08d57", fontFamily: "'Montserrat', sans-serif" }}>
            Research Contributor
          </span>
        </div>
        <h1 className="text-3xl font-bold text-white" style={{ fontFamily: "'Montserrat', sans-serif" }}>
          Contributor Dashboard
        </h1>
        <p className="text-sm mt-1" style={{ color: "rgba(106,111,117,0.8)", fontFamily: "'Montserrat', sans-serif" }}>
          Manage your API keys, publish research, and monitor performance
        </p>
      </div>

      {/* API Key Section */}
      <div className="rounded-2xl p-6" style={{ background: "#1c1c21", border: "1px solid #2a2f3a" }}>
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-base font-bold" style={{ color: "#eaeaea", fontFamily: "'Montserrat', sans-serif" }}>
              Your API Keys
            </h2>
            <p className="text-xs mt-0.5" style={{ color: "rgba(106,111,117,0.6)", fontFamily: "'Montserrat', sans-serif" }}>
              Use your API key to authenticate research submissions from your trading bot
            </p>
          </div>
          <a
            href="/contribute/api-keys"
            className="text-xs font-semibold underline transition-colors"
            style={{ color: "#b08d57", fontFamily: "'Montserrat', sans-serif" }}
          >
            Manage all →
          </a>
        </div>

        {/* New key display */}
        {generatedKey && (
          <div className="mb-4 rounded-xl p-4" style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.25)" }}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <p className="text-xs font-bold mb-1" style={{ color: "#22c55e", fontFamily: "'Montserrat', sans-serif" }}>
                  API Key Generated
                </p>
                <p className="text-[11px] mb-2" style={{ color: "rgba(106,111,117,0.7)", fontFamily: "'Montserrat', sans-serif" }}>
                  Save this key now — it will not be shown again.
                </p>
                <code className="text-xs font-mono break-all" style={{ color: "#eaeaea", fontFamily: "monospace" }}>
                  {generatedKey}
                </code>
              </div>
              <div className="flex flex-col gap-2">
                <CopyButton text={generatedKey} />
                <button
                  onClick={() => setGeneratedKey(null)}
                  className="text-xs px-3 py-1.5 rounded-lg transition-colors"
                  style={{ background: "rgba(0,0,0,0.3)", border: "1px solid #2a2f3a", color: "rgba(106,111,117,0.7)", fontFamily: "'Montserrat', sans-serif" }}
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Key list */}
        {loadingKeys ? (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="h-16 rounded-xl animate-pulse" style={{ background: "rgba(0,0,0,0.3)" }} />
            ))}
          </div>
        ) : keys.length === 0 && !generatedKey ? (
          <div className="text-center py-8">
            <p className="text-sm mb-4" style={{ color: "rgba(106,111,117,0.6)", fontFamily: "'Montserrat', sans-serif" }}>
              No API keys yet. Generate one to start publishing research.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {keys.map((k) => (
              <div key={k.id} className="flex items-center justify-between rounded-xl px-4 py-3" style={{ background: "rgba(0,0,0,0.3)", border: "1px solid #2a2f3a" }}>
                <div className="flex items-center gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold" style={{ color: "#eaeaea", fontFamily: "'Montserrat', sans-serif" }}>{k.label}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full font-mono" style={{ background: "rgba(176,141,87,0.12)", color: "#b08d57", fontFamily: "monospace" }}>
                        {k.prefix}***
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 text-[11px]" style={{ color: "rgba(106,111,117,0.5)", fontFamily: "'Montserrat', sans-serif" }}>
                      <span>Created {fmtTs(k.createdAt)}</span>
                      <span>·</span>
                      <span>Last used {fmtRelative(k.lastUsedAt)}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Generate new key */}
        {!generatedKey && (
          <div className="mt-4 flex items-center gap-3">
            <input
              type="text"
              placeholder="Key label (optional)"
              value={newKeyLabel}
              onChange={(e) => setNewKeyLabel(e.target.value)}
              className="flex-1 rounded-xl px-3 py-2.5 text-sm outline-none"
              style={{ background: "#0b0b0d", border: "1px solid #2a2f3a", color: "#eaeaea", fontFamily: "'Montserrat', sans-serif" }}
            />
            <button
              onClick={handleGenerateKey}
              disabled={generatingKey}
              className="px-5 py-2.5 rounded-xl text-sm font-bold transition-all hover:scale-[1.02] disabled:opacity-60"
              style={{
                background: "rgba(176,141,87,0.12)",
                border: "1px solid rgba(176,141,87,0.35)",
                color: "#b08d57",
                fontFamily: "'Montserrat', sans-serif",
              }}
            >
              {generatingKey ? "Generating…" : "+ Generate Key"}
            </button>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard label="Total Research" value={loadingAnalytics ? "—" : String(analytics?.totalResearch ?? 0)} accent="#eaeaea" />
        <MetricCard label="Avg Accuracy" value={loadingAnalytics ? "—" : `${(analytics?.avgAccuracy ?? 0).toFixed(1)}%`} accent="#b08d57" />
        <MetricCard label="ZENT Earned" value={loadingAnalytics ? "—" : String(analytics?.totalPayout ?? 0)} accent={(analytics?.totalPayout ?? 0) >= 0 ? "#22c55e" : "#ef4444"} pill={loadingAnalytics ? undefined : `${(analytics?.totalPayout ?? 0) >= 0 ? "+" : ""}${analytics?.totalPayout ?? 0}`} />
        <MetricCard label="Rank" value={loadingAnalytics ? "—" : `#${analytics?.currentRank ?? "—"}`} accent="#b08d57" />
      </div>

      {/* Publish Research + Recent Research */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Publish form */}
        <div className="rounded-2xl p-6" style={{ background: "#1c1c21", border: "1px solid #2a2f3a" }}>
          <h2 className="text-base font-bold mb-5" style={{ color: "#eaeaea", fontFamily: "'Montserrat', sans-serif" }}>
            Publish Research
          </h2>
          <PublishResearchForm apiKey={apiKey} onSuccess={() => setRefreshCounter((c) => c + 1)} />
        </div>

        {/* Recent research */}
        <div className="rounded-2xl p-6" style={{ background: "#1c1c21", border: "1px solid #2a2f3a" }}>
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-base font-bold" style={{ color: "#eaeaea", fontFamily: "'Montserrat', sans-serif" }}>
              Recent Research
            </h2>
            <a
              href="/contribute/submissions"
              className="text-xs font-semibold underline transition-colors"
              style={{ color: "#b08d57", fontFamily: "'Montserrat', sans-serif" }}
            >
              View all →
            </a>
          </div>
          <ResearchTable research={research} />
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ContributeDashboardPage() {
  const { address, isConnected } = useAccount();
  const [apiKey, setApiKey] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("zent_contributor_api_key");
      if (stored) setApiKey(stored);
    }
  }, []);

  useEffect(() => {
    if (apiKey && typeof window !== "undefined") {
      localStorage.setItem("zent_contributor_api_key", apiKey);
    }
  }, [apiKey]);

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-6">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-[#b08d57]/5 rounded-full blur-3xl pointer-events-none" />
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-6" style={{ background: "rgba(176,141,87,0.1)", border: "1px solid rgba(176,141,87,0.2)" }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#b08d57" strokeWidth="1.5">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold mb-3" style={{ color: "#eaeaea", fontFamily: "'Montserrat', sans-serif" }}>
          Connect your wallet
        </h1>
        <p className="text-sm mb-8 max-w-sm" style={{ color: "rgba(234,234,234,0.5)", fontFamily: "'Montserrat', sans-serif" }}>
          Connect your wallet to access the contributor dashboard and manage your research.
        </p>
        <button
          onClick={() => window.dispatchEvent(new Event("open-wallet-modal"))}
          className="px-8 py-3 rounded-2xl font-bold text-sm transition-all hover:scale-[1.03]"
          style={{
            background: "linear-gradient(135deg, #b08d57 0%, #8b6635 100%)",
            color: "#0b0b0d",
            fontFamily: "'Montserrat', sans-serif",
            boxShadow: "0 0 40px rgba(176,141,87,0.25)",
          }}
        >
          Connect Wallet
        </button>
      </div>
    );
  }

  return (
    <div className="w-full">
      {apiKey ? (
        <DashboardContent apiKey={apiKey} />
      ) : (
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-6">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-6" style={{ background: "rgba(176,141,87,0.1)", border: "1px solid rgba(176,141,87,0.2)" }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#b08d57" strokeWidth="1.5">
              <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold mb-3" style={{ color: "#eaeaea", fontFamily: "'Montserrat', sans-serif" }}>
            No API key found
          </h1>
          <p className="text-sm mb-8 max-w-sm" style={{ color: "rgba(234,234,234,0.5)", fontFamily: "'Montserrat', sans-serif" }}>
            Generate an API key from the dashboard to start publishing research.
          </p>
          <a
            href="/contribute/api-keys"
            className="px-8 py-3 rounded-2xl font-bold text-sm transition-all hover:scale-[1.03]"
            style={{
              background: "linear-gradient(135deg, #b08d57 0%, #8b6635 100%)",
              color: "#0b0b0d",
              fontFamily: "'Montserrat', sans-serif",
              boxShadow: "0 0 40px rgba(176,141,87,0.25)",
            }}
          >
            Go to API Keys
          </a>
        </div>
      )}
    </div>
  );
}
