// Friendly error mapper for /trade.
//
// Surfaces user-actionable copy from arbitrary errors thrown by the wallet, the
// Hyperliquid SDK, or our own placeOrder() / approveBuilderFee() wrappers. The
// raw error still goes to the console (see callers) for debugging — the UI never
// shows URLs, RPC node names, JSON-RPC codes, or stack traces to end users.
//
// Patterns are matched against the stringified error (toLowerCase). Order
// matters: the first match wins, so put the more specific patterns before
// generic fallbacks.

const PATTERNS: Array<[RegExp, string]> = [
  // Wallet / signing
  [/user rejected|user denied|user cancelled|rejected the request/i,
    "You declined the request in your wallet."],
  [/chain mismatch|wrong chain|unsupported chain|chain id/i,
    "Your wallet is on the wrong network — switch to HyperEVM Testnet (chain 998) and try again."],
  [/insufficient funds|insufficient balance|not enough (?:usdc|margin|balance)/i,
    "Your Hyperliquid account doesn't have enough USDC to cover this order."],
  // Hyperliquid-specific
  [/builder fee not approved/i,
    "Approve the Zentory builder fee first (one-time, in the panel above)."],
  [/invalid price|price must be|invalid order/i,
    "Hyperliquid rejected the price or size — try again with a different value."],
  [/rate limit|too many requests|429/i,
    "Hyperliquid is rate-limiting us. Pause a few seconds and retry."],
  [/order could not be cancelled|already (?:filled|cancelled)/i,
    "This order was already filled or cancelled."],
  // Network
  [/network|fetch failed|failed to fetch|timeout|econnrefused|etimedout|aborted/i,
    "Couldn't reach Hyperliquid. Check your connection and try again in a moment."],
  // Builder not configured (defensive — should be unreachable while HL_LIVE_ORDERS is true)
  [/builder not configured/i,
    "Live routing isn't configured yet. The Zentory team needs to set NEXT_PUBLIC_HL_BUILDER_ADDRESS."],
];

/**
 * Map an unknown error to a one-line user-friendly message suitable for display
 * in the /trade status panel. Falls back to a generic copy if nothing matches.
 */
export function friendlyTradeError(e: unknown): string {
  const raw = (e instanceof Error ? e.message : String(e ?? "")).toString();
  if (!raw) return "Something went wrong. Please try again.";

  for (const [pattern, message] of PATTERNS) {
    if (pattern.test(raw)) return message;
  }
  return "Something went wrong placing that order. Please try again.";
}
