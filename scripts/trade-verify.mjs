// /trade Runtime Verification — HL TESTNET.
//
// See docs/TRADE_RUNTIME_VERIFICATION.md for the full plan + expected output.
//
// What this script proves:
//   1. The test wallet has >= $50 USDC on Hyperliquid testnet.
//   2. ExchangeClient.placeOrder can submit a tiny BTC perp limit (sz=0.001).
//   3. InfoClient.openOrders reports the order back to us.
//   4. ExchangeClient.cancel removes that exact order.
//   5. InfoClient.openOrders no longer contains the cancelled oid.
//
// Run:
//   NEXT_PUBLIC_HL_BUILDER_ADDRESS=0x... \
//   NEXT_PUBLIC_HL_BUILDER_FEE=10 \
//   TEST_PRIVATE_KEY=0x... \
//   node scripts/trade-verify.mjs
//
// This script is NOT part of CI. It costs a few cents of testnet gas at most and
// requires a funded builder + test wallet on HL testnet. Operator-only.
//
// @ts-check — typed via JSDoc so editing in TS-aware tooling is friction-free.

import { ExchangeClient, HttpTransport, InfoClient } from "@nktkas/hyperliquid";
import { privateKeyToAccount } from "viem/accounts";

/** @type {string | undefined} */
const BUILDER = process.env.NEXT_PUBLIC_HL_BUILDER_ADDRESS;
const FEE = Number(process.env.NEXT_PUBLIC_HL_BUILDER_FEE ?? 10);
const IS_TESTNET = (process.env.NEXT_PUBLIC_HL_API ?? "").includes("testnet");
/** @type {string | undefined} */
const TEST_PK = process.env.TEST_PRIVATE_KEY;

if (!BUILDER) {
  console.error("NEXT_PUBLIC_HL_BUILDER_ADDRESS is not set. Aborting.");
  process.exit(1);
}
if (!TEST_PK) {
  console.error("TEST_PRIVATE_KEY is not set. Aborting.");
  process.exit(1);
}
if (!IS_TESTNET) {
  console.error(
    "Refusing to run against mainnet — set NEXT_PUBLIC_HL_API to the testnet URL.",
  );
  process.exit(1);
}

const transport = new HttpTransport({ isTestnet: true });
const info = new InfoClient({ transport });
const testAccount = privateKeyToAccount(
  /** @type {`0x${string}`} */ (
    TEST_PK.startsWith("0x") ? TEST_PK : `0x${TEST_PK}`
  ),
);
const exchange = new ExchangeClient({
  transport,
  wallet: testAccount,
});

async function main() {
  // ─── 1/5 Pre-flight balances ──────────────────────────────────────────────
  const builderState = await info.clearinghouseState({ user: BUILDER });
  const testState = await info.clearinghouseState({ user: testAccount.address });
  const builderOk =
    Number(builderState.marginSummary.accountValue) >= 100;
  const testOk = Number(testState.marginSummary.accountValue) >= 50;
  console.log("[1/5] Pre-flight: builder + test wallet balances…");
  console.log(
    `  builder ${BUILDER}  accountValue = ${builderState.marginSummary.accountValue} USDC  ${builderOk ? "✓" : "✗"}`,
  );
  console.log(
    `  test    ${testAccount.address}  accountValue = ${testState.marginSummary.accountValue} USDC  ${testOk ? "✓" : "✗"}`,
  );
  if (!builderOk || !testOk) {
    console.error(
      "Pre-flight failed — fund the wallets on https://app.hyperliquid-testnet.xyz/drip and retry.",
    );
    process.exit(1);
  }

  // ─── 2/5 Place BTC perp limit (sz=0.001, far-from-mid so it rests) ──────
  const mids = await info.allMids();
  const mid = Number(mids["BTC"]);
  if (!Number.isFinite(mid)) {
    console.error("Could not fetch BTC mid price. Aborting.");
    process.exit(1);
  }
  // ~5% below mid for buy, ~5% above for sell — far enough to rest without filling.
  const limitPx = (mid * 0.95).toFixed(2);
  const universe = (await info.meta()).universe;
  const a = universe.findIndex((u) => u.name === "BTC");
  if (a < 0) {
    console.error("BTC not in universe. Aborting.");
    process.exit(1);
  }
  const { szDecimals } = universe[a];
  const sz = (0.001).toFixed(szDecimals);

  console.log(
    `[2/5] Place BTC perp: sz=${sz} limit @ $${limitPx} (GTC)…`,
  );
  const placed = await exchange.order({
    orders: [
      {
        a,
        b: true, // buy
        p: limitPx,
        s: sz,
        r: false,
        t: { limit: { tif: "Gtc" } },
      },
    ],
    grouping: "na",
    builder: { b: /** @type {`0x${string}`} */ (BUILDER), f: FEE },
  });
  const placedStatus = placed?.response?.data?.statuses?.[0];
  const placedOk =
    placedStatus &&
    typeof placedStatus === "object" &&
    "resting" in placedStatus &&
    placedStatus.resting &&
    typeof placedStatus.resting.oid === "number";
  console.log(`  result.statuses[0] = ${JSON.stringify(placedStatus)}  ${placedOk ? "✓" : "✗"}`);
  if (!placedOk) {
    console.error("Step 2 failed — see lib/hyperliquid-exchange.ts:60 (formatPrice).");
    process.exit(1);
  }
  const oid = /** @type {{ resting: { oid: number } }} */ (placedStatus).resting.oid;

  // ─── 3/5 Query info.openOrders, assert oid present ───────────────────────
  const open1 = await info.openOrders({ user: testAccount.address });
  const inOpen1 = open1.some((o) => o.oid === oid);
  console.log(
    `[3/5] Query info.openOrders for ${testAccount.address}…`,
  );
  console.log(
    `  openOrders = ${JSON.stringify(open1, null, 2).split("\n").slice(0, 8).join("\n  ")}…`,
  );
  console.log(`  contains oid ${oid}  ${inOpen1 ? "✓" : "✗"}`);
  if (!inOpen1) {
    console.error("Step 3 failed — order not in openOrders. Retry or check fills.");
    process.exit(1);
  }

  // ─── 4/5 Cancel oid ──────────────────────────────────────────────────────
  const cancelled = await exchange.cancel({ cancels: [{ a, o: oid }] });
  const cancelStatus = cancelled?.response?.data?.statuses?.[0];
  const cancelOk = cancelStatus === "success";
  console.log(`[4/5] Cancel oid ${oid}…`);
  console.log(`  result.statuses[0] = ${JSON.stringify(cancelStatus)}  ${cancelOk ? "✓" : "✗"}`);
  if (!cancelOk) {
    console.error(
      "Step 4 failed — order may have filled/cancelled between steps. Re-run.",
    );
    process.exit(1);
  }

  // ─── 5/5 Re-query openOrders, assert oid absent ──────────────────────────
  const open2 = await info.openOrders({ user: testAccount.address });
  const inOpen2 = open2.some((o) => o.oid === oid);
  console.log(
    `[5/5] Re-query info.openOrders for ${testAccount.address}…`,
  );
  console.log(`  openOrders = ${JSON.stringify(open2)}`);
  console.log(`  does NOT contain oid ${oid}  ${!inOpen2 ? "✓" : "✗"}`);
  if (inOpen2) {
    console.error("Step 5 failed — cancellation did not remove the order.");
    process.exit(1);
  }

  console.log(
    "\nAll 5 steps passed. /trade write path is runtime-verified against HL testnet.",
  );
}

main().catch((e) => {
  console.error("Unexpected error:", e);
  process.exit(1);
});