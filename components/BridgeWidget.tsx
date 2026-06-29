"use client";

import { useMemo } from "react";
import { LiFiWidget, type WidgetConfig } from "@lifi/widget";
import { EthereumProvider } from "@lifi/widget-provider-ethereum";

// This component is only ever loaded client-side (the bridge page imports it via
// next/dynamic with ssr:false), so it's safe to statically import the widget +
// the EVM wallet provider here — none of this wagmi/viem code runs during SSR.

const GOLD = "#b08d57";
const HYPEREVM_CHAIN_ID = 999; // default destination — funnel users onto HyperEVM

// Same public Reown projectId the rest of the app uses (domain-allowlisted in the
// Reown dashboard). Lets the bridge offer WalletConnect (QR → any mobile wallet)
// in addition to installed browser extensions.
const WC_PROJECT_ID = (
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "7ec1c35f80c02a967c01bc724e2c1219"
).trim();
const WC_ENABLED = WC_PROJECT_ID.length > 0 && WC_PROJECT_ID !== "placeholder";

export default function BridgeWidget() {
  // 0.25% integrator fee (override with NEXT_PUBLIC_BRIDGE_FEE, e.g. 0.003 = 0.3%).
  const fee = Number(process.env.NEXT_PUBLIC_BRIDGE_FEE ?? 0.0025);

  const config = useMemo<Partial<WidgetConfig>>(
    () => ({
      integrator: "Zentory",
      fee,
      fromChain: 1, // origin (Ethereum) so chain/token logos render by default
      toChain: HYPEREVM_CHAIN_ID,
      // Full EVM wallet support inside the widget. Without this the widget falls
      // back to its internal manager, which is EIP-6963-only (installed browser
      // extensions) — extension-less users hit "no wallets found". The external
      // EthereumProvider keeps injected/EIP-6963 (MetaMask, Rabby, Phantom…) AND
      // adds WalletConnect (mobile QR) + Coinbase, and manages every bridge chain
      // itself (so this does NOT touch the app-wide single-chain wagmi config).
      providers: [
        EthereumProvider({
          ...(WC_ENABLED ? { walletConnect: { projectId: WC_PROJECT_ID } } : {}),
          coinbase: { appName: "Zentory" },
        }),
      ],
      // Drop the widget's third-party chrome so it reads as Zentory's own surface.
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

  return <LiFiWidget integrator="Zentory" config={config} />;
}
