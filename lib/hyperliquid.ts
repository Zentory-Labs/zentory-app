// Hyperliquid read API client + builder-code config for the Zentory Terminal.
//
// READ (this file): public Info endpoint, no auth, no liquidity — powers the live
// market view (orderbook, marks, your positions). Fully working today.
//
// WRITE (orders): signed via @nktkas/hyperliquid with a builder code attached, so
// Zentory earns a fee on every fill while Hyperliquid provides the orderbook. That
// path needs a funded builder account + ApproveBuilderFee and is wired in the page
// behind a gate — see HL_BUILDER below and TERMINAL_BUILD_PLAN.md.

const HL_API = process.env.NEXT_PUBLIC_HL_API ?? "https://api.hyperliquid.xyz";

// Your builder wallet (must hold >=100 USDC on Hyperliquid to collect). Set this
// env to switch the terminal from read-only to live, fee-earning order routing.
export const HL_BUILDER = (process.env.NEXT_PUBLIC_HL_BUILDER_ADDRESS ?? "").trim();
// Builder fee in TENTHS of a basis point. f=10 => 1bp; cap is 100 (=10bps) perps,
// 1000 (=100bps=1%) spot. 10 (=1bp) is a sane, competitive default.
export const HL_BUILDER_FEE = Number(process.env.NEXT_PUBLIC_HL_BUILDER_FEE ?? 10);
export const HL_LIVE_ORDERS = HL_BUILDER.length > 0;

async function info<T>(body: Record<string, unknown>): Promise<T> {
  const r = await fetch(`${HL_API}/info`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!r.ok) throw new Error(`Hyperliquid info ${r.status}`);
  return r.json() as Promise<T>;
}

export type PerpMeta = { name: string; szDecimals: number; maxLeverage: number; isDelisted?: boolean };
export type Level = { px: string; sz: string; n: number };
export type L2Book = { coin: string; time: number; levels: [Level[], Level[]] };
export type AssetPosition = {
  position: {
    coin: string; szi: string; entryPx?: string;
    unrealizedPnl: string; positionValue: string; leverage?: { value: number };
  };
};
export type ClearinghouseState = {
  marginSummary: { accountValue: string };
  withdrawable: string;
  assetPositions: AssetPosition[];
};

/** Full perp universe, in Hyperliquid's order. The array index IS the perp asset
 * id used when placing orders, so this must stay unfiltered. */
export const getUniverse = () =>
  info<{ universe: PerpMeta[] }>({ type: "meta" }).then((d) => d.universe);

/** Tradable perps for the UI (delisted hidden). Do NOT use the index of THIS list
 * as an asset id — use getUniverse() for that. */
export const getPerps = () => getUniverse().then((u) => u.filter((p) => !p.isDelisted));

/** Mid price for every market, keyed by coin name (perps) — e.g. mids["BTC"]. */
export const getAllMids = () => info<Record<string, string>>({ type: "allMids" });

/** Up to 20 levels per side. levels[0] = bids (desc px), levels[1] = asks (asc px). */
export const getL2Book = (coin: string) => info<L2Book>({ type: "l2Book", coin });

/** A wallet's perp positions, account value, and withdrawable balance. */
export const getClearinghouseState = (user: string) =>
  info<ClearinghouseState>({ type: "clearinghouseState", user });

export const fmtUsd = (n: number, d = 2) =>
  n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
