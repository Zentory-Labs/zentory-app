"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { createPublicClient, formatUnits, http, parseAbi } from "viem";
import { useAccount, useReadContract } from "wagmi";
import { VideoHero } from "@/components/VideoHero";
import { addresses, ZENT_ABI, VAULT_ABI, STAKING_ABI, vaultMeta, HYPEREVM_TESTNET } from "@/lib/contracts";

const VAULTS = [addresses.zBTC, addresses.zETH, addresses.zSOL, addresses.zXRP] as const;

const VAULT_ABI_VIEM = parseAbi(VAULT_ABI as unknown as string[]);
const ZENT_ABI_VIEM = parseAbi(ZENT_ABI as unknown as string[]);
const STAKING_ABI_VIEM = parseAbi(STAKING_ABI as unknown as string[]);

// ─── Helpers ───────────────────────────────────────────────────────────────────

function getAssetDecimals(asset: string): number {
  // These correspond to the mock assets deployed on HyperEVM testnet.
  // ETH/SOL mocks are 18, BTC mock is 8, XRP mock is 6.
  if (asset === "BTC") return 8;
  if (asset === "XRP") return 6;
  return 18;
}

function fmtUnitsTrim(value: bigint, decimals: number, fractionDigits: number): string {
  const s = formatUnits(value, decimals);
  const n = Number(s);
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: fractionDigits,
  });
}

function fmt(value: bigint, decimals = 18, digits = 2): string {
  if (value === 0n) return "0";
  return fmtUnitsTrim(value, decimals, digits);
}

