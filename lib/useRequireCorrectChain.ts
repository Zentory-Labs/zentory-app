"use client";

import { useAccount, useSwitchChain } from "wagmi";
import { HYPEREVM_TESTNET } from "@/lib/contracts";

/**
 * Audit D-04 / D-05 fix, corrected per audit finding #42.
 *
 * Returns a guard for write-path handlers that must NEVER broadcast unless the
 * connected wallet is on HyperEVM testnet (chain 998). Without it, a user
 * sitting on Ethereum mainnet would approve and call whatever happens to live
 * at our contract addresses on THAT chain — addresses nobody here owns.
 *
 * IMPORTANT — why this reads `useAccount().chainId` and not `useChainId()`:
 * `useChainId()` returns `config.state.chainId`, and wagmi's syncConnectedChain
 * refuses to adopt a chain that is not in `config.chains`. components/Providers
 * configures only chain 998, so `useChainId()` returns 998 even while the
 * wallet is connected to Ethereum — which made the original guard (and the
 * WalletSelector "wrong network" pill) permanently inert, i.e. always
 * reporting the one case it was written to catch as fine. `useAccount().chainId`
 * is the real chain id of the active connection.
 *
 * Usage in a write handler:
 *
 *   const { requireChain } = useRequireCorrectChain();
 *   const handleDeposit = useCallback(async () => {
 *     if (!(await requireChain())) return; // prompts to switch; bails if declined
 *     deposit(...);
 *   }, [...]);
 *
 * `requireChain()` resolves `true` when the wallet is already (or now) on
 * chain 998, `false` otherwise — the caller short-circuits.
 *
 * Belt and braces: also pass `chainId: HYPEREVM_TESTNET.id` to `writeContract`
 * so viem's own `assertCurrentChain` runs. wagmi only asserts when the caller
 * supplies `chainId`; omit it and the transaction goes out on whatever chain
 * the injected provider is on.
 */
export function useRequireCorrectChain() {
  const { chainId: connectedChainId, isConnected } = useAccount();
  const { switchChainAsync } = useSwitchChain();
  const expected = HYPEREVM_TESTNET.id;

  // `undefined` while disconnected or before the connector reports — treated as
  // "not known to be wrong" so the UI does not flash a false warning.
  const wrongNetwork =
    isConnected && connectedChainId !== undefined && connectedChainId !== expected;

  async function requireChain(): Promise<boolean> {
    if (connectedChainId === expected) return true;
    try {
      // Triggers the wallet's native network-switch prompt. Throws if the
      // user declines or the wallet refuses (e.g. chain not added).
      await switchChainAsync({ chainId: expected });
      return true;
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[zentory] Wallet refused chain switch to HyperEVM testnet:", err);
      return false;
    }
  }

  return { requireChain, wrongNetwork, expectedChainId: expected, connectedChainId };
}
