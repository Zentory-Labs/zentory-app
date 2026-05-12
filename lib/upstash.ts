import { Redis } from '@upstash/redis';

// Redis client — gracefully handles missing env vars during builds/development
let _redis: Redis | null = null;
try {
  _redis = Redis.fromEnv();
} catch (e) {
  console.warn('[upstash] Redis.fromEnv() failed (env vars may not be set):', e);
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
