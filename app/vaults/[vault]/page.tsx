"use client";

import { use, useState, useEffect, useCallback } from "react";
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { erc20Abi } from "viem";
import Link from "next/link";
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
    decimals: 18,
    color: "#9945FF",
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
  actual: "#f0c040",
  hold: "#5a5a6a",
  grid: "rgba(255,255,255,0.06)",
  text: "rgba(255,255,255,0.4)",
};

function fmtBn(value: unknown, decimals: number, digits = 4): string {
  if (value === undefined || value === null) return "—";
  try {
    const raw = value as bigint;
    const v = Number(raw / 10n ** BigInt(decimals));
    if (isNaN(v)) return "—";
    return v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: digits });
  } catch {
    return "—";
  }
}

function fmtBnSimple(value: unknown, decimals = 18): number {
  if (value === undefined || value === null) return 0;
  try {
    return Number((value as bigint) / 10n ** BigInt(decimals));
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
  const { address: user, isConnected } = useAccount();
  const config = VAULT_CONFIG[vaultKey];

  const [activeTab, setActiveTab] = useState<"deposit" | "withdraw">("deposit");
  const [depositAmount, setDepositAmount] = useState("");
  const [withdrawShares, setWithdrawShares] = useState("");
  const [navHistory, setNavHistory] = useState<VaultNavSnapshot[]>([]);
  const [fills, setFills] = useState<HlUserFillRow[]>([]);

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
  const { writeContract: approve, data: approveHash } = useWriteContract();
  const { writeContract: deposit, data: depositHash } = useWriteContract();
  const { writeContract: withdraw, data: withdrawHash } = useWriteContract();

  const { isLoading: isApproveLoading } = useWaitForTransactionReceipt({ hash: approveHash });
  const { isLoading: isDepositLoading, isSuccess: isDepositSuccess } = useWaitForTransactionReceipt({ hash: depositHash });
  const { isLoading: isWithdrawLoading, isSuccess: isWithdrawSuccess } = useWaitForTransactionReceipt({ hash: withdrawHash });

  // ─── Load data ────────────────────────────────────────────────────
  useEffect(() => {
    if (!vaultKey) return;
    getVaultNavHistory(vaultKey.toUpperCase(), 30).then(setNavHistory);
    getRecentHlUserFills(40).then((rows) => {
      if (!config) return;
      setFills(rows.filter((r) => r.vault_address?.toLowerCase() === config.vaultAddress.toLowerCase()));
    });
  }, [vaultKey, config]);

  // ─── Derived values ───────────────────────────────────────────────
  const depositAmtBn = depositAmount && !isNaN(parseFloat(depositAmount))
    ? BigInt(Math.round(parseFloat(depositAmount) * 10 ** config.decimals))
    : 0n;

  const withdrawSharesBn = withdrawShares && !isNaN(parseFloat(withdrawShares))
    ? BigInt(Math.round(parseFloat(withdrawShares) * 10 ** 18))
    : 0n;

  const needsApproval = isConnected && depositAmtBn > 0n
    ? (allowance.data as bigint) !== undefined && depositAmtBn > (allowance.data as bigint)
    : false;

  const userAssetRaw = fmtBnSimple(userAssetBalance.data, config.decimals);
  const userSharesRaw = fmtBnSimple(userShares.data, 18);
  const tvlRaw = fmtBnSimple(totalAssets.data, config.decimals);

  // ─── Chart data ───────────────────────────────────────────────────
  const chartData = navHistory.map((snap) => ({
    time: new Date(snap.snapshot_at).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    NAV: snap.nav_per_share,
    HOLD: snap.hodl_nav,
    Alpha: snap.alpha_pct,
  }));

  // ─── Handlers ────────────────────────────────────────────────────
  const handleApprove = useCallback(() => {
    if (!asset || !depositAmtBn || !vault) return;
    approve({ address: asset, abi: erc20Abi, functionName: "approve", args: [vault, depositAmtBn] });
  }, [asset, vault, depositAmtBn, approve]);

  const handleDeposit = useCallback(() => {
    if (!vault || !depositAmtBn || !user) return;
    deposit({ address: vault, abi: VAULT_ABI, functionName: "deposit", args: [depositAmtBn, user] });
  }, [vault, depositAmtBn, user, deposit]);

  const handleWithdraw = useCallback(() => {
    if (!vault || !withdrawSharesBn || !user) return;
    withdraw({ address: vault, abi: VAULT_ABI, functionName: "redeem", args: [withdrawSharesBn, user, user] });
  }, [vault, withdrawSharesBn, user, withdraw]);

  useEffect(() => {
    if (isDepositSuccess) setDepositAmount("");
    if (isWithdrawSuccess) setWithdrawShares("");
  }, [isDepositSuccess, isWithdrawSuccess]);

  // ─── Not found ───────────────────────────────────────────────────
  if (!config) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="text-2xl font-bold mb-4" style={{ color: "#f0c040" }}>Vault not found</div>
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
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold"
          style={{ background: config.bgColor, color: config.color }}
        >
          {config.symbol.replace("z", "")}
        </div>
        <div>
          <h1 className="text-2xl font-bold">{config.name}</h1>
          <p className="text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>
            {config.assetName} · ERC-4626 · HyperEVM
          </p>
        </div>
        {!!isCircuitBreaker.data && (
          <span className="ml-auto px-3 py-1 rounded-full text-xs font-bold"
            style={{ background: "rgba(248,113,113,0.15)", color: "#f87171", border: "1px solid rgba(248,113,113,0.3)" }}>
            Circuit Breaker Active
          </span>
        )}
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: "NAV / Share", value: fmtBn(navPerShare.data, 18, 6) },
          { label: "TVL", value: `${tvlRaw.toFixed(2)} ${config.symbol.replace("z","")}` },
          { label: "Your Shares", value: userSharesRaw.toFixed(4) },
          { label: "Your Assets", value: `${userAssetRaw.toFixed(4)} ${config.symbol.replace("z","")}` },
        ].map((m) => (
          <div key={m.label} className="rounded-xl p-4" style={{ background: "#1c1c21", border: "1px solid #2a2f3a" }}>
            <div className="text-xs uppercase tracking-widest mb-1" style={{ color: "rgba(106,111,117,0.9)" }}>
              {m.label}
            </div>
            <div className="text-xl font-bold" style={{ color: "#eaeaea" }}>
              {m.value}
            </div>
          </div>
        ))}
      </div>

      {/* Deposit / Withdraw */}
      {isConnected ? (
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
                        ? "rgba(240,192,64,0.15)"
                        : "rgba(124,92,255,0.15)"
                      : "transparent",
                    color: activeTab === tab
                      ? tab === "deposit"
                        ? "#f0c040"
                        : "#7c5cff"
                      : "rgba(255,255,255,0.4)",
                    border: activeTab === tab
                      ? `1px solid ${tab === "deposit" ? "rgba(240,192,64,0.3)" : "rgba(124,92,255,0.3)"}`
                      : "1px solid transparent",
                  }}
                >
                  {tab}
                </button>
              ))}
            </div>

            {activeTab === "deposit" ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs uppercase tracking-widest mb-2" style={{ color: "rgba(106,111,117,0.9)" }}>
                    Amount ({config.symbol.replace("z", "")})
                  </label>
                  <input
                    type="number"
                    value={depositAmount}
                    onChange={(e) => setDepositAmount(e.target.value)}
                    placeholder="0.0000"
                    className="w-full rounded-lg px-4 py-3 text-lg outline-none"
                    style={{ background: "#12121f", border: "1px solid #2a2f3a", color: "#eaeaea" }}
                  />
                  <div className="flex justify-between text-xs mt-1" style={{ color: "rgba(106,111,117,0.9)" }}>
                    <span>Balance: {userAssetRaw.toFixed(4)}</span>
                    <button onClick={() => setDepositAmount(userAssetRaw.toString())} className="underline hover:opacity-70">
                      Max
                    </button>
                  </div>
                </div>

                {needsApproval ? (
                  <button
                    onClick={handleApprove}
                    disabled={isApproveLoading || !depositAmtBn}
                    className="w-full py-3 rounded-lg font-semibold text-sm disabled:opacity-50 transition-opacity"
                    style={{ background: "rgba(240,192,64,0.15)", color: "#f0c040", border: "1px solid rgba(240,192,64,0.3)" }}
                  >
                    {isApproveLoading ? "Approving..." : "Approve Token"}
                  </button>
                ) : (
                  <button
                    onClick={handleDeposit}
                    disabled={!depositAmount || parseFloat(depositAmount) === 0 || isDepositLoading || !!isCircuitBreaker.data}
                    className="w-full py-3 rounded-lg font-semibold text-sm disabled:opacity-50 transition-opacity"
                    style={{ background: "#f0c040", color: "#050507" }}
                  >
                    {isDepositLoading ? "Depositing..." : "Deposit"}
                  </button>
                )}

                {isDepositSuccess && (
                  <div className="text-center text-sm" style={{ color: "#4ade80" }}>
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
                    value={withdrawShares}
                    onChange={(e) => setWithdrawShares(e.target.value)}
                    placeholder="0.0000"
                    className="w-full rounded-lg px-4 py-3 text-lg outline-none"
                    style={{ background: "#12121f", border: "1px solid #2a2f3a", color: "#eaeaea" }}
                  />
                  <div className="flex justify-between text-xs mt-1" style={{ color: "rgba(106,111,117,0.9)" }}>
                    <span>Your shares: {userSharesRaw.toFixed(6)}</span>
                    <button onClick={() => setWithdrawShares(userSharesRaw.toString())} className="underline hover:opacity-70">
                      Max
                    </button>
                  </div>
                </div>

                <button
                  onClick={handleWithdraw}
                  disabled={!withdrawShares || parseFloat(withdrawShares) === 0 || isWithdrawLoading || !!isCircuitBreaker.data}
                  className="w-full py-3 rounded-lg font-semibold text-sm disabled:opacity-50 transition-opacity"
                  style={{ background: "#7c5cff", color: "#fff" }}
                >
                  {isWithdrawLoading ? "Withdrawing..." : "Withdraw"}
                </button>

                {isWithdrawSuccess && (
                  <div className="text-center text-sm" style={{ color: "#4ade80" }}>
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
              ["NAV / Share", fmtBn(navPerShare.data, 18, 6)],
              ["High Water Mark", fmtBn(hwm.data, 18, 6)],
              ["Circuit Breaker", isCircuitBreaker.data ? "Active" : "Inactive"],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between items-center text-sm border-b border-[#2a2f3a] pb-3 last:border-0">
                <span style={{ color: "rgba(106,111,117,0.9)" }}>{label}</span>
                <span style={{ color: "#eaeaea", fontSize: 12, fontFamily: "'Space Mono', monospace" }}>
                  {String(value).slice(0, 42)}
                </span>
              </div>
            ))}
            <a
              href={`https://testnet.hyperliquid.xyz/explorer/contract/${vault}`}
              target="_blank"
              rel="noopener noreferrer"
              className="block text-center py-2 rounded-lg text-xs mt-2"
              style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.5)", border: "1px solid #2a2f3a" }}
            >
              View on HyperEVM Explorer →
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
              <Area type="monotone" dataKey="HOLD" stroke={CHART_COLORS.hold} strokeWidth={1.5} fill="none" dot={false} name="HOLD" />
              <Area type="monotone" dataKey="NAV" stroke={CHART_COLORS.actual} strokeWidth={2} fill="url(#navGrad)" dot={false} name={`${config.symbol} NAV`} />
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
            Signal Arena — Recent Fills
          </h3>
          <span className="text-xs px-2 py-0.5 rounded-full"
            style={{ background: "rgba(124,92,255,0.15)", color: "#7c5cff" }}>
            Live from Hyperliquid
          </span>
        </div>

        {fills.length === 0 ? (
          <div className="text-center py-8 text-sm" style={{ color: "rgba(106,111,117,0.7)" }}>
            No fills indexed yet. Run{" "}
            <code className="px-1 rounded" style={{ background: "rgba(255,255,255,0.06)", color: "#f0c040" }}>
              poll_hyperliquid_fills.py
            </code>{" "}
            to start ingesting fills from Hyperliquid.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs" style={{ fontFamily: "'Space Mono', monospace" }}>
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
                      <span style={{ color: fill.side === "Buy" ? "#4ade80" : "#f87171" }}>{fill.side ?? "—"}</span>
                    </td>
                    <td className="py-3 pr-4" style={{ color: "#eaeaea" }}>{fill.sz ?? "—"}</td>
                    <td className="py-3 pr-4" style={{ color: "#eaeaea" }}>{fill.px ? parseFloat(fill.px).toFixed(4) : "—"}</td>
                    <td className="py-3 pr-4" style={{ color: "rgba(255,255,255,0.4)" }}>{fill.fee ?? "—"}</td>
                    <td className="py-3 pr-4">
                      {fill.closed_pnl ? (
                        <span style={{ color: parseFloat(fill.closed_pnl) >= 0 ? "#4ade80" : "#f87171" }}>
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
          <span>Fills from Hyperliquid via <code className="px-1 rounded" style={{ background: "rgba(255,255,255,0.06)" }}>poll_hyperliquid_fills.py</code></span>
          <Link href="/signals" className="underline" style={{ color: "#7c5cff" }}>View Signal Arena →</Link>
        </div>
      </div>
    </div>
  );
}
