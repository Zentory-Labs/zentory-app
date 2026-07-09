"use client";

import { useMemo } from "react";
import { LiFiWidget, type WidgetConfig } from "@lifi/widget";
import { EthereumProvider } from "@lifi/widget-provider-ethereum";

// This component is only ever loaded client-side (the bridge page imports it via
// next/dynamic with ssr:false), so it's safe to statically import the widget +
// the EVM wallet provider here — none of this wagmi/viem code runs during SSR.

const GOLD = "#b08d57";

// This is a GENERAL cross-chain bridge — any wallet can move any token to any of
// the 70+ supported chains (HyperEVM included, but NOT forced). The from/to below
// are just the opening DEFAULTS; users can change either side freely. We open on a
// same-asset USDC→USDC route across two major chains so the default path needs no
// DEX swap (nothing to slip) and demonstrates a real cross-chain transfer.
// Addresses are LI.FI's canonical native USDC per chain (li.quest/v1/tokens).
const FROM_CHAIN = 1; // Ethereum — most universal origin
const FROM_TOKEN_USDC = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"; // USDC on Ethereum (6 dp)
const TO_CHAIN = 42161; // Arbitrum — cheap, deep liquidity (changeable to any chain)
const TO_TOKEN_USDC = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831"; // USDC on Arbitrum (6 dp)
// Block dust bridges: cross-chain fixed costs (gas both sides + bridge fee) make
// tiny transfers fail bridge minimums or simply not be worth it. Widget shows a
// clear "minimum is $X" message and disables the route below this.
const MIN_FROM_AMOUNT_USD = 20;

// MUST exactly match the integration string registered in the LI.FI dashboard
// (dashboard → Integrations → "integration-string"). LI.FI uses this to apply the
// 25bps fee and route it to the configured EVM fee wallet. A mismatch ("Zentory"
// vs "zentory-labs") means fees don't accrue to your integration.
const INTEGRATOR = "zentory-labs";

// NOTE: deliberately NO LI.FI apiKey here. LI.FI's own guidance is that the
// Widget operates without a key and the x-lifi-api-key must NEVER be exposed
// client-side (it would ship in the browser bundle). The key is server-side
// only; if we ever need higher rate limits we'd proxy the LI.FI API through a
// Next.js route handler that injects the key on the server.

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
      integrator: INTEGRATOR,
      fee,
      // Default slippage tolerance. The widget's default is 0.5%, which is too
      // tight for two-hop routes (DEX swap + bridge): a real USDT→USDC test
      // reverted with MinimalOutputBalanceViolation because the ~0.45% swap
      // haircut + pool drift between quote and signing exceeded 0.5%. 1% is the
      // common bridge-widget default; users can still tighten it via Settings.
      slippage: 0.01,
      // Block dust bridges that would fail bridge minimums / not be worth the gas.
      minFromAmountUSD: MIN_FROM_AMOUNT_USD,
      // Default to a clean USDC→USDC route (no swap = nothing to slip). Users can
      // change either side to bridge any asset from any chain.
      fromChain: FROM_CHAIN,
      fromToken: FROM_TOKEN_USDC,
      toChain: TO_CHAIN,
      toToken: TO_TOKEN_USDC,
      // Show only the recommended (best/most-reliable) route — keeps users from
      // hand-picking an exotic, failure-prone path.
      showSingleRoute: true,
      // Give the widget its OWN multi-chain wallet stack. Two things matter here:
      //
      // 1. providers: an EthereumProvider that keeps injected/EIP-6963 (MetaMask,
      //    Rabby, Phantom…) and adds WalletConnect (mobile QR) + Coinbase.
      // 2. forceInternalWalletManagement: the whole app is wrapped in a single
      //    WagmiProvider configured for ONLY HyperEVM testnet (chain 998). LI.FI's
      //    EthereumProvider auto-detects that ancestor WagmiProvider and would
      //    reuse it — but a 998-only config can't switch to Ethereum/Arbitrum/etc.,
      //    so routes failed with "Chain not configured". This flag tells the widget
      //    to ignore the host WagmiProvider and build its own config, syncing in
      //    all 70+ LI.FI chains (incl. HyperEVM 999). The app-wide config is left
      //    untouched, so the vault dApp is unaffected.
      walletConfig: { forceInternalWalletManagement: true },
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
        typography: { fontFamily: "var(--font-montserrat), sans-serif" },
      },
    }),
    [fee]
  );

  return <LiFiWidget integrator={INTEGRATOR} config={config} />;
}
