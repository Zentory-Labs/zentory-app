import { redis, CACHE_KEYS, TTL } from './upstash';

type CacheOptions = {
  ttl?: number;
  skipCache?: boolean;
};

export async function cacheGet<T>(key: string): Promise<T | null> {
  if (!redis) return null;
  try {
    const data = await redis.get<T>(key);
    return data;
  } catch (e) {
    console.warn('[cache] get error:', e);
    return null;
  }
}

export async function cacheSet<T>(
  key: string,
  value: T,
  ttl: number
): Promise<void> {
  if (!redis) return;
  try {
    await redis.set(key, JSON.stringify(value), { ex: ttl });
  } catch (e) {
    console.warn('[cache] set error:', e);
  }
}

export async function cacheInvalidate(key: string): Promise<void> {
  if (!redis) return;
  try {
    await redis.del(key);
  } catch (e) {
    console.warn('[cache] invalidate error:', e);
  }
}

// Specific cache helpers
export async function getLeaderboard<T>(): Promise<T | null> {
  return cacheGet<T>(CACHE_KEYS.leaderboard);
}

export async function setLeaderboard<T>(data: T): Promise<void> {
  await cacheSet(CACHE_KEYS.leaderboard, data, TTL.leaderboard);
}

export async function getMarketsSignals<T>(): Promise<T | null> {
  return cacheGet<T>(CACHE_KEYS.marketsSignals);
}

export async function setMarketsSignals<T>(data: T): Promise<void> {
  await cacheSet(CACHE_KEYS.marketsSignals, data, TTL.marketsSignals);
}

export async function invalidateAllLeaderboardCaches(): Promise<void> {
  if (!redis) return;
  try {
    const keys = await redis.keys('leaderboard:*');
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  } catch (e) {
    console.warn('[cache] invalidateAllLeaderboardCaches error:', e);
  }
}
