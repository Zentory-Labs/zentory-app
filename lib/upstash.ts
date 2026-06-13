import { Redis } from '@upstash/redis';

// Redis client — gracefully handles missing env vars during builds/development.
//
// IMPORTANT: only construct the client when the env vars look like REAL Upstash
// credentials. If the URL is missing, not https, or still a placeholder (the
// .env.example ships `https://your-redis.upstash.io`), `Redis.fromEnv()` will
// happily build a client pointed at an unreachable host — and then EVERY call
// (rate-limit checks on /api/rpc, /api/leaderboard, etc.) pays a full fetch
// timeout (~5s) before the in-memory fallback kicks in. On serverless that
// timeout is paid again on every cold invocation, which is exactly what made
// /api/rpc ~5s and /api/leaderboard ~10s in production. Treating placeholder
// creds as "no Redis" makes those paths fall straight through to the in-memory
// limiter with zero network latency.
const _url = process.env.UPSTASH_REDIS_REST_URL?.trim();
const _token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
const _credsLookReal =
  !!_url &&
  !!_token &&
  _url.startsWith('https://') &&
  !_url.includes('your-redis') &&
  !/your[_-]?token|changeme|xxx|placeholder/i.test(_token);

let _redis: Redis | null = null;
if (_credsLookReal) {
  try {
    _redis = new Redis({ url: _url!, token: _token! });
  } catch (e) {
    console.warn('[upstash] Redis init failed; using in-memory fallback:', e);
  }
} else if (_url || _token) {
  // Partial/placeholder creds present — warn once so a real misconfig is visible,
  // but do NOT construct a client that would time out on every call.
  console.warn('[upstash] UPSTASH_REDIS_REST_URL/TOKEN look like placeholders or are incomplete; skipping Redis (in-memory fallback).');
}
export const redis = _redis;

// Cache key prefixes
export const CACHE_KEYS = {
  leaderboard: 'leaderboard:v1',
  leaderboardProvider: (provider: string) => `leaderboard:provider:${provider}`,
  research: (assetClass?: string) => `research:${assetClass ?? 'all'}`,
  marketsSignals: 'markets:signals:v1',
  epoch: (epochId: number) => `epoch:${epochId}`,
  vaultStats: 'vault:stats:v1',
  userPositions: (userId: string) => `user:${userId}:positions`,
} as const;

// Default TTLs in seconds
export const TTL = {
  leaderboard: 60,        // 1 minute — changes only on epoch settlement
  marketsSignals: 300,    // 5 minutes
  vaultStats: 60,         // 1 minute
  research: 120,           // 2 minutes
  epoch: 3600,            // 1 hour — immutable once epoch closes
} as const;
