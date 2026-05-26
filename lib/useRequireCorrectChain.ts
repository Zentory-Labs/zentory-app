"use client";

import { useChainId, useSwitchChain } from "wagmi";
import { HYPEREVM_TESTNET } from "@/lib/contracts";

/**
 * Audit D-04 / D-05 fix.
 *
 * Returns a guard for write-path handlers that must NEVER broadcast unless the
 * connected wallet is on HyperEVM testnet (chain 998). The previous behavior
 * was to show a wrong-network pill in WalletSelector but still permit the
 * underlying `writeContract` call — which on Ethereum mainnet would happily
 * approve a random contract at the same address as our HyperEVM vault.
 *
 * Usage in a write handler:
 *
 *   const requireChain = useRequireCorrectChain();
 *   const handleDeposit = useCallback(async () => {
 *     if (!(await requireChain())) return; // shows native switch prompt; bails if user declines
 *     deposit(...);
 *   }, [...]);
 *
 * Returns `true` when the wallet is already (or now) on chain 998, `false`
 * otherwise. Caller short-circuits accordingly.
 */
export function useRequireCorrectChain() {
  const chainId = useChainId();
  const { switchChainAsync } = useSwitchChain();
  const expected = HYPEREVM_TESTNET.id;

  return async function requireChain(): Promise<boolean> {
    if (chainId === expected) return true;
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
  };
}