function fmtUsd(value: bigint, decimals = 18, digits = 2): string {
  if (value === 0n) return "$0";
  // NOTE: We don't have oracle pricing here; this is "units formatted with $".
  // It's still useful for showing non-zero TVL and comparing deltas in UI.
  const n = Number(formatUnits(value, decimals));
  if (!Number.isFinite(n)) return "$—";
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

// ─── Token Logo ─────────────────────────────────────────────────────────────

function TokenLogo({ symbol }: { symbol: string }) {
  const logos: Record<string, string> = {
    ETH: "/token-logos/eth.png",
    BTC: "/token-logos/btc.png",
    XRP: "/token-logos/xrp.png",
    SOL: "/token-logos/sol.png",
  };
  const src = logos[symbol];

  if (src) {
    return (
      <div className="w-10 h-10 rounded-xl overflow-hidden flex-shrink-0 border" style={{ borderColor: "#2a2f3a" }}>
        <Image
          src={src}
          alt={symbol}
          width={40}
          height={40}
          className="object-cover w-full h-full"
          style={{ display: "block" }}
        />
      </div>
    );
  }

  return (
    <div
      className="w-10 h-10 rounded-xl flex items-center justify-center text-xs font-bold flex-shrink-0 border"
      style={{ background: "#2a2f3a", color: "#eaeaea", borderColor: "#2a2f3a", fontFamily: "'Montserrat', sans-serif" }}
    >
      {symbol}
    </div>
  );
}

// ─── Vault Card ───────────────────────────────────────────────────────────────

function VaultCard({ vault }: { vault: (typeof VAULTS)[number] }) {
  const meta = vaultMeta[vault];
  const assetDecimals = getAssetDecimals(meta.asset);
  const [tvl, setTvl] = useState<bigint | null>(null);
  const [nav, setNav] = useState<bigint | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);

  const publicClient = useMemo(() => {
    return createPublicClient({
      chain: HYPEREVM_TESTNET as any,
      transport: http("/api/rpc"),
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setIsLoading(true);
        setIsError(false);
        const [assets, navPerShare] = await Promise.all([
          publicClient.readContract({ address: vault as any, abi: VAULT_ABI_VIEM as any, functionName: "totalAssets" }),
          publicClient.readContract({ address: vault as any, abi: VAULT_ABI_VIEM as any, functionName: "getNavPerShare" }),
        ]);
        if (cancelled) return;
        setTvl(assets as bigint);
        setNav(navPerShare as bigint);
      } catch {
        if (cancelled) return;
        setIsError(true);
        setTvl(null);
        setNav(null);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    load();
    const id = window.setInterval(load, 20_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [publicClient, vault]);

  return (
    <div
      className="p-5 rounded-2xl transition-all duration-300 group cursor-pointer"
      style={{
        background: "#1c1c21",
        border: "1px solid #2a2f3a",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.borderColor = "#8b1e2d";
        (e.currentTarget as HTMLDivElement).style.boxShadow = "0 0 40px rgba(139, 30, 45, 0.15), 0 20px 40px rgba(0,0,0,0.4)";
        (e.currentTarget as HTMLDivElement).style.transform = "translateY(-2px)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.borderColor = "#2a2f3a";
        (e.currentTarget as HTMLDivElement).style.boxShadow = "none";
        (e.currentTarget as HTMLDivElement).style.transform = "translateY(0)";
      }}
    >
      <div className="flex items-center gap-3 mb-4">
        <TokenLogo symbol={meta.asset} />
        <div>
          <div className="font-semibold text-white text-sm" style={{ fontFamily: "'Montserrat', sans-serif" }}>
            {meta.name}
          </div>
          <div className="text-xs" style={{ color: "#bfc3c7" }}>{meta.symbol}</div>
        </div>
      </div>
      <div className="space-y-2">
        {[
          {
            label: "TVL",
            value: isLoading ? "—" : (tvl === null ? "—" : fmtUsd(tvl, assetDecimals, 2)),
          },
          {
            label: "NAV / Share",
            value: isLoading ? "—" : (nav === null ? "—" : fmt(nav, assetDecimals, 6)),
          },
        ].map(({ label, value }) => (
          <div key={label} className="flex justify-between items-center">
            <span className="text-xs" style={{ color: "#6a6f75" }}>{label}</span>
            <span className="text-sm font-mono font-medium text-white">{value}</span>
          </div>
        ))}
      </div>
      <div
        className="mt-4 pt-3 flex items-center justify-between"
        style={{ borderTop: "1px solid #2a2f3a" }}
      >
        <span
          className="px-2.5 py-1 rounded-full text-xs font-semibold border"
          style={{
            background: "rgba(139, 30, 45, 0.15)",
            color: "#c2353f",
            borderColor: "rgba(139, 30, 45, 0.3)",
            fontFamily: "'Montserrat', sans-serif",
          }}
        >
          Live
        </span>
        <a
          href={`https://hypurrscan.io/address/${vault}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs transition-colors"
          style={{ color: "#6a6f75" }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "#b08d57")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "#6a6f75")}
        >
          View
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </a>
      </div>
    </div>
  );
}

// ─── Chain Data ───────────────────────────────────────────────────────────────

function ChainStats() {
  const { address, isConnected } = useAccount();

  const [supply, setSupply] = useState<bigint | null>(null);
  const [staked, setStaked] = useState<bigint | null>(null);
  const [chainReadError, setChainReadError] = useState(false);

  const publicClient = useMemo(() => {
    return createPublicClient({
      chain: HYPEREVM_TESTNET as any,
      transport: http("/api/rpc"),
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setChainReadError(false);
        const [s, t] = await Promise.all([
          publicClient.readContract({ address: addresses.ZENT as any, abi: ZENT_ABI_VIEM as any, functionName: "totalSupply" }),
          publicClient.readContract({ address: addresses.ZENTStaking as any, abi: STAKING_ABI_VIEM as any, functionName: "totalStaked" }),
        ]);
        if (cancelled) return;
        setSupply(s as bigint);
        setStaked(t as bigint);
      } catch {
        if (cancelled) return;
        setChainReadError(true);
        setSupply(null);
        setStaked(null);
      }
    }
    load();
    const id = window.setInterval(load, 20_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [publicClient]);

  const zenBalance = useReadContract({
    chainId: HYPEREVM_TESTNET.id,
    address: addresses.ZENT,
    abi: ZENT_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined, query: { enabled: !!isConnected },
  } as any);

  const supplyTokens = supply ? Number(supply / 10n ** 18n) : 0;
  const supplyHuman =
    supplyTokens >= 1_000_000_000
      ? `${(supplyTokens / 1_000_000_000).toFixed(1)}B`
      : supplyTokens >= 1_000_000
        ? `${(supplyTokens / 1_000_000).toFixed(1)}M`
        : supplyTokens.toLocaleString();

  const stakedFormatted = staked ? fmt(staked, 18, 0) : "—";

  const statItems = [
    { label: "ZENT Supply", value: supply ? supplyHuman : "—", accent: "#eaeaea" },
    { label: "ZENT Staked", value: stakedFormatted, accent: "#eaeaea" },
    { label: "Layer-1 Vaults", value: "4", accent: "#b08d57" },
    ...(isConnected && zenBalance.data !== undefined
      ? [{ label: "Your ZENT", value: Number(((zenBalance.data as bigint) ?? 0n) / 10n ** 18n).toLocaleString(undefined, { maximumFractionDigits: 2 }), accent: "#b08d57" }]
      : []),
  ];

  return (
    <div className="flex flex-col gap-3">
      {chainReadError && (
        <div
          className="rounded-xl border px-4 py-2 text-xs"
          style={{
            background: "rgba(194,53,63,0.08)",
            borderColor: "rgba(194,53,63,0.25)",
            color: "rgba(234,234,234,0.8)",
            fontFamily: "'Montserrat', sans-serif",
          }}
        >
          Chain read failed. If this persists, the backend RPC proxy may be misconfigured.
        </div>
      )}
      <div className="flex flex-wrap justify-center lg:justify-start gap-6 md:gap-10">
      {statItems.map(({ label, value, accent }) => (
        <div key={label} className="text-center">
          <div
            className="text-2xl md:text-3xl font-bold"
            style={{ color: accent, fontFamily: "'Montserrat', sans-serif" }}
          >
            {value}
          </div>
          <div
            className="text-xs md:text-sm uppercase tracking-wider mt-1"
            style={{ color: "#6a6f75", fontFamily: "'Montserrat', sans-serif" }}
          >
            {label}
          </div>
        </div>
      ))}
      </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function Home() {
  return (
    <div className="w-full overflow-x-hidden">

      {/* ── Video Hero ── */}
      <VideoHero>

        {/* Split layout: left content + right swap widget */}
        <div
          className="flex flex-col lg:flex-row items-center lg:items-start justify-between w-full max-w-7xl mx-auto gap-12"
          style={{ paddingTop: "80px" }}
        >

          {/* ── Left: content ── */}
          <div className="flex-1 flex flex-col items-start max-w-xl">
            {/* Badge */}
            <div
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold mb-6 border"
              style={{
                background: "rgba(139, 30, 45, 0.15)",
                borderColor: "rgba(139, 30, 45, 0.4)",
                color: "#c2353f",
                fontFamily: "'Montserrat', sans-serif",
                letterSpacing: "0.05em",
              }}
            >
              <span
                className="w-2 h-2 rounded-full"
                style={{ background: "#c2353f", boxShadow: "0 0 8px #c2353f" }}
              />
              HyperEVM · Chain 998 · ERC-4626
            </div>

            {/* Main headline */}
            <h1
              className="text-5xl sm:text-6xl md:text-7xl lg:text-6xl xl:text-8xl font-bold mb-6 tracking-tight leading-none"
              style={{ fontFamily: "'Montserrat', sans-serif" }}
            >
              <span className="gradient-text-gold">The Multi-Asset Alpha Vault</span>
            </h1>

            {/* Subtitle */}
            <p
              className="text-base md:text-lg xl:text-xl mb-6 font-light leading-relaxed"
              style={{ color: "rgba(234, 234, 234, 0.75)" }}
            >
              Stake BTC, SOL, ETH, XRP or HYPE. Access systematic yield from proprietary algorithms.
              <br />
              Your keys, your crypto — always.
            </p>

            {/* CTA buttons */}
            <div className="flex flex-col sm:flex-row gap-3 justify-start items-start mb-10">
              <a
                href="/"
                className="px-8 py-3.5 rounded-xl font-semibold text-sm transition-all duration-300 hover:scale-[1.03]"
                style={{
                  background: "#8b1e2d",
                  color: "#eaeaea",
                  fontFamily: "'Montserrat', sans-serif",
                  boxShadow: "0 0 40px rgba(139, 30, 45, 0.35)",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLAnchorElement).style.background = "#c2353f";
                  (e.currentTarget as HTMLAnchorElement).style.boxShadow = "0 0 60px rgba(194, 53, 63, 0.5)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLAnchorElement).style.background = "#8b1e2d";
                  (e.currentTarget as HTMLAnchorElement).style.boxShadow = "0 0 40px rgba(139, 30, 45, 0.35)";
                }}
              >
                Enter Vault
              </a>

              <a
                href="/subscribe"
                className="px-8 py-3.5 rounded-xl font-semibold text-sm transition-all duration-300 hover:scale-[1.03] border"
                style={{
                  background: "transparent",
                  color: "#b08d57",
                  borderColor: "rgba(176, 141, 87, 0.4)",
                  fontFamily: "'Montserrat', sans-serif",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLAnchorElement).style.background = "rgba(176, 141, 87, 0.08)";
                  (e.currentTarget as HTMLAnchorElement).style.borderColor = "rgba(176, 141, 87, 0.7)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLAnchorElement).style.background = "transparent";
                  (e.currentTarget as HTMLAnchorElement).style.borderColor = "rgba(176, 141, 87, 0.4)";
                }}
              >
                Subscribe
              </a>

              <a
                href="/research"
                className="px-8 py-3.5 rounded-xl font-semibold text-sm transition-all duration-300 hover:scale-[1.03]"
                style={{
                  background: "rgba(139, 30, 45, 0.2)",
                  color: "#c2353f",
                  border: "1px solid rgba(139, 30, 45, 0.4)",
                  fontFamily: "'Montserrat', sans-serif",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLAnchorElement).style.background = "rgba(139, 30, 45, 0.35)";
                  (e.currentTarget as HTMLAnchorElement).style.borderColor = "rgba(139, 30, 45, 0.65)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLAnchorElement).style.background = "rgba(139, 30, 45, 0.2)";
                  (e.currentTarget as HTMLAnchorElement).style.borderColor = "rgba(139, 30, 45, 0.4)";
                }}
              >
                Research
              </a>
            </div>

            {/* Live stats */}
            <ChainStats />
          </div>

          {/* ── Right: vault stats panel ── */}
          <div className="w-full max-w-sm flex-shrink-0">
            <div
              className="rounded-2xl border p-6"
              style={{
                background: "rgba(11,11,13,0.85)",
                borderColor: "rgba(139,30,45,0.3)",
              }}
            >
              <div className="text-xs font-semibold uppercase tracking-widest mb-5" style={{ color: "#b08d57", fontFamily: "'Montserrat', sans-serif" }}>
                Alpha Vault Stats
              </div>
              <div className="space-y-4">
                {[
                  { label: "Total Value Locked", value: "$0", sub: "Pre-mainnet" },
                  { label: "Yield Metric", value: "—", sub: "Variable — launch TBD" },
                  { label: "Supported Assets", value: "BTC · ETH · SOL", sub: "XRP · HYPE coming" },
                  { label: "Strategy", value: "Premium/Discount", sub: "Non-directional alpha" },
                ].map(({ label, value, sub }) => (
                  <div key={label} className="flex flex-col gap-0.5">
                    <span className="text-xs" style={{ color: "rgba(234,234,234,0.4)" }}>{label}</span>
                    <span className="text-sm font-semibold" style={{ color: "#eaeaea", fontFamily: "'Montserrat', sans-serif" }}>{value}</span>
                    <span className="text-xs" style={{ color: "rgba(234,234,234,0.25)" }}>{sub}</span>
                  </div>
                ))}
              </div>
              <div className="mt-6 pt-5 border-t" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
                <a
                  href="/"
                  className="block w-full py-3 rounded-xl text-center text-xs font-semibold uppercase tracking-widest transition-all hover:scale-[1.02]"
                  style={{
                    background: "#8b1e2d",
                    color: "#eaeaea",
                    fontFamily: "'Montserrat', sans-serif",
                  }}
                >
                  Enter Vault
                </a>
                <a
                  href="/research"
                  className="block w-full py-2.5 mt-2 rounded-xl text-center text-xs font-semibold uppercase tracking-widest transition-all hover:scale-[1.02] border"
                  style={{
                    background: "transparent",
                    color: "#b08d57",
                    borderColor: "rgba(176,141,87,0.3)",
                    fontFamily: "'Montserrat', sans-serif",
                  }}
                >
                  View Research
                </a>
              </div>
            </div>
          </div>

        </div>

        {/* Scroll indicator */}
        <div
          className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center"
          style={{ animation: "bounce 2s ease-in-out infinite" }}
        >
          <span
            className="text-xs uppercase tracking-widest mb-1"
            style={{ fontFamily: "'Montserrat', sans-serif", color: "#6a6f75" }}
          >
            Scroll
          </span>
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: "#8b1e2d" }}>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
        </div>

      </VideoHero>

      {/* ── Vaults ── */}
      <section
        className="max-w-7xl mx-auto px-6 py-20 space-y-8"
      >
        <div className="flex items-center gap-3 mb-2">
          <div className="h-px flex-1" style={{ background: "linear-gradient(to right, transparent, #2a2f3a, transparent)" }} />
          <div
            className="flex items-center gap-2 text-sm font-semibold"
            style={{ color: "#b08d57", fontFamily: "'Montserrat', sans-serif" }}
          >
            <span>⬡</span> Alpha Vaults
          </div>
          <p className="text-xs text-center" style={{ color: "rgba(234,234,234,0.35)" }}>
            Powered by Hyperliquid · On-chain execution · ERC-4626 vaults
          </p>
          <div className="h-px flex-1" style={{ background: "linear-gradient(to right, transparent, #2a2f3a, transparent)" }} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {VAULTS.map((v) => <VaultCard key={v} vault={v} />)}
        </div>
      </section>

    </div>
  );
}
