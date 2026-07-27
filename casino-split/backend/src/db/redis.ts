/**
 * Client Redis partagé : cache des sessions de seeds actives et backend
 * du rate limiting (@fastify/rate-limit).
 */
import Redis from "ioredis";

const REDIS_URL = process.env.REDIS_URL ?? "redis://localhost:6379";

export const redis = new Redis(REDIS_URL, {
  maxRetriesPerRequest: null,
  lazyConnect: false,
});

/** Clé de cache Redis pour la session de seed active d'un joueur. */
export function activeSeedSessionCacheKey(userId: string): string {
  return `split:seed-session:active:${userId}`;
}

const ACTIVE_SESSION_TTL_SECONDS = 60 * 60 * 24; // 24h, réaligné à chaque écriture

export async function cacheActiveSeedSessionId(userId: string, sessionId: string): Promise<void> {
  await redis.set(activeSeedSessionCacheKey(userId), sessionId, "EX", ACTIVE_SESSION_TTL_SECONDS);
}

export async function getCachedActiveSeedSessionId(userId: string): Promise<string | null> {
  return redis.get(activeSeedSessionCacheKey(userId));
}

export async function clearCachedActiveSeedSessionId(userId: string): Promise<void> {
  await redis.del(activeSeedSessionCacheKey(userId));
}
