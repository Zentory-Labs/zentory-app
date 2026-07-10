"use client";

import dynamic from "next/dynamic";
import Link from "next/link";

// The bridge widget (LI.FI + its EVM wallet provider) is client-only — load it
// without SSR. All the wagmi/viem/widget code lives in BridgeWidget so nothing
// touches the server render.
const BridgeWidget = dynamic(() => import("@/components/BridgeWidget"), {
  ssr: false,
  loading: () => (
    <div
      className="h-[560px] w-full max-w-[420px] rounded-2xl flex items-center justify-center"
      style={{ background: "#111114", border: "1px solid rgba(42,47,58,0.6)" }}
    >
      <span className="text-sm" style={{ color: "#bfc3c7" }}>Loading bridge…</span>
    </div>
  ),
});

const GOLD = "#b08d57";

export default function BridgePage() {
  return (
    <div className="space-y-10 pb-12">
      <header className="space-y-3 max-w-2xl">
        <p className="text-[11px] uppercase tracking-[0.2em]" style={{ color: GOLD }}>Zentory Bridge</p>
        <h1 className="text-4xl font-bold tracking-tight text-white">Bridge any asset, any chain</h1>
        <p className="text-sm leading-relaxed" style={{ color: "#bfc3c7" }}>
          Swap and bridge across 70+ chains — Ethereum, Arbitrum, Base, Solana, Bitcoin, HyperEVM and
          more — in seconds. Best-price routes are aggregated across every major bridge and DEX, and
          it&apos;s <strong className="text-white">fully non-custodial</strong>: your funds never touch Zentory.
        </p>
      </header>

      <div className="grid lg:grid-cols-[420px_1fr] gap-10 items-start">
        <div className="flex justify-center lg:justify-start">
          <BridgeWidget />
        </div>

        {/* The funnel: once they're on HyperEVM, one tap to the vaults */}
        <div className="space-y-4">
          <div className="rounded-2xl p-6" style={{ background: "#111114", border: "1px solid rgba(42,47,58,0.6)" }}>
            <h2 className="text-lg font-semibold text-white mb-2">Looking for yield?</h2>
            <p className="text-sm mb-4" style={{ color: "#bfc3c7" }}>
              Bridge into HyperEVM and put your assets to work in Zentory&apos;s non-custodial vaults —
              a transparent, risk-managed strategy built to defend the drawdowns. Track NAV on-chain.
            </p>
            <Link href="/" className="inline-block px-5 py-2.5 rounded-xl text-sm font-semibold transition-transform hover:scale-[1.02]"
              style={{ background: GOLD, color: "#0b0b0d" }}>
              Explore the vaults →
            </Link>
          </div>
          <ul className="text-xs space-y-2" style={{ color: "#bfc3c7" }}>
            <li>• Best-price routing across 70+ chains, plus Solana and Bitcoin.</li>
            <li>• Non-custodial — your funds never touch Zentory; every route settles on-chain.</li>
            <li>• One interface for every major bridge and DEX aggregator.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
