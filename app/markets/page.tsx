"use client";

import Link from "next/link";

type AssetClass = "CRYPTO_SPOT" | "CRYPTO_PERP" | "EQUITY" | "FOREX" | "COMMODITY";

// Spot markets the four deployed ERC-4626 vaults actually trade today on
// HyperEVM 998 (long/flat vs USDC, no leverage). Each row links to its vault.
interface VaultMarket {
  symbol: string;
  name: string;
  vaultKey: "zBTC" | "zETH" | "zSOL" | "zXRP";
}

const VAULT_MARKETS: VaultMarket[] = [
  { symbol: "BTC/USDC", name: "Bitcoin (spot)", vaultKey: "zBTC" },
  { symbol: "ETH/USDC", name: "Ethereum (spot)", vaultKey: "zETH" },
  { symbol: "SOL/USDC", name: "Solana (spot)", vaultKey: "zSOL" },
  { symbol: "XRP/USDC", name: "XRP (spot)", vaultKey: "zXRP" },
];

// Markets third-party researchers will be able to SIGNAL on once SignalRegistry
// opens. Signals never change what depositor vaults hold — vaults stay spot,
// long/flat. No perp/leveraged exposure is ever added to vaults.
interface PlannedSignalMarket {
  symbol: string;
  name: string;
  assetClass: AssetClass;
  exchange: string;
}

const PLANNED_SIGNAL_MARKETS: PlannedSignalMarket[] = [
  { symbol: "BTC-PERP", name: "Bitcoin Perpetual", assetClass: "CRYPTO_PERP", exchange: "Hyperliquid" },
  { symbol: "ETH-PERP", name: "Ethereum Perpetual", assetClass: "CRYPTO_PERP", exchange: "Hyperliquid" },
  { symbol: "SOL-PERP", name: "Solana Perpetual", assetClass: "CRYPTO_PERP", exchange: "Hyperliquid" },
  { symbol: "XRP-PERP", name: "XRP Perpetual", assetClass: "CRYPTO_PERP", exchange: "Hyperliquid" },
  { symbol: "HYPE-PERP", name: "HYPE Perpetual", assetClass: "CRYPTO_PERP", exchange: "Hyperliquid" },
  { symbol: "AAPL", name: "Apple Inc.", assetClass: "EQUITY", exchange: "Ondo / Synthetix" },
  { symbol: "MSFT", name: "Microsoft Corp.", assetClass: "EQUITY", exchange: "Ondo / Synthetix" },
  { symbol: "EUR/USD", name: "Euro / US Dollar", assetClass: "FOREX", exchange: "Chainlink" },
  { symbol: "GBP/USD", name: "British Pound / USD", assetClass: "FOREX", exchange: "Chainlink" },
  { symbol: "XAU/USD", name: "Gold / US Dollar", assetClass: "COMMODITY", exchange: "Chainlink" },
];

const ASSET_CLASS_COLORS: Record<AssetClass, string> = {
  CRYPTO_SPOT: "#34d399",
  CRYPTO_PERP: "#B08D57",
  EQUITY: "#627EEA",
  FOREX: "#14F195",
  COMMODITY: "#F7931A",
};

const ASSET_CLASS_LABELS: Record<AssetClass, string> = {
  CRYPTO_SPOT: "Crypto Spot",
  CRYPTO_PERP: "Crypto Perp",
  EQUITY: "Equity",
  FOREX: "Forex",
  COMMODITY: "Commodity",
};

function SectionHeading({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-xl font-bold mb-1" style={{ color: "#eaeaea" }}>{title}</h2>
      <p className="text-xs max-w-2xl" style={{ color: "rgba(234,234,234,0.5)" }}>{sub}</p>
    </div>
  );
}

export default function MarketsPage() {
  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-10">
        <div
          className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold mb-3"
          style={{ background: "rgba(176,141,87,0.12)", borderColor: "rgba(176,141,87,0.3)", color: "#b08d57" }}
        >
          <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "#34d399", boxShadow: "0 0 8px #34d399" }} />
          Testnet · HyperEVM 998
        </div>
        <h1 className="text-3xl md:text-4xl font-bold mb-3" style={{ color: "#eaeaea" }}>
          Markets
        </h1>
        <p className="text-sm max-w-2xl" style={{ color: "rgba(106,111,117,0.9)" }}>
          What the vaults trade today, and the markets researchers will be able to signal on later.
          Depositor vaults hold spot only — long or flat, never leveraged.
        </p>
      </div>

      {/* ── Vault markets — live (testnet) ── */}
      <SectionHeading
        title="Vault markets — live (testnet)"
        sub="The spot markets the four deployed vaults actually trade: asset vs USDC, long/flat, no leverage. Click a row to open its vault."
      />
      <div className="rounded-2xl overflow-hidden mb-12" style={{ background: "#1c1c21", border: "1px solid #2a2f3a" }}>
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
            {VAULT_MARKETS.map((m) => (
              <tr key={m.symbol} style={{ borderBottom: "1px solid rgba(42,47,58,0.5)" }}>
                <td className="px-5 py-4">
                  <Link href={`/vaults/${m.vaultKey}`} className="group">
                    <div className="font-semibold text-sm group-hover:underline" style={{ color: "#eaeaea" }}>{m.symbol}</div>
                    <div className="text-xs" style={{ color: "rgba(234,234,234,0.45)" }}>{m.name} · {m.vaultKey} vault →</div>
                  </Link>
                </td>
                <td className="px-5 py-4">
                  <span
                    className="px-2 py-0.5 rounded-full text-xs font-semibold border"
                    style={{
                      background: ASSET_CLASS_COLORS.CRYPTO_SPOT + "18",
                      borderColor: ASSET_CLASS_COLORS.CRYPTO_SPOT + "40",
                      color: ASSET_CLASS_COLORS.CRYPTO_SPOT,
                    }}
                  >
                    {ASSET_CLASS_LABELS.CRYPTO_SPOT}
                  </span>
                </td>
                <td className="px-5 py-4 text-xs" style={{ color: "rgba(234,234,234,0.55)" }}>
                  ZENTORY SpotVault · HyperEVM testnet
                </td>
                <td className="px-5 py-4">
                  <span className="text-xs font-semibold" style={{ color: "#34d399" }}>
                    Live (testnet)
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Planned signal markets ── */}
      <SectionHeading
        title="Planned signal markets"
        sub="Depositor vaults hold spot only, long/flat. These planned rows are markets third-party researchers will be able to signal on via SignalRegistry — signals inform research scoring, they never add leverage to vaults."
      />
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
            {PLANNED_SIGNAL_MARKETS.map((m) => {
              const color = ASSET_CLASS_COLORS[m.assetClass];
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
                    <span className="text-xs font-semibold" style={{ color: "rgba(234,234,234,0.4)" }}>
                      Planned
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
        style={{ background: "rgba(194,53,63,0.04)", border: "1px solid rgba(194,53,63,0.2)", color: "rgba(234,234,234,0.7)" }}
      >
        <div className="font-semibold mb-2" style={{ color: "#c2353f" }}>What&rsquo;s coming</div>
        Conviction-Score leaderboard and per-market provider stats land alongside the
        EpochScoring settlement pipeline (Q3 2026). Track progress in{" "}
        <Link href="/state-of-protocol" className="underline" style={{ color: "#c2353f" }}>State of Protocol</Link>.
        To try the live BTC/ETH/SOL/XRP vaults today, start at{" "}
        <Link href="/faucet" className="underline" style={{ color: "#c2353f" }}>/faucet</Link>.
      </div>
    </div>
  );
}
