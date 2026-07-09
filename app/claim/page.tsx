"use client";

import { useEffect, useMemo, useState } from "react";
import { useAccount, useChainId, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { parseAbi, formatUnits } from "viem";
import { addresses, HYPEREVM_TESTNET } from "@/lib/contracts";

// MerkleDistributor (src/airdrop/MerkleDistributor.sol). claim() is permissionless —
// the Merkle proof is the gate, not msg.sender.
const DISTRIBUTOR_ABI = parseAbi([
  "function claim(uint256 index, address account, uint256 amount, bytes32[] merkleProof)",
  "function isClaimed(uint256 index) view returns (bool)",
  "function claimDeadline() view returns (uint256)",
]);

const DISTRIBUTOR: string = addresses.MerkleDistributor || "";
const ZENT_DECIMALS = 18;

type ClaimEntry = { index: number; amount: string; proof: `0x${string}`[] };
type ProofsFile = {
  merkleRoot: `0x${string}`;
  claimDeadline: number;
  claims: Record<string, ClaimEntry>;
};

const gold = "#b08d57";
const text = "#eaeaea";
const muted = "rgba(106,111,117,0.9)";

function Panel({ tone, children }: { tone: "neutral" | "gold" | "green" | "red" | "violet"; children: React.ReactNode }) {
  const tones: Record<string, { bg: string; border: string }> = {
    neutral: { bg: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.12)" },
    gold: { bg: "rgba(176,141,87,0.08)", border: "1px solid rgba(176,141,87,0.25)" },
    green: { bg: "rgba(52,211,153,0.06)", border: "1px solid rgba(52,211,153,0.25)" },
    red: { bg: "rgba(194,53,63,0.08)", border: "1px solid rgba(194,53,63,0.3)" },
    violet: { bg: "rgba(194,53,63,0.04)", border: "1px solid rgba(194,53,63,0.2)" },
  };
  return (
    <div className="rounded-2xl p-6 mb-6 text-sm" style={{ background: tones[tone].bg, border: tones[tone].border, color: "rgba(234,234,234,0.85)" }}>
      {children}
    </div>
  );
}

export default function ClaimPage() {
  const { address: user, isConnected } = useAccount();
  const chainId = useChainId();
  const onCorrectChain = chainId === HYPEREVM_TESTNET.id;

  const [proofs, setProofs] = useState<ProofsFile | null>(null);
  const [proofsState, setProofsState] = useState<"loading" | "ready" | "absent">("loading");

  useEffect(() => {
    let alive = true;
    fetch("/airdrop-proofs.json", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("absent"))))
      .then((j) => { if (alive) { setProofs(j as ProofsFile); setProofsState("ready"); } })
      .catch(() => { if (alive) setProofsState("absent"); });
    return () => { alive = false; };
  }, []);

  const entry = useMemo<ClaimEntry | null>(() => {
    if (!proofs || !user) return null;
    return proofs.claims[user.toLowerCase()] ?? proofs.claims[user] ?? null;
  }, [proofs, user]);

  const { data: claimed } = useReadContract({
    address: DISTRIBUTOR ? (DISTRIBUTOR as `0x${string}`) : undefined,
    abi: DISTRIBUTOR_ABI,
    functionName: "isClaimed",
    args: entry ? [BigInt(entry.index)] : undefined,
    query: { enabled: Boolean(DISTRIBUTOR && entry && onCorrectChain) },
  });

  const { writeContract, data: txHash, reset, isPending: isSigning } = useWriteContract();
  const { isLoading: isTxPending, isSuccess: isTxSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  const deadlinePassed = proofs ? Date.now() / 1000 > proofs.claimDeadline : false;
  const amountLabel = entry ? `${Number(formatUnits(BigInt(entry.amount), ZENT_DECIMALS)).toLocaleString()} ZENT` : "—";

  function handleClaim() {
    if (!DISTRIBUTOR || !entry || !user) return;
    reset();
    writeContract({
      address: DISTRIBUTOR as `0x${string}`,
      abi: DISTRIBUTOR_ABI,
      functionName: "claim",
      args: [BigInt(entry.index), user, BigInt(entry.amount), entry.proof],
    });
  }

  // Airdrop not deployed yet, or snapshot proofs not published → honest pre-launch state.
  const notLive = !DISTRIBUTOR || proofsState === "absent";

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-10">
        <div className="text-xs uppercase tracking-widest font-semibold mb-3" style={{ color: gold }}>
          Testnet · HyperEVM {HYPEREVM_TESTNET.id}
        </div>
        <h1 className="text-3xl md:text-4xl font-bold mb-3" style={{ color: text }}>ZENT Airdrop Claim</h1>
        <p className="text-sm max-w-2xl" style={{ color: muted }}>
          Eligible testnet participants (faucet users, vault depositors, and signal providers) can
          claim their ZENT allocation here. Claims are gated by an on-chain Merkle proof — anyone can
          submit, but only eligible wallets receive tokens.
        </p>
      </div>

      {notLive && (
        <Panel tone="gold">
          <div className="font-semibold mb-1" style={{ color: gold }}>Airdrop snapshot pending</div>
          The claim contract and eligibility snapshot are published when the airdrop opens. Check back
          after the snapshot is announced — this page will show your allocation automatically.
        </Panel>
      )}

      {!notLive && !isConnected && (
        <Panel tone="gold">Connect your wallet to check your allocation. Use the Connect button in the top-right nav.</Panel>
      )}

      {!notLive && isConnected && !onCorrectChain && (
        <Panel tone="red">
          You are connected to chain <span className="font-mono">{chainId}</span>. Switch to{" "}
          <span className="font-semibold">HyperEVM Testnet ({HYPEREVM_TESTNET.id})</span> to claim.
        </Panel>
      )}

      {!notLive && isConnected && onCorrectChain && proofsState === "ready" && (
        <>
          {!entry && (
            <Panel tone="neutral">
              <div className="font-semibold mb-1" style={{ color: text }}>No allocation for this wallet</div>
              <span style={{ color: muted }}>
                {user} is not in the airdrop snapshot. Eligibility was based on testnet activity at the
                snapshot block.
              </span>
            </Panel>
          )}

          {entry && (
            <div className="rounded-2xl p-8 mb-6" style={{ background: "rgba(194,53,63,0.05)", border: "1px solid rgba(194,53,63,0.25)" }}>
              <div className="text-xs uppercase tracking-widest mb-2" style={{ color: "#c2353f" }}>Your allocation</div>
              <div className="text-4xl font-bold mb-4" style={{ color: text }}>{amountLabel}</div>

              {claimed ? (
                <Panel tone="green"><span style={{ color: "#34d399", fontWeight: 600 }}>Already claimed.</span> This allocation has been claimed to {user}.</Panel>
              ) : deadlinePassed ? (
                <Panel tone="red">The claim window has closed. Unclaimed allocations have been swept back to the treasury.</Panel>
              ) : (
                <button
                  onClick={handleClaim}
                  disabled={isSigning || isTxPending}
                  className="px-6 py-3 rounded-xl font-semibold transition-opacity disabled:opacity-50"
                  style={{ background: "#c2353f", color: "#fff" }}
                >
                  {isSigning ? "Confirm in wallet…" : isTxPending ? "Claiming…" : `Claim ${amountLabel}`}
                </button>
              )}
            </div>
          )}

          {txHash && (
            <div className="rounded-2xl p-4 mb-6 text-xs" style={{ background: "rgba(52,211,153,0.06)", border: "1px solid rgba(52,211,153,0.25)", color: "rgba(234,234,234,0.85)", fontFamily: "var(--font-space-mono), monospace" }}>
              <div className="font-semibold mb-1" style={{ color: "#34d399" }}>
                {isTxPending ? "Claim pending" : isTxSuccess ? "Claim confirmed — ZENT sent" : "Transaction submitted"}
              </div>
              <div className="break-all">tx: {txHash}</div>
            </div>
          )}
        </>
      )}

      <div className="rounded-2xl p-6 mt-4 text-xs" style={{ background: "rgba(194,53,63,0.04)", border: "1px solid rgba(194,53,63,0.2)", color: "rgba(234,234,234,0.7)" }}>
        <div className="font-semibold mb-2" style={{ color: "#c2353f" }}>How eligibility works</div>
        The snapshot scores three tracks — faucet usage, vault deposits, and signal submissions — at a
        fixed block. Proofs are published statically; the contract verifies your proof against the
        on-chain Merkle root, so claims are trustless and can&apos;t be forged.
      </div>
    </div>
  );
}
