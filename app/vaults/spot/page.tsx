"use client";

import { useState, useEffect, useCallback } from "react";
import {
  useAccount,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { useRequireCorrectChain } from "@/lib/useRequireCorrectChain";
import { erc20Abi, formatUnits } from "viem";
import Link from "next/link";
import { addresses, SPOT_VAULT_ABI, PRICE_ORACLE_ABI } from "@/lib/contracts";
import LiveSignalWidget from "@/components/LiveSignalWidget";
import GhostPortfolioTile from "@/components/GhostPortfolioTile";

// Deposit asset is the testnet WBTC mock (8 decimals); shares carry a +6
// decimals offset (so 14), but we always read decimals() rather than assume.
const VAULT = addresses.SpotVault as `0x${string}`;
const ASSET = addresses.WBTC as `0x${string}`;
const ORACLE = addresses.ShadowPriceOracle as `0x${string}`;
const ASSET_DEC = 8; // WBTC
const ZERO = "0x0000000000000000000000000000000000000000" as const;

function fmtBn(value: unknown, decimals: number, digits = 4): string {
  if (value === undefined || value === null) return "—";
  try {
    const n = Number(formatUnits(value as bigint, decimals));
    if (!Number.isFinite(n)) return "—";
    return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: digits });
  } catch {
    return "—";
  }
}

