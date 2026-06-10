"use client";

import * as Sentry from "@sentry/nextjs";
import { ReactNode, useEffect, useState } from "react";
import { WagmiProvider, createConfig, http } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { injected, coinbaseWallet, walletConnect } from "wagmi/connectors";
import { HYPEREVM_TESTNET } from "@/lib/contracts";
import { DemoModeProvider } from "@/lib/demo/context";

// Initialize Sentry directly here. Next.js 16's Turbopack production build
// bundles `instrumentation-client.ts` but never actually executes its
// top-level code (a side-effect-only import either gets tree-shaken or
// silently dropped — known @sentry/nextjs 10.x gap). Inlining the init
// in an always-loaded 'use client' component guarantees it runs once on
// first paint. Idempotent: getClient() check avoids double-init.
if (typeof window !== "undefined" && !Sentry.getClient()) {
  // The wizard's instrumentation-client.ts approach only works under
  // Webpack — Turbopack (Next.js 16 default) bundles the file but never
  // runs its top-level code. Inlining init here in an always-loaded
  // 'use client' component is the workaround. Gated on !getClient() so
  // re-mounts (HMR, route transitions) don't double-init.
  Sentry.init({
    dsn: "https://c5dc033ef25cc26169acdef479e436fd@o4511450247069696.ingest.de.sentry.io/4511450294517840",
    tracesSampleRate: 1,
    enableLogs: true,
    // Audit D-08 / M-17 fix: sendDefaultPii was true, shipping wallet
    // addresses, IPs, cookies and console.log payloads to Sentry. We aren't
    // using Sentry user identification anyway. Off.
    sendDefaultPii: false,
  });
}

const queryClient = new QueryClient();

const RPC_URL = process.env.NEXT_PUBLIC_HYPEREVM_RPC || "https://rpc.hyperliquid-testnet.xyz/evm";
const TRANSPORT_URL = process.env.NODE_ENV === "production" ? "/api/rpc" : RPC_URL;

// Read once. We treat empty-string and unset identically — both mean
// "WalletConnect is disabled." Empty was the production failure mode: WC v2
// strictly requires a non-empty UUID, throwing 'Connection rejected' on
// click otherwise.
const WALLETCONNECT_PROJECT_ID = (process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "").trim();
const WALLETCONNECT_ENABLED =
  WALLETCONNECT_PROJECT_ID.length > 0 && WALLETCONNECT_PROJECT_ID !== "placeholder";

const wagmiConfig = createConfig({
  chains: [HYPEREVM_TESTNET],
  transports: {
    [HYPEREVM_TESTNET.id]: http(TRANSPORT_URL),
  },
  connectors: [
    // injected() with EIP-6963 discovery (wagmi v2 default) auto-detects
    // every installed browser wallet — MetaMask, Rabby, Phantom, Coinbase
    // Wallet extension, Frame, etc. — and exposes each as its own
    // connector with the right icon. We deliberately do NOT add wagmi's
    // metaMask() SDK connector: it duplicates the EIP-6963 entry, often
    // hangs on connect, and forces a QR flow even when the extension is
    // installed. The injected path is the reliable one.
    injected({
      shimDisconnect: true,
    }),
    coinbaseWallet({
      appName: "Zentory Protocol",
    }),
    // WalletConnect — only mounted when a valid project ID is configured.
    // Empty/unset string is treated as disabled (otherwise WC v2 throws
    // 'Connection rejected' on every click).
    ...(WALLETCONNECT_ENABLED
      ? [
          walletConnect({
            projectId: WALLETCONNECT_PROJECT_ID,
            metadata: {
              name: "Zentory Protocol",
              description: "Non-custodial crypto vaults that defend the drawdowns, on HyperEVM",
              url: "https://app.zentorylabs.com",
              icons: ["https://app.zentorylabs.com/zentory_logo_dark.png"],
            },
            showQrModal: true,
          }),
        ]
      : []),
  ],
});

export default function Providers({ children }: { children: ReactNode }) {
  // wagmi hydrates from localStorage (lastConnector / persisted state). Server
  // can't see that and produces a different tree than the client's first
  // paint, throwing React error #418 across the whole app.
  //
  // Trade-off: this gates ALL children behind `mounted`, so the page is
  // briefly blank on first paint (~50ms) instead of rendering an SSR'd
  // version that then fails to hydrate. The user sees a faster perceived
  // "settled" state and the console no longer spams #418.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <DemoModeProvider>{mounted ? children : null}</DemoModeProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
