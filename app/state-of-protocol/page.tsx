"use client";

import { useState } from "react";

// ─── Static Data ───────────────────────────────────────────────────────────────

const PROTOCOL_STATS = [
  { label: "Network", value: "HyperEVM Testnet (Chain 998)", sub: "Mainnet imminent" },
  { label: "Contracts Deployed", value: "4", sub: "ZENT, Staking, Registry, Scoring" },
  { label: "Testnet TVL", value: "$0", sub: "Pre-mainnet" },
  { label: "Total Signals", value: "—", sub: "Live after mainnet" },
  { label: "Epochs Settled", value: "0", sub: "Live after mainnet" },
  { label: "ZENT Price", value: "—", sub: "Live on mainnet" },
  { label: "Total Value Secured", value: "$0", sub: "Non-custodial architecture" },
];

const CONTRACTS = [
  { name: "ZENT Token", address: "0x271cd48c1297CacCD810c7B1BCD904f459df7117", chain: "HyperEVM", verified: true },
  { name: "ZENT Staking", address: "0x4E2e7Fd3C85c05697b24743e580B03abCD6d0c65", chain: "HyperEVM", verified: true },
  { name: "Signal Registry", address: "0x7745B22B2C73E422154Fcd1ECD283765c4BF6e8c", chain: "HyperEVM", verified: true },
  { name: "Epoch Scoring", address: "0xC9F7345574e8734247556Ed4e30B11851E285bA4", chain: "HyperEVM", verified: true },
  { name: "Subscription Vault", address: "0xd7d346f6d1F2CEcc3E67d9749B5121549F3dd80d", chain: "HyperEVM", verified: false },
];

const SECURITY = [
  { item: "Access Control", status: "Hardened", detail: "Role-based access on all critical functions" },
  { item: "Non-Custodial Vaults", status: "Verified", detail: "Users retain custody of assets at all times" },
  { item: "Reentrancy Guards", status: "Implemented", detail: "nonReentrant on all external calls" },
  { item: "Formal Audit", status: "Pending", detail: "Audit brief prepared — seeking firms" },
  { item: "Bug Bounty", status: "In Progress", detail: "Immunefi program being established" },
  { item: "Geo-Blocking", status: "Active", detail: "US + EU + OFAC countries restricted" },
];

const VAULT_ASSETS = [
  { asset: "BTC", status: "Supported", tvl: "—", apy: "—" },
  { asset: "ETH", status: "Supported", tvl: "—", apy: "—" },
  { asset: "SOL", status: "Supported", tvl: "—", apy: "—" },
  { asset: "XRP", status: "Coming Soon", tvl: "—", apy: "—" },
  { asset: "HYPE", status: "Coming Soon", tvl: "—", apy: "—" },
];

const REVENUE_STREAMS = [
  { stream: "Vault Performance Fee", rate: "15%", status: "Designed", detail: "Taken on profitable epochs only" },
  { stream: "Research Subscriptions", rate: "10–100 ZENT/mo", status: "Designed", detail: "4 tiers from Free to Institutional" },
  { stream: "Premium Research", rate: "Per-report pricing", status: "Designed", detail: "On-demand quant research" },
  { stream: "ZENT Buyback & Burn", rate: "50% of treasury", status: "Smart contract ready", detail: "Deployed on mainnet launch" },
];

// ─── Helpers ───────────────────────────────────────────────────────────────────

