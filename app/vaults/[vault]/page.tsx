"use client";

import { use, useState, useEffect, useCallback } from "react";
import { notFound } from "next/navigation";
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { useRequireCorrectChain } from "@/lib/useRequireCorrectChain";
import { erc20Abi, formatUnits } from "viem";
import Link from "next/link";
import Image from "next/image";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { addresses, VAULT_ABI } from "@/lib/contracts";
import { getVaultNavHistory, type VaultNavSnapshot } from "@/lib/vault-stats";
import { getRecentHlUserFills, type HlUserFillRow } from "@/lib/execution-trace";
import { useDemoMode, DemoBadge } from "@/lib/demo/context";
import { demoNavHistory, demoHlFills } from "@/lib/demo/data";
import LiveSignalWidget from "@/components/LiveSignalWidget";
import GhostPortfolioTile from "@/components/GhostPortfolioTile";
import VaultTrustPanel from "@/components/VaultTrustPanel";

const VAULT_CONFIG: Record<string, {
  name: string;
  symbol: string;
  decimals: number;
  color: string;
  bgColor: string;
  assetName: string;
  vaultAddress: `0x${string}`;
  assetAddress: `0x${string}`;
}> = {
  // Each vault wraps the correctly-labelled MockERC20 on-chain (verified via
  // vault.asset()). NOTE on the old "$100B zSOL" scare: that was a DECIMALS
  // DISPLAY bug, not an on-chain problem. zSOL holds totalAssets = 1e11 raw
  // WSOL which, at WSOL's 9 decimals, is a sane ~100 SOL — it only looked like
  // 100 billion when rendered without the 9-decimal scaling. Fixed by the
  // decimals:9 entry below (+ matching handling on the dashboard/home pages).
  // No on-chain action needed; verified 2026-06-02 (totalAssets == 1e11).
  zBTC: {
    name: "zBTC Vault",
    symbol: "zBTC",
    decimals: 8,
    color: "#F7931A",
    bgColor: "rgba(247,147,26,0.1)",
    assetName: "Wrapped Bitcoin",
    vaultAddress: addresses.zBTC,
    assetAddress: addresses.WBTC,
  },
  zETH: {
    name: "zETH Vault",
    symbol: "zETH",
    decimals: 18,
    color: "#627EEA",
    bgColor: "rgba(98,126,234,0.1)",
    assetName: "Wrapped Ethereum",
    vaultAddress: addresses.zETH,
    assetAddress: addresses.WETH,
  },
  zSOL: {
    name: "zSOL Vault",
    symbol: "zSOL",
    decimals: 9,
    color: "#c2353f",
    bgColor: "rgba(153,69,255,0.1)",
    assetName: "Wrapped Solana",
    vaultAddress: addresses.zSOL,
    assetAddress: addresses.WSOL,
  },
  zXRP: {
    name: "zXRP Vault",
    symbol: "zXRP",
    decimals: 6,
    color: "#00AAE4",
    bgColor: "rgba(0,170,228,0.1)",
    assetName: "Wrapped XRP",
    vaultAddress: addresses.zXRP,
    assetAddress: addresses.WXRP,
  },
};

const CHART_COLORS = {
  actual: "#b08d57",
  hold: "#5a5a6a",
  grid: "rgba(255,255,255,0.06)",
  text: "rgba(255,255,255,0.4)",
};

/**
 * Asset icon for the vault header. Tries to load /token-logos/<asset>.png
 * and falls back to a brand-colored initial chip if the file is missing
 * or fails to load. Previously rendered both image AND fallback at the
 * same time, causing the text to overlap the image.
 */
