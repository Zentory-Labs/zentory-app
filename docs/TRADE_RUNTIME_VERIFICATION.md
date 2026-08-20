# `/trade` Runtime Verification Plan

> **Status:** `lib/hyperliquid-exchange.ts:5` is marked **NOT YET RUNTIME-VERIFIED**.
> This document is the pre-flight checklist + step-by-step test script that must be
> executed end-to-end against Hyperliquid **TESTNET** before flipping the dApp's
> `/trade` page on for real users (i.e. before un-gating `HL_LIVE_ORDERS` in production).

---

## 1. Scope

The write path being verified is the `@nktkas/hyperliquid` `ExchangeClient.placeOrder`
call exposed by `lib/hyperliquid-exchange.ts` → `placeOrder()`, wired into the
`/trade` page with the Zentory builder code (`builder: { b: HL_BUILDER, f: HL_BUILDER_FEE }`)
attached so every fill earns a builder fee.

The verification proves:

1. The SDK actually signs and submits a limit order on testnet (tsc-clean ≠ runtime-clean).
2. The order is queryable through `info.openOrders`.
3. The order can be cancelled.
4. Cancellation actually removes the order from `info.openOrders`.

It does **not** verify fills, builder fee accrual, or mainnet — those are follow-on
phases gated on this step passing.

---

## 2. Pre-flight checks (must be true before running the script)

These mirror the warning block at the top of `lib/hyperliquid-exchange.ts:5-14`.

### 2.1 Builder wallet is funded on Hyperliquid testnet

```bash
# 1. Visit the HL testnet faucet for the BUILDER wallet:
#    https://app.hyperliquid-testnet.xyz/drip
#    (requires a wallet with ≥ 0.001 ETH-equivalent on Arbitrum/Base for the faucet gas)
#
# 2. Verify the builder wallet holds ≥ 100 USDC on Hyperliquid testnet:
NEXT_PUBLIC_HL_BUILDER_ADDRESS=0xYourBuilder...
node -e "
  const r = await fetch('https://api.hyperliquid-testnet.xyz/info', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ type: 'clearinghouseState', user: process.env.NEXT_PUBLIC_HL_BUILDER_ADDRESS }),
  }).then(r => r.json());
  console.log('builder accountValue (USDC):', r.marginSummary.accountValue);
"
# Expect: a non-zero number (≥ 100 to collect fees).
```

### 2.2 The env flag that flips /trade to live mode is set

```bash
# .env.local (or Vercel project env for the preview/prod deploy)
NEXT_PUBLIC_HL_BUILDER_ADDRESS=0xYourBuilder...
NEXT_PUBLIC_HL_BUILDER_FEE=10                # 1bp; 1bp–10bps is the perps band
NEXT_PUBLIC_HL_API=https://api.hyperliquid-testnet.xyz
```

`HL_LIVE_ORDERS` in `lib/hyperliquid.ts:19` becomes truthy whenever
`NEXT_PUBLIC_HL_BUILDER_ADDRESS` is non-empty — that's the only production gate.

### 2.3 A separate test wallet (≠ the builder) is funded with $50 USDC

The test wallet is what places the order. Don't reuse the builder wallet —
we want the builder-fee trail isolated to the builder's fills.

```bash
# 1. Generate a fresh throwaway keypair for the test run:
TEST_PK=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
TEST_ADDR=$(node -e "console.log('0x' + require('keccak256')('0x' + '$TEST_PK'.padEnd(64,'0').slice(0,64)).slice(-40))")
# (Or import a viem privateKeyToAccount in a small TS script — see scripts/trade-verify.mjs.)

# 2. Fund it on the HL testnet faucet: https://app.hyperliquid-testnet.xyz/drip

# 3. Confirm it has at least $50 USDC of equity before placing:
node -e "
  const r = await fetch('https://api.hyperliquid-testnet.xyz/info', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ type: 'clearinghouseState', user: process.env.TEST_ADDR }),
  }).then(r => r.json());
  console.log('test accountValue (USDC):', r.marginSummary.accountValue);
"
# Expect: >= 50.
```

### 2.4 The builder-fee approve has been signed by the test wallet (one-time per user)

Each user who trades through `/trade` must call `ExchangeClient.approveBuilderFee()`
once. Verify the test wallet is approved:

```bash
node -e "
  const r = await fetch('https://api.hyperliquid-testnet.xyz/info', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      type: 'userFees',
      user: process.env.TEST_ADDR,
    }),
  }).then(r => r.json());
  console.log('userFees:', JSON.stringify(r));
"
# Expect: the builder address appears with a maxFeeRate ≥ the configured HL_BUILDER_FEE.
# If absent, run the approve step in scripts/trade-verify.mjs first.
```

---

## 3. Step-by-step verification script

