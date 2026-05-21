"use client";

import { useState } from "react";
import { useAccount, useChainId, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { parseAbi, formatUnits } from "viem";
import { addresses, HYPEREVM_TESTNET } from "@/lib/contracts";

// MockERC20 deployed on testnet for each vault asset exposes a permissionless
// `mint(address,uint256)` — see zentory-protocol/contracts/test/invariants/mocks/MockERC20.sol.
const MOCK_ERC20_ABI = parseAbi([
  "function mint(address to, uint256 amount)",
  "function balanceOf(address account) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
]);

type AssetKey = "WBTC" | "WETH" | "WSOL" | "WXRP";

const ASSETS: Array<{
  key: AssetKey;
  label: string;
  description: string;
  address: `0x${string}`;
  decimals: number;
  amount: bigint; // a sensible demo amount, raw units
  amountLabel: string;
  accent: string;
}> = [
  {
    key: "WBTC",
    label: "Wrapped Bitcoin",
    description: "Testnet mock WBTC — deposit into zBTCVault",
    address: addresses.WBTC as `0x${string}`,
    decimals: 8,
    amount: 1n * 10n ** 8n, // 1 WBTC
    amountLabel: "1 WBTC",
    accent: "#F7931A",
  },
  {
    key: "WETH",
    label: "Wrapped Ethereum",
    description: "Testnet mock WETH — deposit into zETHVault",
    address: addresses.WETH as `0x${string}`,
    decimals: 18,
    amount: 10n * 10n ** 18n, // 10 WETH
    amountLabel: "10 WETH",
    accent: "#627EEA",
  },
  {
    key: "WSOL",
    label: "Wrapped Solana",
    description: "Testnet mock WSOL — deposit into zSOLVault",
    address: addresses.WSOL as `0x${string}`,
    decimals: 18,
    amount: 100n * 10n ** 18n, // 100 WSOL
    amountLabel: "100 WSOL",
    accent: "#9945FF",
  },
  {
    key: "WXRP",
    label: "Wrapped XRP",
    description: "Testnet mock WXRP — deposit into zXRPVault",
    address: addresses.WXRP as `0x${string}`,
    decimals: 6,
    amount: 10_000n * 10n ** 6n, // 10,000 WXRP
    amountLabel: "10,000 WXRP",
    accent: "#00AAE4",
  },
];

function fmtBalance(raw: bigint | undefined, decimals: number): string {
  if (raw === undefined) return "—";
  const n = Number(formatUnits(raw, decimals));
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString("en-US", { maximumFractionDigits: 4 });
}

function AssetCard({
  asset,
  user,
  onMint,
  isMinting,
}: {
  asset: (typeof ASSETS)[number];
  user: `0x${string}` | undefined;
  onMint: (asset: (typeof ASSETS)[number]) => void;
  isMinting: boolean;
}) {
  const balance = useReadContract({
    address: asset.address,
    abi: MOCK_ERC20_ABI,
    functionName: "balanceOf",
    args: user ? [user] : undefined,
    query: { enabled: !!user },
  });

  return (
    <div
      className="rounded-2xl p-6 flex flex-col gap-4"
      style={{ background: "#1c1c21", border: "1px solid #2a2f3a" }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col">
          <span
            className="text-xs uppercase tracking-widest font-semibold"
            style={{ color: asset.accent, fontFamily: "'Montserrat', sans-serif" }}
          >
            {asset.key}
          </span>
          <span className="text-base font-semibold mt-1" style={{ color: "#eaeaea" }}>
            {asset.label}
          </span>
          <span className="text-xs mt-1" style={{ color: "rgba(106,111,117,0.8)" }}>
            {asset.description}
          </span>
        </div>
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-widest" style={{ color: "rgba(106,111,117,0.7)" }}>
            Your balance
          </div>
          <div className="text-sm font-semibold mt-1" style={{ color: "#eaeaea", fontFamily: "'Space Mono', monospace" }}>
            {fmtBalance(balance.data as bigint | undefined, asset.decimals)} {asset.key}
          </div>
        </div>
      </div>

      <button
        onClick={() => onMint(asset)}
        disabled={!user || isMinting}
        className="mt-2 py-3 rounded-xl text-xs font-semibold uppercase tracking-widest transition-all"
        style={{
          background: user && !isMinting ? asset.accent : "rgba(255,255,255,0.06)",
          color: user && !isMinting ? "#0b0b0d" : "rgba(255,255,255,0.4)",
          cursor: user && !isMinting ? "pointer" : "not-allowed",
          fontFamily: "'Montserrat', sans-serif",
          border: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        {isMinting ? "Minting…" : `Mint ${asset.amountLabel}`}
      </button>

      <div className="text-[10px] font-mono" style={{ color: "rgba(106,111,117,0.6)" }}>
        Contract: <span className="select-all">{asset.address}</span>
      </div>
    </div>
  );
}

export default function FaucetPage() {
  const { address: user, isConnected } = useAccount();
  const chainId = useChainId();
  const onCorrectChain = chainId === HYPEREVM_TESTNET.id;

  const [pendingKey, setPendingKey] = useState<AssetKey | null>(null);
  const { writeContract, data: txHash, reset } = useWriteContract();
  const { isLoading: isTxPending, isSuccess: isTxSuccess } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  // pendingKey + isTxPending together drive the per-button "Minting…" state.
  // No useEffect needed: when the tx settles, isTxPending becomes false and
  // any subsequent click overwrites pendingKey via setPendingKey below.

  function handleMint(asset: (typeof ASSETS)[number]) {
    if (!user) return;
    setPendingKey(asset.key);
    reset();
    writeContract({
      address: asset.address,
      abi: MOCK_ERC20_ABI,
      functionName: "mint",
      args: [user, asset.amount],
    });
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-10">
        <div className="text-xs uppercase tracking-widest font-semibold mb-3" style={{ color: "#b08d57" }}>
          Testnet · HyperEVM 998
        </div>
        <h1 className="text-3xl md:text-4xl font-bold mb-3" style={{ color: "#eaeaea" }}>
          Testnet Faucet
        </h1>
        <p className="text-sm max-w-2xl" style={{ color: "rgba(106,111,117,0.9)" }}>
          Mint mock vault assets to your wallet so you can try the Alpha Vaults on HyperEVM testnet.
          These are unbacked test tokens — no real value. The underlying mock contract exposes a
          permissionless <code className="px-1 rounded" style={{ background: "rgba(255,255,255,0.06)", color: "#f0c040" }}>mint(address,uint256)</code> for testnet only.
        </p>
      </div>

      {!isConnected && (
        <div
          className="rounded-2xl p-6 mb-8 text-sm"
          style={{ background: "rgba(176,141,87,0.08)", border: "1px solid rgba(176,141,87,0.25)", color: "rgba(234,234,234,0.85)" }}
        >
          Connect your wallet to mint testnet assets. Use the Connect button in the top-right nav.
        </div>
      )}

      {isConnected && !onCorrectChain && (
        <div
          className="rounded-2xl p-6 mb-8 text-sm"
          style={{ background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.3)", color: "rgba(234,234,234,0.85)" }}
        >
          You are connected to chain <span className="font-mono">{chainId}</span>. Switch your wallet to <span className="font-semibold">HyperEVM Testnet ({HYPEREVM_TESTNET.id})</span> to use the faucet.
        </div>
      )}

      {txHash && (
        <div
          className="rounded-2xl p-4 mb-6 text-xs"
          style={{ background: "rgba(74,222,128,0.06)", border: "1px solid rgba(74,222,128,0.25)", color: "rgba(234,234,234,0.85)", fontFamily: "'Space Mono', monospace" }}
        >
          <div className="font-semibold mb-1" style={{ color: "#4ade80" }}>
            {isTxPending ? "Transaction pending" : isTxSuccess ? "Mint confirmed" : "Transaction submitted"}
          </div>
          <div className="break-all">tx: {txHash}</div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {ASSETS.map((a) => (
          <AssetCard
            key={a.key}
            asset={a}
            user={user as `0x${string}` | undefined}
            onMint={handleMint}
            isMinting={pendingKey === a.key && isTxPending}
          />
        ))}
      </div>

      <div
        className="rounded-2xl p-6 mt-10 text-xs"
        style={{ background: "rgba(124,92,255,0.04)", border: "1px solid rgba(124,92,255,0.2)", color: "rgba(234,234,234,0.7)" }}
      >
        <div className="font-semibold mb-2" style={{ color: "#7c5cff" }}>What next?</div>
        Once you have testnet assets, head to a vault page and deposit. You will receive vault
        shares (zBTC / zETH / zSOL / zXRP) that you can redeem for the underlying at any time.
        <div className="mt-2">
          Need testnet HYPE for gas? Use the public HyperEVM testnet faucet at
          {" "}
          <a
            href="https://app.hyperliquid-testnet.xyz/drip"
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
            style={{ color: "#7c5cff" }}
          >
            app.hyperliquid-testnet.xyz/drip
          </a>.
        </div>
      </div>

      <div className="text-[10px] text-center mt-10" style={{ color: "rgba(106,111,117,0.5)" }}>
        Testnet only · No real value · Subject to reset
      </div>
    </div>
  );
}