function AssetIcon({
  symbol,
  bgColor,
  color,
  assetName,
}: {
  symbol: string;
  bgColor: string;
  color: string;
  assetName: string;
}) {
  const [imgError, setImgError] = useState(false);
  return (
    <div
      className="relative w-10 h-10 rounded-full overflow-hidden flex items-center justify-center font-bold ring-2 flex-shrink-0"
      style={{
        background: bgColor,
        color,
        // @ts-expect-error — Tailwind ring is implemented via outline + ring-color
        "--tw-ring-color": color,
      }}
    >
      {imgError ? (
        <span className="text-xs" style={{ color }}>
          {symbol}
        </span>
      ) : (
        <Image
          src={`/token-logos/${symbol.toLowerCase()}.png`}
          alt={assetName}
          width={40}
          height={40}
          className="w-full h-full object-cover"
          onError={() => setImgError(true)}
          unoptimized
        />
      )}
    </div>
  );
}

// Use viem's formatUnits so we don't lose sub-unit precision to BigInt's
// integer division. The old impl rendered 0.5 WBTC as "0.00" because
// 50_000_000n / 10n**8n is 0n in BigInt math.
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

function fmtBnSimple(value: unknown, decimals = 18): number {
  if (value === undefined || value === null) return 0;
  try {
    const n = Number(formatUnits(value as bigint, decimals));
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

function fmtPct(v: number | undefined): string {
  if (v === undefined || v === null || isNaN(v)) return "—";
  return `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`;
}

export default function VaultDetailPage({ params }: { params: Promise<{ vault: string }> }) {
  const { vault: vaultKey } = use(params);
  // Unknown vault key (e.g. /vaults/foo) → render Next.js 404 page before
  // touching any wagmi hooks downstream that assume a valid config.
  if (!VAULT_CONFIG[vaultKey]) notFound();
  const { address: user, isConnected } = useAccount();
  const { enabled: demoMode } = useDemoMode();
  const config = VAULT_CONFIG[vaultKey];

  const [activeTab, setActiveTab] = useState<"deposit" | "withdraw">("deposit");
  const [depositAmount, setDepositAmount] = useState("");
  const [withdrawShares, setWithdrawShares] = useState("");
  const [navHistory, setNavHistory] = useState<VaultNavSnapshot[]>([]);
  const [fills, setFills] = useState<HlUserFillRow[]>([]);
  // Gate wallet-dependent UI until after mount so SSR ("not connected") matches
  // the first client render. Without this, wagmi hydrating from localStorage
  // shows a different tree on the second client render and React fails to bind
  // event handlers (Deposit click does nothing).
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const vault = config?.vaultAddress as `0x${string}` | undefined;
  const asset = config?.assetAddress as `0x${string}` | undefined;

  // ─── Contract reads ────────────────────────────────────────────────
  const userAssetBalance = useReadContract({
    address: asset,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [user ?? "0x0000000000000000000000000000000000000000"],
    query: { enabled: isConnected && !!user },
  });

  const userShares = useReadContract({
    address: vault,
    abi: VAULT_ABI,
    functionName: "balanceOf",
    args: [user ?? "0x0000000000000000000000000000000000000000"],
    query: { enabled: isConnected && !!user },
  });

  const totalAssets = useReadContract({
    address: vault,
    abi: VAULT_ABI,
    functionName: "totalAssets",
    query: { enabled: !!vault },
  });

  const navPerShare = useReadContract({
    address: vault,
    abi: VAULT_ABI,
    functionName: "getNavPerShare",
    query: { enabled: !!vault },
  });

  const hwm = useReadContract({
    address: vault,
    abi: VAULT_ABI,
    functionName: "highWaterMark",
    query: { enabled: !!vault },
  });

  const isCircuitBreaker = useReadContract({
    address: vault,
    abi: VAULT_ABI,
    functionName: "isCircuitBreakerActive",
    query: { enabled: !!vault },
  });

  const allowance = useReadContract({
    address: asset,
    abi: erc20Abi,
    functionName: "allowance",
    args: [user ?? "0x0000000000000000000000000000000000000000", vault ?? "0x0000000000000000000000000000000000000000"],
    query: { enabled: isConnected && !!user && !!vault },
  });

  // ─── Write contracts ────────────────────────────────────────────────
  const { writeContract: approve, data: approveHash, error: approveError } = useWriteContract();
  const { writeContract: deposit, data: depositHash, error: depositError } = useWriteContract();
  const { writeContract: withdraw, data: withdrawHash, error: withdrawError } = useWriteContract();

  const { isLoading: isApproveLoading, isSuccess: isApproveSuccess } = useWaitForTransactionReceipt({ hash: approveHash });
  const { isLoading: isDepositLoading, isSuccess: isDepositSuccess } = useWaitForTransactionReceipt({ hash: depositHash });
  const { isLoading: isWithdrawLoading, isSuccess: isWithdrawSuccess } = useWaitForTransactionReceipt({ hash: withdrawHash });

  // ─── Load data ────────────────────────────────────────────────────
  useEffect(() => {
    if (!vaultKey) return;
    if (demoMode) {
      const symbol = vaultKey.toUpperCase();
      const points = demoNavHistory(symbol, 30);
      const unit = 10 ** config.decimals;
      const rows: VaultNavSnapshot[] = points.map((p, i) => ({
        id: `demo-${symbol}-${i}`,
        vault_symbol: symbol,
        snapshot_at: new Date(p.ts).toISOString(),
        nav_per_share: p.nav * unit,
        total_assets: 500 * unit,
        hodl_nav: p.hodl * unit,
        alpha_pct: p.alphaPct,
        created_at: new Date(p.ts).toISOString(),
      }));
      setNavHistory(rows);
      // Populate demo HL fills for this specific vault so the Recent Fills
      // table tells a coherent execution story.
      const sampleFills = demoHlFills(symbol, 14);
      setFills(sampleFills as unknown as HlUserFillRow[]);
      return;
    }
    getVaultNavHistory(vaultKey.toUpperCase(), 30).then(setNavHistory);
    getRecentHlUserFills(40).then((rows) => {
      if (!config) return;
      setFills(rows.filter((r) => r.vault_address?.toLowerCase() === config.vaultAddress.toLowerCase()));
    });
  }, [vaultKey, config, demoMode]);

  // ─── Derived values ───────────────────────────────────────────────
  const depositAmtBn = depositAmount && !isNaN(parseFloat(depositAmount))
    ? BigInt(Math.round(parseFloat(depositAmount) * 10 ** config.decimals))
    : 0n;

  // Vault shares use the SAME decimals as the underlying asset (OZ ERC-4626
  // default; no decimals offset on BaseVault). For zBTC that's 8, not 18.
  const shareDecimals = config.decimals;

  const withdrawSharesBn = withdrawShares && !isNaN(parseFloat(withdrawShares))
    ? BigInt(Math.round(parseFloat(withdrawShares) * 10 ** shareDecimals))
    : 0n;

  const needsApproval = isConnected && depositAmtBn > 0n
    ? (allowance.data as bigint) !== undefined && depositAmtBn > (allowance.data as bigint)
    : false;

  const userAssetRaw = fmtBnSimple(userAssetBalance.data, config.decimals);
  const userSharesRaw = fmtBnSimple(userShares.data, shareDecimals);
  const tvlRaw = fmtBnSimple(totalAssets.data, config.decimals);

  // ─── Input validation + loading/empty states (audit #12) ──────────
  const depositNum = parseFloat(depositAmount || "");
  const withdrawNum = parseFloat(withdrawShares || "");
  const depositTooMuch = !isNaN(depositNum) && depositNum > userAssetRaw;
  const depositInvalid = depositAmount !== "" && (isNaN(depositNum) || depositNum <= 0 || depositTooMuch);
  const withdrawTooMuch = !isNaN(withdrawNum) && withdrawNum > userSharesRaw;
  const withdrawInvalid = withdrawShares !== "" && (isNaN(withdrawNum) || withdrawNum <= 0 || withdrawTooMuch);
  const hasZeroBalance = mounted && isConnected && !userAssetBalance.isLoading && userAssetRaw === 0;
  const statsLoading =
    navPerShare.isLoading || totalAssets.isLoading ||
    (isConnected && (userShares.isLoading || userAssetBalance.isLoading));

  // ─── Chart data ───────────────────────────────────────────────────
  // vault_nav_history stores RAW integer chain units (1 zBTC share = 1e8,
  // zETH = 1e18) — normalize so the axis/tooltip read ~1.0, not 1e18.
  const navUnit = 10 ** config.decimals;
  const chartData = navHistory.map((snap) => ({
    time: new Date(snap.snapshot_at).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    NAV: snap.nav_per_share / navUnit,
    HOLD: snap.hodl_nav / navUnit,
    Alpha: snap.alpha_pct,
  }));

  // ─── Handlers ────────────────────────────────────────────────────
  // Audit D-04: gate every write behind a chain-id check. Previously, a user
  // on Ethereum mainnet hitting Deposit would approve whatever contract sat
  // at our vault address on mainnet (often unrelated, occasionally hostile).
  const requireChain = useRequireCorrectChain();

  const handleApprove = useCallback(async () => {
    if (!asset || !depositAmtBn || !vault) return;
    if (!(await requireChain())) return;
    approve({ address: asset, abi: erc20Abi, functionName: "approve", args: [vault, depositAmtBn] });
  }, [asset, vault, depositAmtBn, approve, requireChain]);

  const handleDeposit = useCallback(async () => {
    if (!vault || !depositAmtBn || !user) return;
    if (!(await requireChain())) return;
    deposit({ address: vault, abi: VAULT_ABI, functionName: "deposit", args: [depositAmtBn, user] });
  }, [vault, depositAmtBn, user, deposit, requireChain]);

  const handleWithdraw = useCallback(async () => {
    if (!vault || !withdrawSharesBn || !user) return;
    if (!(await requireChain())) return;
    withdraw({ address: vault, abi: VAULT_ABI, functionName: "redeem", args: [withdrawSharesBn, user, user] });
  }, [vault, withdrawSharesBn, user, withdraw, requireChain]);

  useEffect(() => {
    if (isApproveSuccess || isDepositSuccess || isWithdrawSuccess) {
      if (isDepositSuccess) setDepositAmount("");
      if (isWithdrawSuccess) setWithdrawShares("");
      // wagmi doesn't auto-invalidate same-block reads on this RPC. Manually
      // refetch user + vault state so the UI reflects the new on-chain truth
      // without a full page reload. Also refetch on Approve success so the
      // Approve→Deposit button transition happens without a page refresh.
      userAssetBalance.refetch();
      userShares.refetch();
      allowance.refetch();
      totalAssets.refetch();
      navPerShare.refetch();
      hwm.refetch();
      isCircuitBreaker.refetch();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isApproveSuccess, isDepositSuccess, isWithdrawSuccess]);

  // ─── Not found ───────────────────────────────────────────────────
  if (!config) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="text-2xl font-bold mb-4" style={{ color: "#b08d57" }}>Vault not found</div>
        <Link href="/dashboard" className="text-sm underline" style={{ color: "rgba(255,255,255,0.5)" }}>
          Back to dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <Link href="/dashboard" className="text-sm hover:opacity-70 transition-opacity" style={{ color: "rgba(255,255,255,0.4)" }}>
          ← Dashboard
        </Link>
        {/* Asset icon — real crypto logo with a brand-colored ring. */}
        <AssetIcon symbol={config.symbol.replace("z", "")} bgColor={config.bgColor} color={config.color} assetName={config.assetName} />
        <div>
          <h1 className="text-2xl font-bold">{config.name}</h1>
          <p className="text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>
            {config.assetName} · ERC-4626 · HyperEVM
          </p>
        </div>
        {!!isCircuitBreaker.data && (
          <span className="ml-auto px-3 py-1 rounded-full text-xs font-bold"
            style={{ background: "rgba(194,53,63,0.15)", color: "#c2353f", border: "1px solid rgba(194,53,63,0.3)" }}>
            Circuit Breaker Active
          </span>
        )}
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: "NAV / Share", value: fmtBn(navPerShare.data, config.decimals, 6) },
          { label: "TVL", value: `${tvlRaw.toFixed(2)} ${config.symbol.replace("z","")}` },
          { label: "Your Shares", value: userSharesRaw.toFixed(4) },
          { label: "Your Assets", value: `${userAssetRaw.toFixed(4)} ${config.symbol.replace("z","")}` },
        ].map((m) => (
          <div key={m.label} className="rounded-xl p-4" style={{ background: "#1c1c21", border: "1px solid #2a2f3a" }}>
            <div className="text-xs uppercase tracking-widest mb-1" style={{ color: "rgba(106,111,117,0.9)" }}>
              {m.label}
            </div>
            {statsLoading ? (
              <div className="h-7 w-2/3 rounded animate-pulse" style={{ background: "rgba(255,255,255,0.08)" }} />
            ) : (
              <div className="text-xl font-bold" style={{ color: "#eaeaea" }}>
                {m.value}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Deposit / Withdraw */}
      {mounted && isConnected ? (
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          {/* Action card */}
          <div className="rounded-2xl p-6" style={{ background: "#1c1c21", border: "1px solid #2a2f3a" }}>
            <div className="flex gap-2 mb-6">
              {(["deposit", "withdraw"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className="flex-1 py-2 rounded-lg text-sm font-semibold capitalize transition-all"
                  style={{
                    background: activeTab === tab
                      ? tab === "deposit"
                        ? "rgba(176,141,87,0.15)"
                        : "rgba(194,53,63,0.15)"
                      : "transparent",
                    color: activeTab === tab
                      ? tab === "deposit"
                        ? "#b08d57"
                        : "#c2353f"
                      : "rgba(255,255,255,0.4)",
                    border: activeTab === tab
                      ? `1px solid ${tab === "deposit" ? "rgba(176,141,87,0.3)" : "rgba(194,53,63,0.3)"}`
                      : "1px solid transparent",
                  }}
                >
                  {tab}
                </button>
              ))}
            </div>

            {activeTab === "deposit" ? (
              <div className="space-y-4">
                {/* Zero-balance affordance — surface the faucet so a connected user
                    with no test tokens has a path forward (audit #12). */}
                {hasZeroBalance && (
                  <Link
                    href="/faucet"
                    className="flex items-center justify-between gap-2 rounded-lg px-4 py-3 text-xs transition-colors"
                    style={{ background: "rgba(176,141,87,0.08)", border: "1px solid rgba(176,141,87,0.3)", color: "#b08d57" }}
                  >
                    <span>No {config.symbol.replace("z", "")} yet? Mint test tokens from the faucet.</span>
                    <span aria-hidden="true">→</span>
                  </Link>
                )}
                <div>
                  <label className="block text-xs uppercase tracking-widest mb-2" style={{ color: "rgba(106,111,117,0.9)" }}>
                    Amount ({config.symbol.replace("z", "")})
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={depositAmount}
                    onChange={(e) => setDepositAmount(e.target.value)}
                    placeholder="0.0000"
                    aria-label={`Amount of ${config.symbol.replace("z", "")} to deposit`}
                    className="w-full rounded-lg px-4 py-3 text-lg outline-none"
                    style={{ background: "#141417", border: `1px solid ${depositInvalid ? "rgba(194,53,63,0.5)" : "#2a2f3a"}`, color: "#eaeaea" }}
                  />
                  <div className="flex justify-between text-xs mt-1" style={{ color: "rgba(106,111,117,0.9)" }}>
                    <span>Balance: {userAssetRaw.toFixed(4)}</span>
                    <button onClick={() => setDepositAmount(userAssetRaw.toString())} className="underline hover:opacity-70">
                      Max
                    </button>
                  </div>
                  {depositTooMuch && (
                    <div className="text-xs mt-1.5" style={{ color: "#c2353f" }}>Amount exceeds your balance.</div>
                  )}
                </div>

                {needsApproval ? (
                  <button
                    onClick={handleApprove}
                    disabled={isApproveLoading || depositInvalid}
                    className="w-full py-3 rounded-xl font-semibold text-sm disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
                    style={{ background: "rgba(176,141,87,0.15)", color: "#b08d57", border: "1px solid rgba(176,141,87,0.3)" }}
                  >
                    {isApproveLoading ? "Approving..." : isApproveSuccess ? "Approved ✓ — Deposit next" : "Approve Token"}
                  </button>
                ) : (
                  <button
                    onClick={handleDeposit}
                    disabled={isDepositLoading || depositInvalid || depositAmount === "" || !!isCircuitBreaker.data}
                    className="w-full py-3 rounded-xl font-semibold text-sm disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
                    style={{ background: "#b08d57", color: "#0b0b0d" }}
                  >
                    {isDepositLoading ? "Depositing..." : "Deposit"}
                  </button>
                )}

                {(approveError || depositError) && (
                  <div className="text-xs p-3 rounded-lg" style={{ background: "rgba(194,53,63,0.08)", border: "1px solid rgba(194,53,63,0.3)", color: "#c2353f", fontFamily: "monospace" }}>
                    {(approveError || depositError)?.message?.split("\n")[0] ?? String(approveError ?? depositError)}
                  </div>
                )}

                {isDepositSuccess && (
                  <div className="text-center text-sm" style={{ color: "#34d399" }}>
                    Deposit successful!
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs uppercase tracking-widest mb-2" style={{ color: "rgba(106,111,117,0.9)" }}>
                    Shares to Redeem
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={withdrawShares}
                    onChange={(e) => setWithdrawShares(e.target.value)}
                    placeholder="0.0000"
                    aria-label="Shares to redeem"
                    className="w-full rounded-lg px-4 py-3 text-lg outline-none"
                    style={{ background: "#141417", border: `1px solid ${withdrawInvalid ? "rgba(194,53,63,0.5)" : "#2a2f3a"}`, color: "#eaeaea" }}
                  />
                  <div className="flex justify-between text-xs mt-1" style={{ color: "rgba(106,111,117,0.9)" }}>
                    <span>Your shares: {userSharesRaw.toFixed(6)}</span>
                    <button onClick={() => setWithdrawShares(userSharesRaw.toString())} className="underline hover:opacity-70">
                      Max
                    </button>
                  </div>
                  {withdrawTooMuch && (
                    <div className="text-xs mt-1.5" style={{ color: "#c2353f" }}>You don&apos;t have that many shares.</div>
                  )}
                </div>

                <button
                  onClick={handleWithdraw}
                  disabled={isWithdrawLoading || withdrawInvalid || withdrawShares === "" || !!isCircuitBreaker.data}
                  className="w-full py-3 rounded-xl font-semibold text-sm disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
                  style={{ background: "#c2353f", color: "#fff" }}
                >
                  {isWithdrawLoading ? "Withdrawing..." : "Withdraw"}
                </button>

                {withdrawError && (
                  <div className="text-xs p-3 rounded-lg" style={{ background: "rgba(194,53,63,0.08)", border: "1px solid rgba(194,53,63,0.3)", color: "#c2353f", fontFamily: "monospace" }}>
                    {withdrawError?.message?.split("\n")[0] ?? String(withdrawError)}
                  </div>
                )}

                {isWithdrawSuccess && (
                  <div className="text-center text-sm" style={{ color: "#34d399" }}>
                    Withdrawal successful!
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Vault info */}
          <div className="rounded-2xl p-6 space-y-4" style={{ background: "#1c1c21", border: "1px solid #2a2f3a" }}>
            <h3 className="text-sm font-semibold uppercase tracking-widest" style={{ color: "rgba(106,111,117,0.9)" }}>
              Vault Details
            </h3>
            {[
              ["Contract", vault ?? "—"],
              ["Asset", asset ?? "—"],
              ["NAV / Share", fmtBn(navPerShare.data, config.decimals, 6)],
              ["High Water Mark", fmtBn(hwm.data, config.decimals, 6)],
              ["Circuit Breaker", isCircuitBreaker.data ? "Active" : "Inactive"],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between items-center text-sm border-b border-[#2a2f3a] pb-3 last:border-0">
                <span style={{ color: "rgba(106,111,117,0.9)" }}>{label}</span>
                <span style={{ color: "#eaeaea", fontSize: 12, fontFamily: "var(--font-space-mono), monospace" }}>
                  {String(value).slice(0, 42)}
                </span>
              </div>
            ))}
            <a
              href={`https://app.hyperliquid-testnet.xyz/explorer/address/${vault}`}
              target="_blank"
              rel="noopener noreferrer"
              className="block text-center py-2 rounded-lg text-xs mt-2"
              style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.5)", border: "1px solid #2a2f3a" }}
            >
              View on Hyperliquid Explorer →
            </a>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl p-8 text-center mb-8" style={{ background: "#1c1c21", border: "1px solid #2a2f3a" }}>
          <div className="text-lg font-semibold mb-2" style={{ color: "#eaeaea" }}>Connect your wallet</div>
          <div className="text-sm" style={{ color: "rgba(106,111,117,0.9)" }}>
            Connect to deposit or withdraw from the {config.name}.
          </div>
        </div>
      )}

      {/* Fees / withdrawals / security — the deposit-decision table stakes */}
      <VaultTrustPanel vaultAddress={config.vaultAddress} />

      {/* Why NAV sits at 1.0 on testnet — set expectations before the flat chart
          reads as "dead/broken". Only the SpotVault runs the live keeper loop on
          testnet; the base vaults hold the asset 1:1 until mainnet. */}
      <div
        className="rounded-2xl p-5 mb-8 text-sm"
        style={{ background: "rgba(176,141,87,0.07)", border: "1px solid rgba(176,141,87,0.22)", color: "rgba(234,234,234,0.7)" }}
      >
        <span style={{ color: "#b08d57", fontWeight: 600 }}>Testnet: this vault holds {config.symbol.slice(1)} 1:1 (NAV 1.0).</span>{" "}
        The autonomous long/flat rebalancing strategy currently runs on the{" "}
        <Link href="/vaults/spot" className="underline" style={{ color: "#b08d57" }}>SpotVault</Link>{" "}
        — its NAV moves with real on-chain rebalances every 4 hours. The {config.symbol} vault begins
        rebalancing at mainnet; until then its NAV is intentionally flat. See the live, hash-chained{" "}
        <Link href="/track-record" className="underline" style={{ color: "#b08d57" }}>track record</Link>.
      </div>

      {/* Live signal + Ghost Portfolio attribution (forward-recorder driven) */}
      <LiveSignalWidget asset={config.symbol.slice(1)} />
      <GhostPortfolioTile asset={config.symbol.slice(1)} />

      {/* NAV Chart */}
      {chartData.length > 0 && (
        <div className="rounded-2xl p-6 mb-8" style={{ background: "#1c1c21", border: "1px solid #2a2f3a" }}>
          <h3 className="text-sm font-semibold uppercase tracking-widest mb-6" style={{ color: "rgba(106,111,117,0.9)" }}>
            NAV History — {config.symbol} vs HOLD
          </h3>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
              <defs>
                <linearGradient id="navGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={CHART_COLORS.actual} stopOpacity={0.2} />
                  <stop offset="95%" stopColor={CHART_COLORS.actual} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} />
              <XAxis dataKey="time" tick={{ fill: CHART_COLORS.text, fontSize: 11 }} />
              <YAxis tick={{ fill: CHART_COLORS.text, fontSize: 11 }} />
              <Tooltip
                contentStyle={{ background: "#1c1c21", border: "1px solid #2a2f3a", borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: "rgba(255,255,255,0.5)" }}
              />
              <Area type="monotone" dataKey="HOLD" stroke={CHART_COLORS.hold} strokeWidth={1.5} fill="none" dot={false} name="HOLD" isAnimationActive={false} />
              <Area type="monotone" dataKey="NAV" stroke={CHART_COLORS.actual} strokeWidth={2} fill="url(#navGrad)" dot={false} name={`${config.symbol} NAV`} isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
          <div className="flex gap-6 mt-4 justify-center">
            {[{ color: CHART_COLORS.actual, label: `${config.symbol} NAV` }, { color: CHART_COLORS.hold, label: "HOLD" }].map((l) => (
              <div key={l.label} className="flex items-center gap-2 text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>
                <div className="w-3 h-0.5 rounded" style={{ background: l.color }} />
                {l.label}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Fills */}
      <div className="rounded-2xl p-6" style={{ background: "#1c1c21", border: "1px solid #2a2f3a" }}>
        <div className="flex items-center gap-3 mb-6">
          <h3 className="text-sm font-semibold uppercase tracking-widest" style={{ color: "rgba(106,111,117,0.9)" }}>
            Strategy Execution — Recent Fills
          </h3>
          {/* Only badge it "Live from Hyperliquid" when there are actually live
              fills — otherwise the green-ish badge contradicts the empty body
              ("venue ingestion goes live with mainnet"). */}
          <span className="text-xs px-2 py-0.5 rounded-full"
            style={fills.length > 0
              ? { background: "rgba(176,141,87,0.15)", color: "#b08d57" }
              : { background: "rgba(234,234,234,0.06)", color: "rgba(234,234,234,0.45)" }}>
            {fills.length > 0 ? "Live from Hyperliquid" : "Pending · mainnet"}
          </span>
        </div>

        {fills.length === 0 ? (
          <div className="text-center py-8 text-sm" style={{ color: "rgba(106,111,117,0.7)" }}>
            No fills to display yet — venue ingestion goes live with mainnet (Q4 2026).
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs" style={{ fontFamily: "var(--font-space-mono), monospace" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #2a2f3a" }}>
                  {["Time", "Coin", "Side", "Size", "Price", "Fee", "P&L", "HL User"].map((h) => (
                    <th key={h} className="text-left pb-3 pr-4 font-normal uppercase tracking-wider" style={{ color: "rgba(106,111,117,0.7)" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {fills.slice(0, 20).map((fill) => (
                  <tr key={fill.id} style={{ borderBottom: "1px solid rgba(42,47,58,0.5)" }}>
                    <td className="py-3 pr-4" style={{ color: "rgba(255,255,255,0.4)" }}>
                      {fill.time_ms
                        ? new Date(fill.time_ms).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
                        : "—"}
                    </td>
                    <td className="py-3 pr-4" style={{ color: "#eaeaea" }}>{fill.coin ?? "—"}</td>
                    <td className="py-3 pr-4">
                      <span style={{ color: fill.side === "Buy" ? "#34d399" : "#c2353f" }}>{fill.side ?? "—"}</span>
                    </td>
                    <td className="py-3 pr-4" style={{ color: "#eaeaea" }}>{fill.sz ?? "—"}</td>
                    <td className="py-3 pr-4" style={{ color: "#eaeaea" }}>{fill.px ? parseFloat(fill.px).toFixed(4) : "—"}</td>
                    <td className="py-3 pr-4" style={{ color: "rgba(255,255,255,0.4)" }}>{fill.fee ?? "—"}</td>
                    <td className="py-3 pr-4">
                      {fill.closed_pnl ? (
                        <span style={{ color: parseFloat(fill.closed_pnl) >= 0 ? "#34d399" : "#c2353f" }}>
                          {parseFloat(fill.closed_pnl) >= 0 ? "+" : ""}{parseFloat(fill.closed_pnl).toFixed(4)}
                        </span>
                      ) : "—"}
                    </td>
                    <td className="py-3 pr-4" style={{ color: "rgba(255,255,255,0.4)" }}>
                      <span title={fill.hl_user_address}>{fill.hl_user_address?.slice(0, 8)}...</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-4 flex gap-4 text-xs" style={{ color: "rgba(106,111,117,0.6)" }}>
          <span>Venue fills sourced from Hyperliquid testnet</span>
          <Link href="/signals" className="underline" style={{ color: "#b08d57" }}>View signal feed →</Link>
        </div>
      </div>
    </div>
  );
}