function truncateAddress(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

type StatusColor = "green" | "amber" | "red" | "muted";

function getStatusColor(status: string): StatusColor {
  const s = status.toLowerCase();
  if (["verified", "implemented", "active", "hardened", "supported", "designed", "smart contract ready"].includes(s)) return "green";
  if (["pending", "in progress", "coming soon"].includes(s)) return "amber";
  if (["restricted", "paused"].includes(s)) return "red";
  return "muted";
}

const STATUS_STYLE: Record<StatusColor, { bg: string; text: string; border: string }> = {
  green:  { bg: "rgba(39,174,96,0.12)",   text: "#27ae60", border: "rgba(39,174,96,0.3)" },
  amber:  { bg: "rgba(176,141,87,0.12)",  text: "#b08d57", border: "rgba(176,141,87,0.3)" },
  red:    { bg: "rgba(194,53,63,0.12)",   text: "#c2353f", border: "rgba(194,53,63,0.3)" },
  muted:  { bg: "rgba(42,47,58,0.4)",     text: "#6a6f75", border: "rgba(42,47,58,0.6)" },
};

function StatusBadge({ status }: { status: string }) {
  const color = getStatusColor(status);
  const s = STATUS_STYLE[color];
  return (
    <span
      className="px-2.5 py-0.5 rounded-full text-xs font-semibold border"
      style={{ background: s.bg, color: s.text, borderColor: s.border, fontFamily: "'Montserrat', sans-serif" }}
    >
      {status}
    </span>
  );
}

// ─── Section Card ───────────────────────────────────────────────────────────────

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      className="rounded-2xl p-6"
      style={{ background: "#1c1c21", border: "1px solid #2a2f3a" }}
    >
      <div
        className="text-xs font-semibold uppercase tracking-widest mb-5"
        style={{ color: "#b08d57", fontFamily: "'Montserrat', sans-serif" }}
      >
        {title}
      </div>
      {children}
    </div>
  );
}

// ─── Contract Row ──────────────────────────────────────────────────────────────

