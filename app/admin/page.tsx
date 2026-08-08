"use client";

import { useAccount, useReadContract, useWriteContract } from "wagmi";
import { EXECUTOR_ABI, VAULT_ABI, addresses, vaultMeta } from "@/lib/contracts";
import { useState, useEffect } from "react";

const VAULTS = [addresses.zETH, addresses.zBTC, addresses.zXRP, addresses.zSOL] as const;

function shorten(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function fmtBPS(raw: bigint): string {
  return `${(Number(raw) / 100).toFixed(1)}%`;
}

export default function AdminPage() {
  // Audit D-06 fix: gate the entire admin UI behind GUARDIAN_ROLE. Previously
  // any visitor could see the pause + risk-parameter controls; the
  // "Role-gated" pill was decorative, only the actual writes reverted
  // on-chain. On mainnet that becomes a phishing template. This is a UI
  // lockout, not a security boundary — writes still revert if the caller
  // lacks the role.
  //
  // Audit finding #44 fix: EVERY hook now runs unconditionally, before any
  // early return. Previously six hooks ran, then two conditional returns, then
  // ten more hooks — so the second render (after `mounted` flipped) called 16
  // hooks where React had recorded 6 and threw "Rendered more hooks than
  // during the previous render". That took out /admin — the emergency-pause
  // and per-vault risk-limit console — for every connected wallet, including
  // the guardian, which is the one wallet that needs it under time pressure.
  //
  // The reads below are cheap and wagmi's `query.enabled` already gates the
  // ones that need an argument, so hoisting them costs nothing. Branch on the
  // results at the end of the hook list, not in the middle of it.
  //
  const { address, isConnected } = useAccount();
  const { writeContract } = useWriteContract();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const [selectedVault, setSelectedVault] = useState<string>(addresses.zETH);
  const [maxPosSize, setMaxPosSize] = useState("");
  const [maxLevBPS, setMaxLevBPS] = useState("");
  const [txStatus, setTxStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const guardianRoleId = useReadContract({
    address: addresses.StrategyExecutor,
    abi: EXECUTOR_ABI,
    functionName: "GUARDIAN_ROLE",
  } as any);

  const callerHasGuardian = useReadContract({
    address: addresses.StrategyExecutor,
    abi: EXECUTOR_ABI,
    functionName: "hasRole",
    args:
      address && (guardianRoleId.data as `0x${string}` | undefined)
        ? [guardianRoleId.data as `0x${string}`, address]
        : undefined,
    query: { enabled: Boolean(address && guardianRoleId.data) },
  } as any);

  const isPaused = useReadContract({
    address: addresses.StrategyExecutor,
    abi: EXECUTOR_ABI,
    functionName: "paused",
  } as any);

  const keeperRole = useReadContract({
    address: addresses.StrategyExecutor,
    abi: EXECUTOR_ABI,
    functionName: "KEEPER_ROLE",
  } as any);

  const guardianRole = useReadContract({
    address: addresses.StrategyExecutor,
    abi: EXECUTOR_ABI,
    functionName: "GUARDIAN_ROLE",
  } as any);

  const vaultMaxPos = useReadContract({
    address: addresses.StrategyExecutor,
    abi: EXECUTOR_ABI,
    functionName: "maxPositionSize",
    args: [selectedVault],
  } as any);

  const vaultMaxLev = useReadContract({
    address: addresses.StrategyExecutor,
    abi: EXECUTOR_ABI,
    functionName: "maxLeverageBPS",
    args: [selectedVault],
  } as any);

  const meta = vaultMeta[selectedVault];

  function handlePauseToggle() {
    const shouldPause = !(isPaused.data as boolean);
    try {
      writeContract({
        address: addresses.StrategyExecutor,
        abi: EXECUTOR_ABI,
        functionName: "setPaused",
        args: [shouldPause],
      } as any);
      setTxStatus(shouldPause ? "Pausing executor…" : "Resuming executor…");
    } catch (err: any) {
      setError(err.message);
    }
  }

  function handleSetMaxPos() {
    if (!maxPosSize) return;
    try {
      writeContract({
        address: addresses.StrategyExecutor,
        abi: EXECUTOR_ABI,
        functionName: "setMaxPositionSize",
        args: [selectedVault, BigInt(parseFloat(maxPosSize) * 1e18)],
      } as any);
      setTxStatus("Setting max position size…");
      setMaxPosSize("");
    } catch (err: any) {
      setError(err.message);
    }
  }

  function handleSetMaxLev() {
    if (!maxLevBPS) return;
    const bps = BigInt(Math.round(parseFloat(maxLevBPS) * 100));
    try {
      writeContract({
        address: addresses.StrategyExecutor,
        abi: EXECUTOR_ABI,
        functionName: "setMaxLeverageBPS",
        args: [selectedVault, bps],
      } as any);
      setTxStatus("Setting max leverage…");
      setMaxLevBPS("");
    } catch (err: any) {
      setError(err.message);
    }
  }

  // ─── Gates ────────────────────────────────────────────────────────────────
  // All hooks above this line, all branching below it.

  if (!mounted || !isConnected) {
    return (
      <div className="min-h-screen flex items-center justify-center text-[#bfc3c7] p-8">
        Connect a wallet to access the admin console.
      </div>
    );
  }

  // `undefined` means the role read is still in flight — it is NOT "authorized".
  // Letting undefined fall through to the console is what made the old crash
  // deterministic for the guardian, and it would also flash the controls to a
  // wallet that turns out not to hold the role.
  if (callerHasGuardian.data === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center text-[#bfc3c7] p-8">
        Checking <code className="mx-1">GUARDIAN_ROLE</code> on the StrategyExecutor…
      </div>
    );
  }

  if (callerHasGuardian.data === false) {
    return (
      <div className="min-h-screen flex items-center justify-center text-center p-8">
        <div className="max-w-md">
          <div className="text-2xl font-bold text-white mb-2">Not authorized</div>
          <div className="text-sm text-[#bfc3c7]">
            This page is restricted to wallets holding{" "}
            <code>GUARDIAN_ROLE</code> on the StrategyExecutor contract.
            Connected: <code>{shorten(address!)}</code>.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative">

      <div className="mx-auto max-w-4xl space-y-8">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight" style={{ fontFamily: "var(--font-montserrat), sans-serif" }}><span className="gradient-text-gold">Admin Panel</span></h1>
            <span className="text-xs bg-red-500/10 border border-red-500/20 text-red-400 rounded-full px-3 py-1">
              Role-gated
            </span>
          </div>
          <p className="text-sm text-[#bfc3c7] mt-1">Manage risk parameters, emergency pause, and keeper configuration</p>
        </div>
        {/* Executor Status */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="rounded-2xl border border-[#2a2f3a] bg-[#1c1c21] p-5 glass-hover">
            <div className="text-xs text-[#bfc3c7] mb-1 uppercase tracking-wider">Executor Status</div>
            <div className="text-2xl font-bold" style={{ color: (isPaused.data as boolean) ? "#b08d57" : "#c2353f" }}>
              {(isPaused.data as boolean) ? "PAUSED" : "Active"}
            </div>
          </div>
          <div className="rounded-2xl border border-[#2a2f3a] bg-[#1c1c21] p-5 glass-hover">
            <div className="text-xs text-[#bfc3c7] mb-1 uppercase tracking-wider">Keeper Role Hash</div>
            <div className="font-mono text-xs text-white break-all leading-tight">
              {keeperRole.data ? (keeperRole.data as string).slice(0, 16) + "…" : "—"}
            </div>
          </div>
          <div className="rounded-2xl border border-[#2a2f3a] bg-[#1c1c21] p-5 glass-hover">
            <div className="text-xs text-[#bfc3c7] mb-1 uppercase tracking-wider">Guardian Role Hash</div>
            <div className="font-mono text-xs text-white break-all leading-tight">
              {guardianRole.data ? (guardianRole.data as string).slice(0, 16) + "…" : "—"}
            </div>
          </div>
        </div>

        {/* Emergency Pause */}
        <div className="rounded-2xl border border-[#2a2f3a] bg-[#1c1c21] p-6">
          <h2 className="text-lg font-semibold text-red-400 mb-1">Emergency Pause</h2>
          <p className="text-xs text-[#bfc3c7] mb-4">
            Immediately halts all trade execution. Guardian role required.
          </p>
          <button
            onClick={handlePauseToggle}
            className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors border"
            style={{
              background: (isPaused.data as boolean) ? "rgba(139,30,45,0.2)" : "rgba(139,30,45,0.2)",
              borderColor: "rgba(139,30,45,0.3)",
            }}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-lg transition-transform ${
                (isPaused.data as boolean) ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
          <span className="ml-3 text-sm text-[#bfc3c7]">
            {(isPaused.data as boolean) ? "Executor is paused" : "Executor is operational"}
          </span>
        </div>

        {/* Vault Risk Parameters */}
        <div className="rounded-2xl border border-[#2a2f3a] bg-[#1c1c21] p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Vault Risk Parameters</h2>

          {/* Vault Selector */}
          <div className="mb-5">
            <label className="mb-2 block text-xs font-medium text-[#bfc3c7] uppercase tracking-wider">Select Vault</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {VAULTS.map((v) => {
                const m = vaultMeta[v];
                return (
                  <button
                    key={v}
                    onClick={() => setSelectedVault(v)}
                    className={`rounded-xl border py-2 px-3 text-sm font-medium transition-all duration-300 ${
                      selectedVault === v
                        ? "border-[#8b1e2d] bg-[rgba(139,30,45,0.15)] text-[#c2353f]"
                        : "border-white/10 bg-white/5 text-[#bfc3c7] hover:border-white/30 hover:bg-white/10"
                    }`}
                  >
                    {m.symbol}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Current values */}
          <div className="grid grid-cols-2 gap-4 mb-5 p-4 rounded-xl bg-white/5 border border-white/10">
            <div>
              <div className="text-xs text-[#bfc3c7] mb-1">Max Position Size ({meta.symbol})</div>
              <div className="font-mono font-semibold text-white">
                {vaultMaxPos.data !== undefined ? `${(Number(vaultMaxPos.data as bigint) / 1e18).toFixed(4)}` : "—"}
              </div>
            </div>
            <div>
              <div className="text-xs text-[#bfc3c7] mb-1">Max Leverage</div>
              <div className="font-mono font-semibold text-white">
                {vaultMaxLev.data !== undefined ? fmtBPS(vaultMaxLev.data as bigint) : "—"}
              </div>
            </div>
          </div>

          {/* Set forms */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-[#bfc3c7]">Max Position Size (asset units)</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  step="any"
                  min="0"
                  placeholder="e.g. 10.0"
                  value={maxPosSize}
                  onChange={(e) => setMaxPosSize(e.target.value)}
                  className="w-full rounded-xl border px-4 py-3 text-white placeholder-white/30 transition-colors text-sm"
                  style={{ background: "rgba(42, 47, 58, 0.6)", borderColor: "#2a2f3a", color: "#eaeaea" }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = "#8b1e2d"; e.currentTarget.style.boxShadow = "0 0 0 2px rgba(139,30,45,0.2)"; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = "#2a2f3a"; e.currentTarget.style.boxShadow = "none"; }}
                />
                <button
                  onClick={handleSetMaxPos}
                  disabled={!maxPosSize}
                  className="rounded-xl font-semibold px-6 py-3 transition-all duration-300 hover:scale-[1.01] disabled:opacity-50"
                  style={{ background: "#8b1e2d", color: "#eaeaea", fontFamily: "var(--font-montserrat), sans-serif" }}
                >
                  Set
                </button>
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-[#bfc3c7]">Max Leverage (% or bps)</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  step="any"
                  min="0"
                  placeholder="e.g. 300 (= 3x)"
                  value={maxLevBPS}
                  onChange={(e) => setMaxLevBPS(e.target.value)}
                  className="w-full rounded-xl border px-4 py-3 text-white placeholder-white/30 transition-colors text-sm"
                  style={{ background: "rgba(42, 47, 58, 0.6)", borderColor: "#2a2f3a", color: "#eaeaea" }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = "#8b1e2d"; e.currentTarget.style.boxShadow = "0 0 0 2px rgba(139,30,45,0.2)"; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = "#2a2f3a"; e.currentTarget.style.boxShadow = "none"; }}
                />
                <button
                  onClick={handleSetMaxLev}
                  disabled={!maxLevBPS}
                  className="rounded-xl font-semibold px-6 py-3 transition-all duration-300 hover:scale-[1.01] disabled:opacity-50"
                  style={{ background: "#8b1e2d", color: "#eaeaea", fontFamily: "var(--font-montserrat), sans-serif" }}
                >
                  Set
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

        {/* Status */}
        {(txStatus || error) && (
          <div className={`rounded-xl border px-4 py-3 text-sm ${error ? "border-red-500/20 bg-red-500/10 text-red-400" : "border-[#b08d57]/20 bg-[#b08d57]/10 text-[#b08d57]"}`}>
            {error ?? txStatus}
          </div>
        )}

        {/* Keeper Info */}
        <div className="rounded-2xl border border-[#2a2f3a] bg-[#1c1c21] p-5">
          <h2 className="text-lg font-semibold text-white mb-4">Contract Addresses</h2>
          <div className="space-y-2">
            {[
              { label: "StrategyExecutor", addr: addresses.StrategyExecutor },
              { label: "HyperCoreAdapter", addr: addresses.HyperCoreAdapter },
            ].map(({ label, addr }) => (
              <div key={label} className="flex justify-between items-center text-sm">
                <span className="text-white/50">{label}</span>
                <a
                  href={`https://app.hyperliquid-testnet.xyz/explorer/address/${addr}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-xs transition-colors"
                  style={{ color: "#b08d57" }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = "#c2353f")}
                  onMouseLeave={(e) => (e.currentTarget.style.color = "#b08d57")}
                >
                  {shorten(addr)} →
                </a>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
