"use client";

import { ReactNode } from "react";
import { WagmiProvider, createConfig, http } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { injected, coinbaseWallet, walletConnect, metaMask } from "wagmi/connectors";
import { HYPEREVM_TESTNET } from "@/lib/contracts";

const queryClient = new QueryClient();

const RPC_URL = process.env.NEXT_PUBLIC_HYPEREVM_RPC ?? "https://rpc.hyperliquid-testnet.xyz/evm";
const TRANSPORT_URL = process.env.NODE_ENV === "production" ? "/api/rpc" : RPC_URL;

/**
 * WalletConnect Project ID — required for production.
 * In development, set NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID in .env.local.
 * Without a valid project ID the WalletConnect connector will not function.
 */
function getWalletConnectProjectId(): string {
  const id = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;
  if (!id) {
    throw new Error(
      "NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID is not set. "
      + "Create a project at https://cloud.walletconnect.com and add it to .env.local"
    );
  }
  return id;
}

const wagmiConfig = createConfig({
  chains: [HYPEREVM_TESTNET],
  transports: {
    [HYPEREVM_TESTNET.id]: http(TRANSPORT_URL),
  },
  connectors: [
    injected({
      shimDisconnect: true,
    }),
    metaMask({
      shimDisconnect: true,
    }),
    coinbaseWallet({
      appName: "Zentory Protocol",
    }),
    // WalletConnect is only included when the project ID env var is present.
    // This prevents the module-level throw from crashing the build.
    ...(process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID
      ? [walletConnect({ projectId: getWalletConnectProjectId() })]
      : []),
  ],
});

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}
