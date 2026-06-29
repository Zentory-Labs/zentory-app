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
      <span className="text-sm" style={{ color: "rgba(191,195,199,0.6)" }}>Loading bridge…</span>
    </div>
  ),
});

const GOLD = "#b08d57";

export default function BridgePage() {
  return (
    <div className="space-y-10 pb-12">
      <header className="space-y-3 max-w-2xl">
        <p className="text-[11px] uppercase tracking-[0.2em]" style={{ color: GOLD }}>Zentory Bridge</p>
        <h1 className="text-4xl font-bold tracking-tight text-white">Bring any asset onto HyperEVM</h1>
        <p className="text-sm leading-relaxed" style={{ color: "rgba(234,234,234,0.65)" }}>
          Move tokens from 50+ chains — Ethereum, Solana, Base, Arbitrum and more — onto HyperEVM in
          seconds, then put them to work in a Zentory vault. Routes are aggregated and{" "}
          <strong className="text-white">fully non-custodial</strong>: your funds never touch Zentory.
        </p>
      </header>

      <div className="grid lg:grid-cols-[420px_1fr] gap-10 items-start">
        <div className="flex justify-center lg:justify-start">
          <BridgeWidget />
        </div>

        {/* The funnel: once they're on HyperEVM, one tap to the vaults */}
        <div className="space-y-4">
          <div className="rounded-2xl p-6" style={{ background: "#111114", border: "1px solid rgba(42,47,58,0.6)" }}>
            <h2 className="text-lg font-semibold text-white mb-2">Already bridged? Put it to work.</h2>
            <p className="text-sm mb-4" style={{ color: "rgba(234,234,234,0.6)" }}>
              Zentory&apos;s non-custodial vaults run a transparent, risk-managed strategy on HyperEVM —
              built to defend the drawdowns. Deposit your bridged assets and track NAV on-chain.
            </p>
            <Link href="/" className="inline-block px-5 py-2.5 rounded-xl text-sm font-semibold transition-transform hover:scale-[1.02]"
              style={{ background: GOLD, color: "#0b0b0d" }}>
              Explore the vaults →
            </Link>
          </div>
          <ul className="text-xs space-y-2" style={{ color: "rgba(191,195,199,0.6)" }}>
            <li>• Best-price routing across 50+ chains, Solana and Bitcoin into HyperEVM.</li>
            <li>• Non-custodial — your funds never touch Zentory; every swap settles on-chain.</li>
            <li>• Gas into HyperEVM as low as ~$0.01, most routes complete in seconds.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
