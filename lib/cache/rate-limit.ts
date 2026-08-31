import { getRedisClient } from './redis-client';

export async function checkRateLimit(key: string, limit: number, windowSeconds: number) {
  const redis = getRedisClient();
  if (!redis) return { allowed: true, remaining: limit, retryAfter: 0, degraded: true };
  try {
    const redisKey = `rate-limit:${key}`;
    const count = Number(await redis.incr(redisKey));
    if (count === 1) await redis.expire(redisKey, windowSeconds);
    const ttl = Math.max(1, Number(await redis.ttl(redisKey)));
    return { allowed: count <= limit, remaining: Math.max(0, limit - count), retryAfter: ttl, degraded: false };
  } catch {
    return { allowed: true, remaining: limit, retryAfter: 0, degraded: true };
  }
}

export function requestIp(headers: Headers): string {
  return headers.get('x-forwarded-for')?.split(',')[0]?.trim() || headers.get('x-real-ip') || 'unknown';
}