The script lives at `scripts/trade-verify.mjs` and is the canonical executable form of
this doc. It is **not** part of CI — it requires a funded HL testnet account and
should only be run by an operator with access to the builder wallet. Expected output
snippets are inline below.

### 3.1 What the script does

| # | Action | SDK call | Assertion |
|---|--------|----------|-----------|
| 1 | Fund test wallet with $50 USDC on HL testnet | (manual: HL faucet) | `clearinghouseState.accountValue >= 50` |
| 2 | Place a tiny BTC perp limit order (sz=0.001, ~$60 notional) far from mid so it rests on the book | `ExchangeClient.order({ orders: [{ a, b, p, s, r, t: { limit: { tif: 'Gtc' } } }], grouping: 'na', builder: { b, f } })` | `result.response.data.statuses[0]` is `{ resting: { oid: <number> } }` (not `error`) |
| 3 | Query open orders | `InfoClient.openOrders({ user })` | returned array contains the order just placed (match by `oid`) |
| 4 | Cancel the order | `ExchangeClient.cancel({ cancels: [{ a, o: oid }] })` | `result.response.data.statuses[0]` is `'success'` (string) |
| 5 | Re-query open orders | `InfoClient.openOrders({ user })` | returned array **does not** contain the cancelled oid |

If any step fails the script exits non-zero with a clear error message.

### 3.2 Run

```bash
# From the repo root, with .env.local containing:
#   NEXT_PUBLIC_HL_BUILDER_ADDRESS=0x...
#   NEXT_PUBLIC_HL_BUILDER_FEE=10
#   TEST_PRIVATE_KEY=0x...                  # the funded test wallet from §2.3
node scripts/trade-verify.mjs
```

### 3.3 Expected output (happy path)

```text
[1/5] Pre-flight: builder + test wallet balances…
  builder 0xAbC…fE1  accountValue = 123.45 USDC  ✓
  test    0x123…456  accountValue =  50.00 USDC  ✓
[2/5] Place BTC perp: sz=0.001 limit @ $59,900 (GTC)…
  result.statuses[0] = { resting: { oid: 9876543210 } }  ✓
[3/5] Query info.openOrders for 0x123…456…
  openOrders = [
    { coin: 'BTC', side: 'B', limitPx: '59900.0', sz: '0.001', oid: 9876543210, ... }
  ]
  contains oid 9876543210  ✓
[4/5] Cancel oid 9876543210…
  result.statuses[0] = 'success'  ✓
[5/5] Re-query info.openOrders for 0x123…456…
  openOrders = []
  does NOT contain oid 9876543210  ✓

All 5 steps passed. /trade write path is runtime-verified against HL testnet.
```

### 3.4 Expected output (failure modes to watch for)

```text
# Builder fee not approved by the test wallet:
[2/5] Place BTC perp: sz=0.001 limit @ $59,900 (GTC)…
  result.statuses[0] = { error: 'Builder fee not approved' }
  ✗ FAIL at step 2 — re-run §2.4 (approveBuilderFee) for the test wallet.

# Price rejected (5 sig-fig / szDecimals rule):
[2/5] Place BTC perp: sz=0.001 limit @ $59900.123 (GTC)…
  result.statuses[0] = { error: 'Invalid price' }
  ✗ FAIL at step 2 — re-read formatPrice() in lib/hyperliquid-exchange.ts:60.

# Cancel of an already-filled or already-cancelled oid:
[4/5] Cancel oid 9876543210…
  result.statuses[0] = { error: 'Order could not be cancelled' }
  ✗ FAIL at step 4 — order was filled/cancelled between steps 2 and 4. Re-run.
```

---

## 4. After a clean run

- Mark the warning block in `lib/hyperliquid-exchange.ts:5` to **`RUNTIME-VERIFIED 2026-MM-DD`**.
- Open the follow-on tasks:
  1. **Fill + builder fee accrual**: place a marketable order, assert the fill
     appears in `info.userFills` and the builder's `userFees.aggregated` grew.
  2. **Mainnet cutover**: flip `NEXT_PUBLIC_HL_API` to `https://api.hyperliquid.xyz`
     and `NEXT_PUBLIC_HL_BUILDER_ADDRESS` to the production builder, then re-run
     this script against the production builder (not a fresh test wallet).
- Tag the release / merge the gate (`HL_LIVE_ORDERS` becomes truthy for end users).

---

## 5. References

- `lib/hyperliquid-exchange.ts` — `placeOrder()`, `approveBuilderFee()`
- `lib/hyperliquid.ts` — `HL_BUILDER`, `HL_BUILDER_FEE`, `HL_LIVE_ORDERS`
- `@nktkas/hyperliquid` API docs — https://github.com/nktkas/hyperliquid
- Hyperliquid testnet faucet — https://app.hyperliquid-testnet.xyz/drip
- Hyperliquid API reference — https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api