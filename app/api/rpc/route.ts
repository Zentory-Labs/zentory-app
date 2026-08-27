import { rateLimit } from "@/lib/rateLimit";

export const runtime = "nodejs";

type JsonRpcCall = {
  method: string;
  id?: string | number | null;
  params?: unknown;
  jsonrpc?: string;
};

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

// Ordered upstream list for failover (M6). The proxy tries each in turn and
// falls through on network error, 5xx/429, timeout, or a JSON-RPC rate-limit
// (-32005) in the body — so a single flaky/rate-limited endpoint doesn't break
// the dApp. Order: paid/primary endpoint → any RPC_FALLBACK_URLS (comma-sep) →
// the public HyperEVM RPC as last resort. Deduped; empties dropped.
const UPSTREAM_RPC_URLS: string[] = (() => {
  const primary = process.env.HYPEREVM_RPC_URL ?? process.env.NEXT_PUBLIC_HYPEREVM_RPC ?? "";
  const extra = (process.env.RPC_FALLBACK_URLS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const publicRpc = "https://rpc.hyperliquid-testnet.xyz/evm";
  return [...new Set([primary, ...extra, publicRpc].filter(Boolean))];
})();

const UPSTREAM_TIMEOUT_MS = 8_000;

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

// Per-IP rate limit. 120 calls/min/IP is generous for a dApp page and stingy
// for a scraper. Backed by Upstash Redis (persistent across cold starts and
// shared across instances) via lib/rateLimit, with an in-memory fallback when
// Redis isn't configured — closes audit DAPP-1 (cold-start reset bypass).
const RATE_MAX = 120;

function getClientIp(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown"
  );
}

async function checkRateLimit(req: Request): Promise<Response | null> {
  const ip = getClientIp(req);
  const { ok } = await rateLimit(`rpc:${ip}`, RATE_MAX, 60);
  if (ok) return null;
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
  const limited = await checkRateLimit(req);
  if (limited) return limited;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return rpcError(-32700, "Parse error: invalid JSON body");
  }

  // Allow batched calls — same allowlist applied to each.
  const calls: JsonRpcCall[] = Array.isArray(body) ? body : [body as JsonRpcCall];
  for (const call of calls) {
    if (!call || typeof call !== "object" || typeof call.method !== "string") {
      return rpcError(-32600, "Invalid request: missing method", 400, call?.id ?? null);
    }
    const method = call.method;
    if (REJECTED_METHODS.has(method)) {
      return rpcError(-32601, `Method '${method}' not supported via this proxy`, 405, call.id ?? null);
    }
    if (!ALLOWED_METHODS.has(method)) {
      return rpcError(-32601, `Method '${method}' not on allowlist`, 405, call.id ?? null);
    }
  }

  // Failover across upstreams (M6): return the first response that isn't a
  // transport failure or a rate-limit; otherwise fall through to the next.
  const bodyStr = JSON.stringify(body);
  let lastStatus = 502;
  let lastText = JSON.stringify({
    jsonrpc: "2.0",
    error: { code: -32603, message: "All RPC upstreams failed" },
    id: null,
  });

  for (const url of UPSTREAM_RPC_URLS) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), UPSTREAM_TIMEOUT_MS);
    try {
      const upstream = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: bodyStr,
        cache: "no-store",
        signal: ctrl.signal,
      });
      const text = await upstream.text();
      // Fall through on infra errors (5xx) or rate-limit (HTTP 429 or in-body
      // JSON-RPC -32005); anything else is a real answer — forward it verbatim.
      const rateLimited = upstream.status === 429 || text.includes("-32005");
      if (upstream.status >= 500 || rateLimited) {
        lastStatus = upstream.status === 429 ? 429 : 502;
        lastText = text;
        continue;
      }
      return new Response(text, {
        status: upstream.status,
        headers: { "content-type": "application/json", "cache-control": "no-store" },
      });
    } catch {
      // network error / timeout / abort → try the next upstream
      continue;
    } finally {
      clearTimeout(timer);
    }
  }

  return new Response(lastText, {
    status: lastStatus,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}
