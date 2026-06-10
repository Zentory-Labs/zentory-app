"use client";

import Link from "next/link";

type AssetClass = "CRYPTO_PERP" | "EQUITY" | "FOREX" | "COMMODITY";

interface PlannedMarket {
  symbol: string;
  name: string;
  assetClass: AssetClass;
  exchange: string;
  status: "Live (testnet)" | "Planned";
}

// Markets ZENTORY plans to support. "Live (testnet)" rows correspond to the
// four ERC-4626 Alpha Vaults already deployed on HyperEVM 998 (zBTC / zETH /
// zSOL / zXRP). The rest are roadmap targets — no fake stats here.
const PLANNED_MARKETS: PlannedMarket[] = [
  { symbol: "BTC-PERP", name: "Bitcoin Perpetual", assetClass: "CRYPTO_PERP", exchange: "Hyperliquid", status: "Live (testnet)" },
  { symbol: "ETH-PERP", name: "Ethereum Perpetual", assetClass: "CRYPTO_PERP", exchange: "Hyperliquid", status: "Live (testnet)" },
  { symbol: "SOL-PERP", name: "Solana Perpetual", assetClass: "CRYPTO_PERP", exchange: "Hyperliquid", status: "Live (testnet)" },
  { symbol: "XRP-PERP", name: "XRP Perpetual", assetClass: "CRYPTO_PERP", exchange: "Hyperliquid", status: "Live (testnet)" },
  { symbol: "HYPE-PERP", name: "HYPE Perpetual", assetClass: "CRYPTO_PERP", exchange: "Hyperliquid", status: "Planned" },
  { symbol: "AAPL", name: "Apple Inc.", assetClass: "EQUITY", exchange: "Ondo / Synthetix", status: "Planned" },
  { symbol: "MSFT", name: "Microsoft Corp.", assetClass: "EQUITY", exchange: "Ondo / Synthetix", status: "Planned" },
  { symbol: "EUR/USD", name: "Euro / US Dollar", assetClass: "FOREX", exchange: "Chainlink", status: "Planned" },
  { symbol: "GBP/USD", name: "British Pound / USD", assetClass: "FOREX", exchange: "Chainlink", status: "Planned" },
  { symbol: "XAU/USD", name: "Gold / US Dollar", assetClass: "COMMODITY", exchange: "Chainlink", status: "Planned" },
];

const ASSET_CLASS_COLORS: Record<AssetClass, string> = {
  CRYPTO_PERP: "#B08D57",
  EQUITY: "#627EEA",
  FOREX: "#14F195",
  COMMODITY: "#F7931A",
};

const ASSET_CLASS_LABELS: Record<AssetClass, string> = {
  CRYPTO_PERP: "Crypto Perp",
  EQUITY: "Equity",
  FOREX: "Forex",
  COMMODITY: "Commodity",
};

export default function MarketsPage() {
  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-10">
        <div
          className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold mb-3"
          style={{ background: "rgba(176,141,87,0.12)", borderColor: "rgba(176,141,87,0.3)", color: "#b08d57" }}
        >
          <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "#22c55e", boxShadow: "0 0 8px #22c55e" }} />
          Testnet · HyperEVM 998
        </div>
        <h1 className="text-3xl md:text-4xl font-bold mb-3" style={{ color: "#eaeaea" }}>
          Markets
        </h1>
        <p className="text-sm max-w-2xl" style={{ color: "rgba(106,111,117,0.9)" }}>
          The markets ZENTORY supports today and the roadmap to multi-asset. Live markets settle on
          HyperEVM testnet through the four vaults; provider-level statistics will populate as
          quants submit signals via{" "}
          <code className="px-1 rounded" style={{ background: "rgba(255,255,255,0.06)", color: "#b08d57" }}>SignalRegistry</code>{" "}
          and resolve through 4-hour <code className="px-1 rounded" style={{ background: "rgba(255,255,255,0.06)", color: "#b08d57" }}>EpochScoring</code>.
        </p>
      </div>

      <div className="rounded-2xl overflow-hidden" style={{ background: "#1c1c21", border: "1px solid #2a2f3a" }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: "rgba(255,255,255,0.03)", borderBottom: "1px solid #2a2f3a" }}>
              {["Market", "Asset Class", "Venue", "Status"].map((h) => (
                <th
                  key={h}
                  className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider"
                  style={{ color: "rgba(234,234,234,0.4)" }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PLANNED_MARKETS.map((m) => {
              const color = ASSET_CLASS_COLORS[m.assetClass];
              const isLive = m.status === "Live (testnet)";
              return (
                <tr key={m.symbol} style={{ borderBottom: "1px solid rgba(42,47,58,0.5)" }}>
                  <td className="px-5 py-4">
                    <div className="font-semibold text-sm" style={{ color: "#eaeaea" }}>{m.symbol}</div>
                    <div className="text-xs" style={{ color: "rgba(234,234,234,0.45)" }}>{m.name}</div>
                  </td>
                  <td className="px-5 py-4">
                    <span
                      className="px-2 py-0.5 rounded-full text-xs font-semibold border"
                      style={{ background: color + "18", borderColor: color + "40", color }}
                    >
                      {ASSET_CLASS_LABELS[m.assetClass]}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-xs" style={{ color: "rgba(234,234,234,0.55)" }}>{m.exchange}</td>
                  <td className="px-5 py-4">
                    <span
                      className="text-xs font-semibold"
                      style={{ color: isLive ? "#22c55e" : "rgba(234,234,234,0.4)" }}
                    >
                      {m.status}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div
        className="rounded-2xl p-6 mt-10 text-xs"
        style={{ background: "rgba(124,92,255,0.04)", border: "1px solid rgba(124,92,255,0.2)", color: "rgba(234,234,234,0.7)" }}
      >
        <div className="font-semibold mb-2" style={{ color: "#7c5cff" }}>What&rsquo;s coming</div>
        Conviction-Score leaderboard and per-market provider stats land alongside the
        EpochScoring settlement pipeline (Q3 2026). Track progress in{" "}
        <Link href="/state-of-protocol" className="underline" style={{ color: "#7c5cff" }}>State of Protocol</Link>.
        To try the live BTC/ETH/SOL/XRP vaults today, start at{" "}
        <Link href="/faucet" className="underline" style={{ color: "#7c5cff" }}>/faucet</Link>.
      </div>
    </div>
  );
}
