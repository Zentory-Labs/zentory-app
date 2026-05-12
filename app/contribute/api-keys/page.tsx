"use client";

import { useState, useEffect, useCallback } from "react";
import { useAccount } from "wagmi";

interface ApiKeyInfo {
  id: number;
  label: string;
  prefix: string;
  createdAt: number;
  lastUsedAt: number | null;
  isActive: boolean;
}

function fmtTs(ts: number | null): string {
  if (!ts) return "—";
  return new Date(ts * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function fmtRelative(ts: number | null): string {
  if (!ts) return "Never";
  const diff = Math.floor(Date.now() / 1000) - ts;
  if (diff < 60) return "Just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

async function fetchApiKeys(apiKey: string): Promise<ApiKeyInfo[]> {
  const res = await fetch("/api/contribute/api-keys", { headers: { "x-api-key": apiKey } });
  if (!res.ok) return [];
  const data = await res.json();
  return data.keys ?? [];
}

async function createApiKey(apiKey: string, label: string): Promise<{ key: string; id: number; message?: string } | null> {
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
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200"
      style={{
        background: copied ? "rgba(34,197,94,0.12)" : "rgba(176,141,87,0.1)",
        border: `1px solid ${copied ? "rgba(34,197,94,0.3)" : "rgba(176,141,87,0.3)"}`,
        color: copied ? "#22c55e" : "#b08d57",
        fontFamily: "'Montserrat', sans-serif",
      }}
    >
      {copied ? (
        <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>Copied</>
      ) : (
        <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>Copy</>
      )}
    </button>
  );
}

function RevokeModal({ keyId, keyLabel, onConfirm, onCancel }: { keyId: number; keyLabel: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(8px)" }}>
      <div className="w-full max-w-md rounded-2xl p-6" style={{ background: "#1c1c21", border: "1px solid #2a2f3a" }}>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.25)" }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="1.5">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </div>
          <div>
            <h3 className="text-base font-bold" style={{ color: "#eaeaea", fontFamily: "'Montserrat', sans-serif" }}>Revoke API Key</h3>
            <p className="text-xs" style={{ color: "rgba(106,111,117,0.6)", fontFamily: "'Montserrat', sans-serif" }}>This action cannot be undone</p>
          </div>
        </div>
        <p className="text-sm mb-6" style={{ color: "rgba(234,234,234,0.65)", fontFamily: "'Montserrat', sans-serif" }}>
          Are you sure you want to revoke the API key <span className="font-semibold text-white">&quot;{keyLabel}&quot;</span>? Any bots or services using this key will immediately lose access.
        </p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all hover:scale-[1.01]"
            style={{ background: "rgba(0,0,0,0.4)", border: "1px solid #2a2f3a", color: "#eaeaea", fontFamily: "'Montserrat', sans-serif" }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all hover:scale-[1.01]"
            style={{ background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.4)", color: "#ef4444", fontFamily: "'Montserrat', sans-serif" }}
          >
            Revoke Key
          </button>
        </div>
      </div>
    </div>
  );
}

function ApiKeyCard({ k, onRevoke }: { k: ApiKeyInfo; onRevoke: (id: number, label: string) => void }) {
  return (
    <div className="rounded-2xl p-5" style={{ background: "#1c1c21", border: "1px solid #2a2f3a" }}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <h3 className="text-sm font-bold" style={{ color: "#eaeaea", fontFamily: "'Montserrat', sans-serif" }}>{k.label}</h3>
            <span className="text-xs px-2.5 py-0.5 rounded-full font-mono" style={{ background: "rgba(176,141,87,0.1)", border: "1px solid rgba(176,141,87,0.2)", color: "#b08d57" }}>
              {k.prefix}****{/* *** */}
            </span>
            {k.isActive && (
              <span className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: "#22c55e" }}>
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#22c55e", boxShadow: "0 0 6px #22c55e" }} />
                Active
              </span>
            )}
          </div>
          <div className="flex items-center gap-4 text-xs" style={{ color: "rgba(106,111,117,0.55)", fontFamily: "'Montserrat', sans-serif" }}>
            <span>Created {fmtTs(k.createdAt)}</span>
            <span>·</span>
            <span>Last used {fmtRelative(k.lastUsedAt)}</span>
          </div>
        </div>
        <button
          onClick={() => onRevoke(k.id, k.label)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all hover:scale-[1.03]"
          style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", color: "#ef4444", fontFamily: "'Montserrat', sans-serif" }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
          Revoke
        </button>
      </div>
    </div>
  );
}

function GenerateKeyForm({ onGenerated }: { onGenerated: () => void }) {
  const [label, setLabel] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const apiKey = localStorage.getItem("zent_provider_api_key");
    if (!apiKey) { setError("No API key found in storage"); setLoading(false); return; }
    const result = await createApiKey(apiKey, label);
    if (!result) setError("Failed to create key");
    setLoading(false);
    if (result) onGenerated();
  }

  return (
    <form onSubmit={handleCreate} className="flex gap-3">
      <input
        type="text"
        placeholder="Key label (e.g. 'Production Bot')"
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        className="flex-1 rounded-xl px-4 py-3 text-sm outline-none"
        style={{ background: "#0b0b0d", border: "1px solid #2a2f3a", color: "#eaeaea", fontFamily: "'Montserrat', sans-serif" }}
      />
      <button
        type="submit"
        disabled={loading}
        className="px-6 py-3 rounded-xl text-sm font-bold transition-all hover:scale-[1.02] disabled:opacity-60"
        style={{
          background: "linear-gradient(135deg, #b08d57 0%, #8b6635 100%)",
          color: "#0b0b0d",
          fontFamily: "'Montserrat', sans-serif",
          boxShadow: "0 0 30px rgba(176,141,87,0.2)",
        }}
      >
        {loading ? "Creating…" : "+ Create Key"}
      </button>
    </form>
  );
}

export default function ApiKeysPage() {
  const { isConnected } = useAccount();
  const [keys, setKeys] = useState<ApiKeyInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [revokeTarget, setRevokeTarget] = useState<{ id: number; label: string } | null>(null);
  const [revoking, setRevoking] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const loadKeys = useCallback(async () => {
    const apiKey = localStorage.getItem("zent_provider_api_key");
    if (!apiKey) { setLoading(false); return; }
    const k = await fetchApiKeys(apiKey);
    setKeys(k);
    setLoading(false);
  }, []);

  useEffect(() => { loadKeys(); }, [loadKeys, refreshKey]);

  async function handleRevoke() {
    if (!revokeTarget) return;
    setRevoking(true);
    const apiKey = localStorage.getItem("zent_provider_api_key");
    if (apiKey) await revokeApiKey(apiKey, revokeTarget.id);
    setRevokeTarget(null);
    setRevoking(false);
    setRefreshKey((k) => k + 1);
  }

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-6">
        <h1 className="text-2xl font-bold mb-3" style={{ color: "#eaeaea", fontFamily: "'Montserrat', sans-serif" }}>Connect your wallet</h1>
        <p className="text-sm" style={{ color: "rgba(234,234,234,0.5)", fontFamily: "'Montserrat', sans-serif" }}>Connect your wallet to manage API keys.</p>
      </div>
    );
  }

  return (
    <div className="w-full space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <div className="w-2 h-2 rounded-full" style={{ background: "#b08d57", boxShadow: "0 0 8px #b08d57" }} />
          <span className="text-xs uppercase tracking-widest font-semibold" style={{ color: "#b08d57", fontFamily: "'Montserrat', sans-serif" }}>Research Contributor</span>
        </div>
        <h1 className="text-3xl font-bold" style={{ color: "#eaeaea", fontFamily: "'Montserrat', sans-serif" }}>API Keys</h1>
        <p className="text-sm mt-1" style={{ color: "rgba(106,111,117,0.8)", fontFamily: "'Montserrat', sans-serif" }}>
          Manage API keys for authenticating research submissions from your trading bots
        </p>
      </div>

      {/* Generate new key */}
      <div className="rounded-2xl p-6" style={{ background: "#1c1c21", border: "1px solid #2a2f3a" }}>
        <h2 className="text-base font-bold mb-4" style={{ color: "#eaeaea", fontFamily: "'Montserrat', sans-serif" }}>Create New Key</h2>
        <GenerateKeyForm onGenerated={() => setRefreshKey((k) => k + 1)} />
      </div>

      {/* Existing keys */}
      <div>
        <h2 className="text-base font-bold mb-4" style={{ color: "#eaeaea", fontFamily: "'Montserrat', sans-serif" }}>
          Active Keys {loading ? "" : `(${keys.length})`}
        </h2>
        {loading ? (
          <div className="space-y-4">
            {[1, 2].map((i) => <div key={i} className="h-24 rounded-2xl animate-pulse" style={{ background: "rgba(0,0,0,0.3)" }} />)}
          </div>
        ) : keys.length === 0 ? (
          <div className="rounded-2xl p-10 text-center" style={{ background: "#1c1c21", border: "1px solid #2a2f3a" }}>
            <p className="text-sm" style={{ color: "rgba(106,111,117,0.5)", fontFamily: "'Montserrat', sans-serif" }}>No active API keys. Create one above to get started.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {keys.map((k) => (
              <ApiKeyCard key={k.id} k={k} onRevoke={(id, label) => setRevokeTarget({ id, label })} />
            ))}
          </div>
        )}
      </div>

      {/* Usage guide */}
      <div className="rounded-2xl p-6" style={{ background: "#1c1c21", border: "1px solid #2a2f3a" }}>
        <h2 className="text-base font-bold mb-4" style={{ color: "#eaeaea", fontFamily: "'Montserrat', sans-serif" }}>Usage Guide</h2>
        <div className="space-y-3 text-sm" style={{ color: "rgba(234,234,234,0.55)", fontFamily: "'Montserrat', sans-serif" }}>
          <p>Include your API key in the <code className="px-1.5 py-0.5 rounded text-xs font-mono" style={{ background: "rgba(0,0,0,0.4)", color: "#b08d57" }}>x-api-key</code> header when submitting research:</p>
          <pre className="rounded-xl p-4 overflow-x-auto text-xs font-mono" style={{ background: "#0b0b0d", border: "1px solid #2a2f3a", color: "#eaeaea" }}>
{`curl -X POST https://your-app.vercel.app/api/contribute \\
  -H "Content-Type: application/json" \\
  -H "x-api-key: YOUR_API_KEY_HERE" \\
  -d '{
    "assetClass": "CRYPTO_PERP",
    "assetId": "BTC",
    "direction": 10000,
    "confidence": 7500,
    "expiresAt": $(( $(date +%s) + 86400 ))
  }'`}
          </pre>
          <p className="text-xs" style={{ color: "rgba(106,111,117,0.5)" }}>
            Never share your API key publicly or commit it to version control. Rotate keys immediately if compromised.
          </p>
        </div>
      </div>

      {revokeTarget && (
        <RevokeModal
          keyId={revokeTarget.id}
          keyLabel={revokeTarget.label}
          onConfirm={handleRevoke}
          onCancel={() => setRevokeTarget(null)}
        />
      )}
    </div>
  );
}
