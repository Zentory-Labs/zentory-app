"use client";

import { useMemo } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import type { WidgetConfig } from "@lifi/widget";

// The LI.FI Widget is client-only — load it without SSR.
// Setup before this works in production:
//   1. `npm install @lifi/widget` (peer deps wagmi/viem/@tanstack-react-query already in the app)
//   2. Register the "Zentory" integrator + payout wallet with LI.FI (sales@li.finance)
//      so the integrator fee below actually accrues to you.
//   3. Verify the widget version/API against https://docs.li.fi/widget — this is a scaffold.
const LiFiWidget = dynamic(
  () => import("@lifi/widget").then((m) => m.LiFiWidget),
  {
    ssr: false,
    loading: () => (
      <div className="h-[560px] w-full max-w-[420px] rounded-2xl flex items-center justify-center"
        style={{ background: "#111114", border: "1px solid rgba(42,47,58,0.6)" }}>
        <span className="text-sm" style={{ color: "rgba(191,195,199,0.6)" }}>Loading bridge…</span>
      </div>
    ),
  }
);

const HYPEREVM_CHAIN_ID = 999; // default destination — funnel users onto HyperEVM
const GOLD = "#b08d57";

export default function BridgePage() {
  // 0.25% integrator fee (override with NEXT_PUBLIC_BRIDGE_FEE, e.g. 0.003 = 0.3%).
  const fee = Number(process.env.NEXT_PUBLIC_BRIDGE_FEE ?? 0.0025);

  // hiddenUI drops the widget's third-party chrome (incl. the "Powered by" badge)
  // so the bridge reads as Zentory's own surface. The flag is an officially
  // supported LI.FI widget feature — but confirm hiding attribution is permitted
  // under your LI.FI integrator agreement before going live with the fee.
  const widgetConfig = useMemo<Partial<WidgetConfig>>(
    () => ({
      integrator: "Zentory",
      fee,
      fromChain: 1, // populate the origin (Ethereum) so chain/token logos show by default
      toChain: HYPEREVM_CHAIN_ID,
      hiddenUI: { poweredBy: true, language: true, appearance: true },
      appearance: "dark",
      theme: {
        colorSchemes: {
          dark: {
            palette: {
              primary: { main: GOLD },
              secondary: { main: "#eaeaea" },
              background: { default: "#0d0d10", paper: "#111114" },
            },
          },
        },
        shape: { borderRadius: 16 },
        typography: { fontFamily: "'Montserrat', sans-serif" },
      },
    }),
    [fee]
  );

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
          <LiFiWidget integrator="Zentory" config={widgetConfig} />
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
