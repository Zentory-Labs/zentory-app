// Hyperliquid WRITE path — signed orders with the Zentory builder code attached,
// so every fill we route earns a builder fee while Hyperliquid provides the
// orderbook + liquidity. Non-custodial: the user signs; we never hold funds.
//
// ⚠️ NOT YET RUNTIME-VERIFIED. This is wired against the @nktkas/hyperliquid v-current
// type definitions (tsc-clean) but has not been executed against a funded account.
// Before enabling for real users:
//   1. Set NEXT_PUBLIC_HL_BUILDER_ADDRESS to a Hyperliquid wallet holding >=100 USDC.
//   2. Each user does a one-time approveBuilderFee() (the "Approve" button in /trade).
//   3. Test end-to-end on Hyperliquid TESTNET (NEXT_PUBLIC_HL_API=https://api.hyperliquid-testnet.xyz)
//      with a small order, confirm the fill + the builder fee accrues, THEN go to mainnet.
//   Known nuance: HL L1 actions sign over chainId 1337; some browser wallets reject this.
//   If so, add the "agent wallet" (approveAgent) pattern — a one-time-approved local key
//   that signs orders without popups (how the official HL app + most builders do it).

import type { WalletClient } from "viem";
import { ExchangeClient, HttpTransport } from "@nktkas/hyperliquid";
import type { AbstractWallet } from "@nktkas/hyperliquid/signing";
import { HL_BUILDER, HL_BUILDER_FEE, getUniverse } from "./hyperliquid";

const IS_TESTNET = (process.env.NEXT_PUBLIC_HL_API ?? "").includes("testnet");

function exchange(wallet: WalletClient) {
  // A wagmi viem WalletClient implements signTypedData / getAddresses / getChainId,
  // which IS the SDK's AbstractViemJsonRpcAccount. viem's broader signTypedData typing
  // is why this needs a cast at the boundary (runtime-compatible).
  return new ExchangeClient({
    transport: new HttpTransport({ isTestnet: IS_TESTNET }),
    wallet: wallet as unknown as AbstractWallet,
  });
}

/** One-time per user: authorize Zentory's max builder fee so orders can carry the code. */
export async function approveBuilderFee(walletClient: WalletClient) {
  if (!HL_BUILDER) throw new Error("Builder not configured (set NEXT_PUBLIC_HL_BUILDER_ADDRESS).");
  // HL_BUILDER_FEE is in tenths of a bp (10 = 1bp = 0.0100%). maxFeeRate is a percent string.
  const maxFeeRate = `${(HL_BUILDER_FEE / 1000).toFixed(4)}%`;
  return exchange(walletClient).approveBuilderFee({ builder: HL_BUILDER as `0x${string}`, maxFeeRate });
}

export type PlaceOrderArgs = {
  walletClient: WalletClient;
  coin: string;
  isBuy: boolean;
  sz: string;       // size in base units
  price: string;    // limit price, or an aggressive marketable price for market orders
  isMarket: boolean;
};

const roundTo = (n: number, decimals: number) => Number(n.toFixed(Math.max(0, decimals)));

/** HL size rule: round to the market's szDecimals (excess decimals are rejected). */
function formatSize(sz: string, szDecimals: number): string {
  return roundTo(Number(sz), szDecimals).toString();
}

/** HL perp price rule: <=5 significant figures AND <= (6 - szDecimals) decimal
 * places (integers always allowed). Mis-formatted prices are the #1 cause of
 * "invalid price" rejections, so normalize before sending. */
function formatPrice(px: string, szDecimals: number): string {
  const fiveSig = Number(Number(px).toPrecision(5));
  return roundTo(fiveSig, 6 - szDecimals).toString();
}

/** Place a perp order with the Zentory builder code attached. */
export async function placeOrder({ walletClient, coin, isBuy, sz, price, isMarket }: PlaceOrderArgs) {
  const universe = await getUniverse();
  const a = universe.findIndex((u) => u.name === coin); // perp asset id = full-universe index
  if (a < 0) throw new Error(`Unknown market: ${coin}`);
  const { szDecimals } = universe[a];

  const result = await exchange(walletClient).order({
    orders: [{
      a,
      b: isBuy,
      p: formatPrice(price, szDecimals),
      s: formatSize(sz, szDecimals),
      r: false,
      t: { limit: { tif: isMarket ? "FrontendMarket" : "Gtc" } },
    }],
    grouping: "na",
    ...(HL_BUILDER ? { builder: { b: HL_BUILDER as `0x${string}`, f: HL_BUILDER_FEE } } : {}),
  });

  // HL responds HTTP 200 even when an order is rejected — the failure is inside the
  // per-order status. Surface it instead of reporting a false success.
  const statuses = result?.response?.data?.statuses ?? [];
  for (const s of statuses) {
    if (s && typeof s === "object" && "error" in s && s.error) {
      throw new Error(String((s as { error: string }).error));
    }
  }
  return result;
}
