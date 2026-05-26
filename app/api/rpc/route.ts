export const runtime = "nodejs";

/**
 * Audit D-09 fix. This route is the dApp's transport for read-only JSON-RPC
 * calls to HyperEVM (the wagmi `transport: http("/api/rpc")` wiring in
 * Providers.tsx). Previously it was a free open proxy that accepted any RPC
 * method and forwarded to the upstream — meaning:
 *
 *   1. Any third party could use the production deploy as a free public RPC.
 *   2. On mainnet (with paid Alchemy quotas), this is a direct $-loss vector.
 *   3. Write methods like `eth_sendRawTransaction` could be forwarded —
 *      wagmi itself doesn't use them through this transport (writes go
 *      directly via the wallet provider), but the door was open for them.
 *
 * This route now enforces two protections:
 *
 *   - METHOD ALLOWLIST: only the read-only methods wagmi actually calls.
 *     Anything not on the list returns 405. Write methods explicitly rejected.
 *   - PER-IP RATE LIMIT: simple in-memory sliding-window. 120 req/min/IP.
 *     Cold-start safe (in-memory only, resets per warm container) but enough
 *     to discourage casual abuse. A heavier deployment would move this to
 *     Upstash or KV-backed counters.
 */

const UPSTREAM_RPC_URL =
  process.env.HYPEREVM_RPC_URL ??
  process.env.NEXT_PUBLIC_HYPEREVM_RPC ??
  "https://rpc.hyperliquid-testnet.xyz/evm";

// JSON-RPC methods that wagmi / viem actually invoke for read-only flows.
// Keep this tight. If you find logs of legitimate 405s, expand deliberately.
const ALLOWED_METHODS = new Set<string>([
  "eth_blockNumber",
  "eth_call",
  "eth_chainId",
  "eth_estimateGas",
  "eth_feeHistory",
  "eth_gasPrice",
  "eth_getBalance",
  "eth_getBlockByHash",
  "eth_getBlockByNumber",
  "eth_getCode",
  "eth_getLogs",
  "eth_getStorageAt",
  "eth_getTransactionByHash",
  "eth_getTransactionCount",
  "eth_getTransactionReceipt",
  "eth_maxPriorityFeePerGas",
  "eth_syncing",
  "net_version",
  "web3_clientVersion",
]);

// Methods we explicitly reject even if a caller asks for them. Writes route
// through the wallet provider directly, not through this proxy.
const REJECTED_METHODS = new Set<string>([
  "eth_sendTransaction",
  "eth_sendRawTransaction",
  "eth_sign",
  "personal_sign",
  "eth_signTypedData",
  "eth_signTypedData_v4",
]);

// Sliding-window rate limit. 120 calls/min/IP is generous for a dApp page
// and stingy for a scraper. Map lives only in the warm container — cold
// starts reset it, which is fine for our threat model.
type RateEntry = { windowStart: number; count: number };
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 120;
const _rate = new Map<string, RateEntry>();

function getClientIp(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown"
  );
}

function checkRateLimit(req: Request): Response | null {
  const ip = getClientIp(req);
  const now = Date.now();
  const entry = _rate.get(ip);
  if (!entry || now - entry.windowStart > RATE_WINDOW_MS) {
    _rate.set(ip, { windowStart: now, count: 1 });
    return null;
  }
  entry.count += 1;
  if (entry.count > RATE_MAX) {
    return new Response(
      JSON.stringify({
        jsonrpc: "2.0",
        error: { code: -32005, message: "Rate limit exceeded" },
        id: null,
      }),
      {
        status: 429,
        headers: { "content-type": "application/json", "retry-after": "60" },
      },
    );
  }
  return null;
}

function rpcError(code: number, message: string, status = 400, id: unknown = null): Response {
  return new Response(
    JSON.stringify({ jsonrpc: "2.0", error: { code, message }, id }),
    {
      status,
      headers: { "content-type": "application/json", "cache-control": "no-store" },
    },
  );
}

export async function POST(req: Request) {
  const limited = checkRateLimit(req);
  if (limited) return limited;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return rpcError(-32700, "Parse error: invalid JSON body");
  }

  // Allow batched calls — same allowlist applied to each.
  const calls = Array.isArray(body) ? body : [body];
  for (const call of calls) {
    if (!call || typeof call !== "object" || typeof (call as any).method !== "string") {
      return rpcError(-32600, "Invalid request: missing method", 400, (call as any)?.id ?? null);
    }
    const method = (call as any).method as string;
    if (REJECTED_METHODS.has(method)) {
      return rpcError(-32601, `Method '${method}' not supported via this proxy`, 405, (call as any).id ?? null);
    }
    if (!ALLOWED_METHODS.has(method)) {
      return rpcError(-32601, `Method '${method}' not on allowlist`, 405, (call as any).id ?? null);
    }
  }

  const upstream = await fetch(UPSTREAM_RPC_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  return new Response(await upstream.text(), {
    status: upstream.status,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
    },
  });
}
