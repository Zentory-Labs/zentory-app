import { redis } from "./upstash";

/**
 * Persistent fixed-window rate limiter.
 *
 * Backed by Upstash Redis when configured (counters survive serverless cold
 * starts AND are shared across warm instances), with a per-instance in-memory
 * fallback when Redis is absent (local dev / build) or on a transient Redis
 * error — so a Redis hiccup degrades gracefully instead of failing the request.
 *
 * Closes audit DAPP-1 / DAPP-2: the previous in-memory `Map` limiters reset on
 * every cold start and were per-instance, so an attacker could exceed the limit
 * by forcing cold starts or fanning across instances.
 *
 * @param key       Logical bucket (e.g. `rpc:<ip>` or `research-exec:global`).
 * @param limit     Max requests allowed within the window.
 * @param windowSec Window length in seconds.
 */
type Window = { windowStart: number; count: number };
const _mem = new Map<string, Window>();

// Circuit breaker: an unreachable/misconfigured Redis (bad URL, DNS failure,
// egress block) costs a full fetch timeout PER REQUEST before the fallback
// kicks in — on the hot /api/rpc path that reads as a hung dApp. After 3
// consecutive failures, skip Redis for 60s, then probe again.
let _redisFailures = 0;
let _redisSkipUntil = 0;

export async function rateLimit(
  key: string,
  limit: number,
  windowSec: number,
): Promise<{ ok: boolean; remaining: number }> {
  if (redis && Date.now() >= _redisSkipUntil) {
    try {
      const rkey = `rl:${key}`;
      const count = await redis.incr(rkey);
      // Set the TTL only on the first hit of a new window.
      if (count === 1) await redis.expire(rkey, windowSec);
      _redisFailures = 0;
      return { ok: count <= limit, remaining: Math.max(0, limit - count) };
    } catch (e) {
      // Redis unavailable mid-request: fall back to in-memory rather than 500.
      _redisFailures += 1;
      if (_redisFailures >= 3) {
        _redisSkipUntil = Date.now() + 60_000;
        _redisFailures = 0;
        console.warn("[rateLimit] redis failing repeatedly; skipping it for 60s:", e);
      } else {
        console.warn("[rateLimit] redis error; using in-memory fallback:", e);
      }
    }
  }

  const now = Date.now();
  const windowMs = windowSec * 1000;
  const entry = _mem.get(key);
  if (!entry || now - entry.windowStart > windowMs) {
    _mem.set(key, { windowStart: now, count: 1 });
    return { ok: true, remaining: limit - 1 };
  }
  entry.count += 1;
  return { ok: entry.count <= limit, remaining: Math.max(0, limit - entry.count) };
}

/** Best-effort client IP from forwarding headers (Vercel sets x-forwarded-for). */
export function clientIp(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown"
  );
}