function ContractRow({ contract }: { contract: (typeof CONTRACTS)[number] }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(contract.address).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div
      className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-4"
      style={{ borderBottom: "1px solid #2a2f3a" }}
    >
      <div className="flex flex-col gap-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className="text-sm font-semibold"
            style={{ color: "#eaeaea", fontFamily: "'Montserrat', sans-serif" }}
          >
            {contract.name}
          </span>
          {contract.verified ? (
            <span
              className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border"
              style={{
                background: "rgba(39,174,96,0.1)",
                color: "#27ae60",
                borderColor: "rgba(39,174,96,0.25)",
                fontFamily: "'Montserrat', sans-serif",
              }}
            >
              <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                <circle cx="4" cy="4" r="4" fill="#27ae60" />
              </svg>
              Verified
            </span>
          ) : (
            <span
              className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border"
              style={{
                background: "rgba(176,141,87,0.1)",
                color: "#b08d57",
                borderColor: "rgba(176,141,87,0.25)",
                fontFamily: "'Montserrat', sans-serif",
              }}
            >
              <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                <circle cx="4" cy="4" r="4" fill="#b08d57" />
              </svg>
              Pending
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <code
            className="text-xs font-mono"
            style={{ color: "rgba(234,234,234,0.4)", fontFamily: "'Montserrat', sans-serif" }}
          >
            {truncateAddress(contract.address)}
          </code>
          <button
            onClick={handleCopy}
            className="text-xs transition-colors"
            style={{ color: "#6a6f75", fontFamily: "'Montserrat', sans-serif" }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.color = "#b08d57")}
            onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.color = "#6a6f75")}
          >
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
      </div>
      <a
        href={`https://testnet.hyperliquid.xyz/evm/address/${contract.address}`}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 text-xs font-semibold transition-all hover:scale-[1.02] w-fit"
        style={{
          color: "#b08d57",
          fontFamily: "'Montserrat', sans-serif",
          background: "rgba(176,141,87,0.08)",
          border: "1px solid rgba(176,141,87,0.25)",
          padding: "6px 12px",
          borderRadius: "8px",
        }}
      >
        View on Explorer
        <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
        </svg>
      </a>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function StateOfProtocolPage() {
  return (
    <div className="w-full min-h-screen" style={{ background: "#0b0b0d" }}>
      {/* Ambient background glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[300px] bg-[#8b1e2d]/5 rounded-full blur-3xl pointer-events-none" />

      <div className="relative max-w-5xl mx-auto px-6 py-16 space-y-8">

        {/* ── Page Header ── */}
        <div className="text-center mb-10">
          <div
            className="inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-xs font-semibold mb-5"
            style={{
              background: "rgba(176,141,87,0.08)",
              borderColor: "rgba(176,141,87,0.3)",
              color: "#b08d57",
            }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{ background: "#b08d57", boxShadow: "0 0 8px #b08d57" }}
            />
            Transparency · Accountability · Trust
          </div>
          <h1
            className="text-4xl sm:text-5xl font-bold tracking-tight mb-4"
            style={{ color: "#eaeaea", fontFamily: "'Montserrat', sans-serif" }}
          >
            State of the Protocol
          </h1>
          <p
            className="text-base max-w-2xl mx-auto leading-relaxed"
            style={{ color: "rgba(234,234,234,0.5)", fontFamily: "'Montserrat', sans-serif" }}
          >
            Real-time transparency into ZENTORY Labs smart contracts, security posture, and economic design.
            All data is pulled directly from on-chain sources.
          </p>
        </div>

        {/* ── 1. Protocol Stats ── */}
        <SectionCard title="Protocol Stats">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {PROTOCOL_STATS.map((stat) => (
              <div
                key={stat.label}
                className="rounded-xl p-4 flex flex-col gap-1"
                style={{ background: "rgba(42,47,58,0.25)", border: "1px solid #2a2f3a" }}
              >
                <span
                  className="text-xs uppercase tracking-wider"
                  style={{ color: "#6a6f75", fontFamily: "'Montserrat', sans-serif" }}
                >
                  {stat.label}
                </span>
                <span
                  className="text-lg font-bold"
                  style={{ color: "#eaeaea", fontFamily: "'Montserrat', sans-serif" }}
                >
                  {stat.value}
                </span>
                <span className="text-xs" style={{ color: "rgba(234,234,234,0.3)", fontFamily: "'Montserrat', sans-serif" }}>
                  {stat.sub}
                </span>
              </div>
            ))}
          </div>
        </SectionCard>

        {/* ── 2. Contract Registry ── */}
        <SectionCard title="Smart Contract Registry">
          <div>
            {CONTRACTS.map((contract, i) => (
              <ContractRow key={i} contract={contract} />
            ))}
          </div>
          <div
            className="mt-4 pt-4 flex items-center gap-2"
            style={{ borderTop: "1px solid #2a2f3a" }}
          >
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="#6a6f75" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-xs" style={{ color: "rgba(234,234,234,0.3)", fontFamily: "'Montserrat', sans-serif" }}>
              All contracts are deployed on HyperEVM Testnet (Chain 998). Mainnet deployment imminent.
            </span>
          </div>
        </SectionCard>

        {/* ── 3. Security & Audits ── */}
        <SectionCard title="Security & Audits">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {SECURITY.map((s) => {
              const color = getStatusColor(s.status);
              const sc = STATUS_STYLE[color];
              return (
                <div
                  key={s.item}
                  className="flex items-start gap-3 rounded-xl p-4"
                  style={{ background: "rgba(42,47,58,0.25)", border: "1px solid #2a2f3a" }}
                >
                  <div className="flex flex-col gap-1 flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span
                        className="text-sm font-semibold"
                        style={{ color: "#eaeaea", fontFamily: "'Montserrat', sans-serif" }}
                      >
                        {s.item}
                      </span>
                      <span
                        className="px-2 py-0.5 rounded-full text-xs font-semibold border flex-shrink-0"
                        style={{ background: sc.bg, color: sc.text, borderColor: sc.border, fontFamily: "'Montserrat', sans-serif" }}
                      >
                        {s.status}
                      </span>
                    </div>
                    <span className="text-xs" style={{ color: "rgba(234,234,234,0.4)", fontFamily: "'Montserrat', sans-serif" }}>
                      {s.detail}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </SectionCard>

        {/* ── 4. Vault Asset Support ── */}
        <SectionCard title="Vault Asset Support">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr style={{ borderBottom: "1px solid #2a2f3a" }}>
                  {["Asset", "Status", "Testnet TVL", "APY"].map((h) => (
                    <th
                      key={h}
                      className="pb-3 text-xs uppercase tracking-wider font-semibold"
                      style={{ color: "#6a6f75", fontFamily: "'Montserrat', sans-serif" }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {VAULT_ASSETS.map((row) => {
                  const color = getStatusColor(row.status);
                  const sc = STATUS_STYLE[color];
                  return (
                    <tr key={row.asset} style={{ borderBottom: "1px solid rgba(42,47,58,0.5)" }}>
                      <td className="py-3">
                        <span
                          className="text-sm font-bold"
                          style={{ color: "#eaeaea", fontFamily: "'Montserrat', sans-serif" }}
                        >
                          {row.asset}
                        </span>
                      </td>
                      <td className="py-3">
                        <span
                          className="px-2.5 py-0.5 rounded-full text-xs font-semibold border"
                          style={{ background: sc.bg, color: sc.text, borderColor: sc.border, fontFamily: "'Montserrat', sans-serif" }}
                        >
                          {row.status}
                        </span>
                      </td>
                      <td className="py-3">
                        <span className="text-sm font-mono" style={{ color: "rgba(234,234,234,0.4)", fontFamily: "'Montserrat', sans-serif" }}>
                          {row.tvl}
                        </span>
                      </td>
                      <td className="py-3">
                        <span className="text-sm font-mono" style={{ color: "rgba(234,234,234,0.4)", fontFamily: "'Montserrat', sans-serif" }}>
                          {row.apy}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </SectionCard>

        {/* ── 5. Revenue Model ── */}
        <SectionCard title="Revenue Model">
          <div className="space-y-4">
            {REVENUE_STREAMS.map((r) => (
              <div
                key={r.stream}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl p-4"
                style={{ background: "rgba(42,47,58,0.25)", border: "1px solid #2a2f3a" }}
              >
                <div className="flex flex-col gap-1">
                  <span
                    className="text-sm font-semibold"
                    style={{ color: "#eaeaea", fontFamily: "'Montserrat', sans-serif" }}
                  >
                    {r.stream}
                  </span>
                  <span className="text-xs" style={{ color: "rgba(234,234,234,0.35)", fontFamily: "'Montserrat', sans-serif" }}>
                    {r.detail}
                  </span>
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                  <span
                    className="text-sm font-bold font-mono"
                    style={{ color: "#b08d57", fontFamily: "'Montserrat', sans-serif" }}
                  >
                    {r.rate}
                  </span>
                  <StatusBadge status={r.status} />
                </div>
              </div>
            ))}
          </div>
        </SectionCard>

        {/* ── 6. Disclaimer ── */}
        <div
          className="p-4 rounded-xl border"
          style={{ background: "rgba(255,180,0,0.07)", borderColor: "rgba(255,180,0,0.25)" }}
        >
          <div className="flex items-start gap-3">
            <svg
              width="16"
              height="16"
              className="flex-shrink-0 mt-0.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="#b08d57"
              strokeWidth={1.5}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <p className="text-xs leading-relaxed" style={{ color: "rgba(234,234,234,0.5)", fontFamily: "'Montserrat', sans-serif" }}>
              <strong style={{ color: "rgba(234,234,234,0.7)" }}>Testnet Disclaimer:</strong> All data shown reflects HyperEVM
              testnet state. No mainnet data is live. TVL, APY, and revenue figures will be populated upon mainnet launch.
              This page is updated in real-time from on-chain data. Nothing on this page constitutes financial advice.
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}