function num(value: unknown, decimals: number): number {
  if (value === undefined || value === null) return 0;
  try {
    const n = Number(formatUnits(value as bigint, decimals));
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

const CARD = { background: "#1c1c21", border: "1px solid #2a2f3a" } as const;
const DIM = "rgba(106,111,117,0.9)";

export default function SpotVaultPage() {
  const { address: user, isConnected } = useAccount();
  const requireChain = useRequireCorrectChain();

  const [activeTab, setActiveTab] = useState<"deposit" | "withdraw">("deposit");
  const [depositAmount, setDepositAmount] = useState("");
  const [withdrawShares, setWithdrawShares] = useState("");
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // ─── Reads ─────────────────────────────────────────────────────────
  const shareDec = useReadContract({ address: VAULT, abi: SPOT_VAULT_ABI, functionName: "decimals" });
  const navPerShare = useReadContract({ address: VAULT, abi: SPOT_VAULT_ABI, functionName: "getNavPerShare" });
  const grossValue = useReadContract({ address: VAULT, abi: SPOT_VAULT_ABI, functionName: "grossValue" });
  const targetWeight = useReadContract({ address: VAULT, abi: SPOT_VAULT_ABI, functionName: "targetWeightBps" });
  const perfFee = useReadContract({ address: VAULT, abi: SPOT_VAULT_ABI, functionName: "performanceFee" });
  const hwm = useReadContract({ address: VAULT, abi: SPOT_VAULT_ABI, functionName: "highWaterMark" });
  const slippage = useReadContract({ address: VAULT, abi: SPOT_VAULT_ABI, functionName: "maxSlippageBps" });
  const isCircuitBreaker = useReadContract({ address: VAULT, abi: SPOT_VAULT_ABI, functionName: "isCircuitBreakerActive" });
  const oracle = useReadContract({ address: ORACLE, abi: PRICE_ORACLE_ABI, functionName: "latestRoundData" });
  const vaultAssetBal = useReadContract({ address: ASSET, abi: erc20Abi, functionName: "balanceOf", args: [VAULT] });

  const shareDecimals = Number(shareDec.data ?? 14);

  const userShares = useReadContract({
    address: VAULT, abi: SPOT_VAULT_ABI, functionName: "balanceOf",
    args: [user ?? ZERO], query: { enabled: isConnected && !!user },
  });
  const userValue = useReadContract({
    address: VAULT, abi: SPOT_VAULT_ABI, functionName: "convertToAssets",
    args: [(userShares.data as bigint) ?? 0n], query: { enabled: isConnected && !!userShares.data },
  });
  const userAssetBalance = useReadContract({
    address: ASSET, abi: erc20Abi, functionName: "balanceOf",
    args: [user ?? ZERO], query: { enabled: isConnected && !!user },
  });
  const allowance = useReadContract({
    address: ASSET, abi: erc20Abi, functionName: "allowance",
    args: [user ?? ZERO, VAULT], query: { enabled: isConnected && !!user },
  });

  // ─── Writes ────────────────────────────────────────────────────────
  const { writeContract: approve, data: approveHash, error: approveError } = useWriteContract();
  const { writeContract: deposit, data: depositHash, error: depositError } = useWriteContract();
  const { writeContract: withdraw, data: withdrawHash, error: withdrawError } = useWriteContract();
  const { isLoading: isApproveLoading, isSuccess: isApproveSuccess } = useWaitForTransactionReceipt({ hash: approveHash });
  const { isLoading: isDepositLoading, isSuccess: isDepositSuccess } = useWaitForTransactionReceipt({ hash: depositHash });
  const { isLoading: isWithdrawLoading, isSuccess: isWithdrawSuccess } = useWaitForTransactionReceipt({ hash: withdrawHash });

  // ─── Derived ───────────────────────────────────────────────────────
  const depositAmtBn = depositAmount && !isNaN(parseFloat(depositAmount))
    ? BigInt(Math.round(parseFloat(depositAmount) * 10 ** ASSET_DEC)) : 0n;
  const withdrawSharesBn = withdrawShares && !isNaN(parseFloat(withdrawShares))
    ? BigInt(Math.round(parseFloat(withdrawShares) * 10 ** shareDecimals)) : 0n;
  const needsApproval = isConnected && depositAmtBn > 0n
    ? (allowance.data as bigint) !== undefined && depositAmtBn > (allowance.data as bigint) : false;

  const userAssetRaw = num(userAssetBalance.data, ASSET_DEC);
  const userSharesRaw = num(userShares.data, shareDecimals);
  const userValueRaw = num(userValue.data, ASSET_DEC);
  const grossBtc = num(grossValue.data, ASSET_DEC);
  const vaultBtc = num(vaultAssetBal.data, ASSET_DEC);
  const oraclePrice = oracle.data ? Number((oracle.data as readonly bigint[])[1]) / 1e8 : 0;
  const longPct = grossBtc > 0 ? Math.min(100, Math.max(0, (vaultBtc / grossBtc) * 100)) : 0;
  const posture = longPct >= 50 ? "LONG" : "FLAT";
  const tvlUsd = grossBtc * oraclePrice;
  const perfFeePct = perfFee.data !== undefined ? Number(perfFee.data) / 100 : 20;
  const targetPct = targetWeight.data !== undefined ? Number(targetWeight.data) / 100 : 0;

  // ─── Handlers ──────────────────────────────────────────────────────
  const handleApprove = useCallback(async () => {
    if (!depositAmtBn) return;
    if (!(await requireChain())) return;
    approve({ address: ASSET, abi: erc20Abi, functionName: "approve", args: [VAULT, depositAmtBn] });
  }, [depositAmtBn, approve, requireChain]);

  const handleDeposit = useCallback(async () => {
    if (!depositAmtBn || !user) return;
    if (!(await requireChain())) return;
    deposit({ address: VAULT, abi: SPOT_VAULT_ABI, functionName: "deposit", args: [depositAmtBn, user] });
  }, [depositAmtBn, user, deposit, requireChain]);

  const handleWithdraw = useCallback(async () => {
    if (!withdrawSharesBn || !user) return;
    if (!(await requireChain())) return;
    withdraw({ address: VAULT, abi: SPOT_VAULT_ABI, functionName: "redeem", args: [withdrawSharesBn, user, user] });
  }, [withdrawSharesBn, user, withdraw, requireChain]);

  useEffect(() => {
    if (isApproveSuccess || isDepositSuccess || isWithdrawSuccess) {
      if (isDepositSuccess) setDepositAmount("");
      if (isWithdrawSuccess) setWithdrawShares("");
      userAssetBalance.refetch();
      userShares.refetch();
      userValue.refetch();
      allowance.refetch();
      grossValue.refetch();
      navPerShare.refetch();
      vaultAssetBal.refetch();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isApproveSuccess, isDepositSuccess, isWithdrawSuccess]);

  const stats = [
    { label: "NAV / Share", value: fmtBn(navPerShare.data, ASSET_DEC, 6) },
    { label: "TVL", value: `${grossBtc.toFixed(4)} BTC` + (oraclePrice ? `  ·  $${tvlUsd.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : "") },
    { label: "Exposure", value: `${posture} · ${longPct.toFixed(0)}%` },
    { label: "Perf Fee", value: `${perfFeePct.toFixed(0)}%` },
  ];

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link href="/dashboard" className="text-sm hover:opacity-70 transition-opacity" style={{ color: "rgba(255,255,255,0.4)" }}>
          ← Dashboard
        </Link>
        <div className="relative w-10 h-10 rounded-full flex items-center justify-center font-bold flex-shrink-0"
          style={{ background: "rgba(247,147,26,0.12)", color: "#F7931A", border: "1px solid rgba(247,147,26,0.4)" }}>
          ₿
        </div>
        <div>
          <h1 className="text-2xl font-bold">Spot Strategy Vault</h1>
          <p className="text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>
            BTC long ⇄ flat · oracle-valued ERC-4626 · HyperEVM
          </p>
        </div>
        <span className="ml-auto px-3 py-1 rounded-full text-xs font-bold"
          style={{ background: "rgba(124,92,255,0.15)", color: "#7c5cff", border: "1px solid rgba(124,92,255,0.3)" }}>
          Research · Testnet
        </span>
        {!!isCircuitBreaker.data && (
          <span className="px-3 py-1 rounded-full text-xs font-bold"
            style={{ background: "rgba(248,113,113,0.15)", color: "#f87171", border: "1px solid rgba(248,113,113,0.3)" }}>
            Circuit Breaker Active
          </span>
        )}
      </div>

      {/* What this is */}
      <div className="rounded-2xl p-5 mb-6 text-sm leading-relaxed" style={{ ...CARD, color: "rgba(255,255,255,0.65)" }}>
        Deposits are held in <span style={{ color: "#eaeaea" }}>BTC</span> when the strategy is bullish (<b style={{ color: "#F7931A" }}>LONG</b>)
        and rotated to cash when it turns defensive (<b style={{ color: "#7c5cff" }}>FLAT</b>), driven by the same signed
        signals that power the Signal Arena. NAV is marked to the price oracle, so your share value moves with realised
        strategy PnL — not just the spot price. This is a <b>testnet research vault</b> on a self-contained shadow swap
        venue; mainnet routes to real spot liquidity behind an external audit.
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {stats.map((m) => (
          <div key={m.label} className="rounded-xl p-4" style={CARD}>
            <div className="text-xs uppercase tracking-widest mb-1" style={{ color: DIM }}>{m.label}</div>
            <div className="text-lg font-bold" style={{ color: "#eaeaea" }}>{m.value}</div>
          </div>
        ))}
      </div>

      {/* Deposit / Withdraw */}
      {mounted && isConnected ? (
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <div className="rounded-2xl p-6" style={CARD}>
            <div className="flex gap-2 mb-6">
              {(["deposit", "withdraw"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className="flex-1 py-2 rounded-lg text-sm font-semibold capitalize transition-all"
                  style={{
                    background: activeTab === tab ? (tab === "deposit" ? "rgba(240,192,64,0.15)" : "rgba(124,92,255,0.15)") : "transparent",
                    color: activeTab === tab ? (tab === "deposit" ? "#f0c040" : "#7c5cff") : "rgba(255,255,255,0.4)",
                    border: activeTab === tab ? `1px solid ${tab === "deposit" ? "rgba(240,192,64,0.3)" : "rgba(124,92,255,0.3)"}` : "1px solid transparent",
                  }}
                >
                  {tab}
                </button>
              ))}
            </div>

            {activeTab === "deposit" ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs uppercase tracking-widest mb-2" style={{ color: DIM }}>Amount (BTC)</label>
                  <input
                    type="number" value={depositAmount} onChange={(e) => setDepositAmount(e.target.value)} placeholder="0.0000"
                    className="w-full rounded-lg px-4 py-3 text-lg outline-none"
                    style={{ background: "#12121f", border: "1px solid #2a2f3a", color: "#eaeaea" }}
                  />
                  <div className="flex justify-between text-xs mt-1" style={{ color: DIM }}>
                    <span>Balance: {userAssetRaw.toFixed(6)}</span>
                    <button onClick={() => setDepositAmount(userAssetRaw.toString())} className="underline hover:opacity-70">Max</button>
                  </div>
                </div>

                {needsApproval ? (
                  <button onClick={handleApprove} disabled={isApproveLoading}
                    className="w-full py-3 rounded-lg font-semibold text-sm disabled:opacity-50 transition-opacity"
                    style={{ background: "rgba(240,192,64,0.15)", color: "#f0c040", border: "1px solid rgba(240,192,64,0.3)" }}>
                    {isApproveLoading ? "Approving..." : "Approve WBTC"}
                  </button>
                ) : (
                  <button onClick={handleDeposit} disabled={isDepositLoading || !!isCircuitBreaker.data}
                    className="w-full py-3 rounded-lg font-semibold text-sm disabled:opacity-50 transition-opacity"
                    style={{ background: "#f0c040", color: "#050507" }}>
                    {isDepositLoading ? "Depositing..." : "Deposit"}
                  </button>
                )}

                {(approveError || depositError) && (
                  <div className="text-xs p-3 rounded-lg" style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.3)", color: "#ef4444", fontFamily: "monospace" }}>
                    {(approveError || depositError)?.message?.split("\n")[0] ?? String(approveError ?? depositError)}
                  </div>
                )}
                {isDepositSuccess && <div className="text-center text-sm" style={{ color: "#4ade80" }}>Deposit successful!</div>}
                <p className="text-xs" style={{ color: "rgba(106,111,117,0.7)" }}>
                  Need testnet BTC? <Link href="/faucet" className="underline" style={{ color: "#7c5cff" }}>Mint from the faucet →</Link>
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs uppercase tracking-widest mb-2" style={{ color: DIM }}>Shares to Redeem</label>
                  <input
                    type="number" value={withdrawShares} onChange={(e) => setWithdrawShares(e.target.value)} placeholder="0.0000"
                    className="w-full rounded-lg px-4 py-3 text-lg outline-none"
                    style={{ background: "#12121f", border: "1px solid #2a2f3a", color: "#eaeaea" }}
                  />
                  <div className="flex justify-between text-xs mt-1" style={{ color: DIM }}>
                    <span>Your shares: {userSharesRaw.toFixed(6)}</span>
                    <button onClick={() => setWithdrawShares(userSharesRaw.toString())} className="underline hover:opacity-70">Max</button>
                  </div>
                </div>
                <button onClick={handleWithdraw} disabled={isWithdrawLoading || !!isCircuitBreaker.data}
                  className="w-full py-3 rounded-lg font-semibold text-sm disabled:opacity-50 transition-opacity"
                  style={{ background: "#7c5cff", color: "#fff" }}>
                  {isWithdrawLoading ? "Withdrawing..." : "Withdraw"}
                </button>
                {withdrawError && (
                  <div className="text-xs p-3 rounded-lg" style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.3)", color: "#ef4444", fontFamily: "monospace" }}>
                    {withdrawError?.message?.split("\n")[0] ?? String(withdrawError)}
                  </div>
                )}
                {isWithdrawSuccess && <div className="text-center text-sm" style={{ color: "#4ade80" }}>Withdrawal successful!</div>}
              </div>
            )}
          </div>

          {/* Position + details */}
          <div className="rounded-2xl p-6 space-y-3" style={CARD}>
            <h3 className="text-sm font-semibold uppercase tracking-widest" style={{ color: DIM }}>Your Position</h3>
            {[
              ["Your Shares", userSharesRaw.toFixed(6)],
              ["Your Value", `${userValueRaw.toFixed(6)} BTC`],
              ["BTC Price (oracle)", oraclePrice ? `$${oraclePrice.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : "—"],
              ["NAV / Share", fmtBn(navPerShare.data, ASSET_DEC, 6)],
              ["High Water Mark", fmtBn(hwm.data, ASSET_DEC, 6)],
              ["Commanded Target", `${targetPct.toFixed(0)}% long`],
              ["Max Slippage", slippage.data !== undefined ? `${Number(slippage.data) / 100}%` : "—"],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between items-center text-sm border-b border-[#2a2f3a] pb-3 last:border-0">
                <span style={{ color: DIM }}>{label}</span>
                <span style={{ color: "#eaeaea", fontSize: 13, fontFamily: "'Space Mono', monospace" }}>{value}</span>
              </div>
            ))}
            <a href={`https://app.hyperliquid-testnet.xyz/explorer/address/${VAULT}`} target="_blank" rel="noopener noreferrer"
              className="block text-center py-2 rounded-lg text-xs mt-2"
              style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.5)", border: "1px solid #2a2f3a" }}>
              View vault on Explorer →
            </a>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl p-8 text-center mb-8" style={CARD}>
          <div className="text-lg font-semibold mb-2" style={{ color: "#eaeaea" }}>Connect your wallet</div>
          <div className="text-sm" style={{ color: DIM }}>Connect to deposit BTC into the Spot Strategy Vault.</div>
        </div>
      )}

      {/* Live signal + Ghost Portfolio attribution (forward-recorder driven) */}
      <LiveSignalWidget asset="BTC" />
      <GhostPortfolioTile asset="BTC" />
    </div>
  );
}
