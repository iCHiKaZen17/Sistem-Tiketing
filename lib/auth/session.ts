import { AuthenticatedUser } from '@/lib/types/user';
import { getRedisClient } from '@/lib/cache/redis-client';
import { SESSION_TTL_SECONDS, verifiedSessionPayload } from './session-core';

export { SESSION_COOKIE, createSessionToken, sessionCookieOptions } from './session-core';

export async function verifySessionToken(token?: string | null): Promise<AuthenticatedUser | null> {
  try {
    const payload = await verifiedSessionPayload(token);
    if (!payload) return null;
    const redis = getRedisClient();
    if (redis) {
      try {
        if (await redis.get(`session:revoked:${payload.jti}`)) return null;
        const revokedAfter = Number(await redis.get(`user:session-revoked-after:${payload.id}`) || 0);
        if (revokedAfter >= payload.iat) return null;
      } catch { /* PostgreSQL auth remains available during Redis outage. */ }
    }
    return { id: payload.id, username: payload.username, full_name: payload.full_name, role: payload.role };
  } catch {
    return null;
  }
}

export async function revokeSessionToken(token?: string | null): Promise<void> {
  const payload = await verifiedSessionPayload(token);
  const redis = getRedisClient();
  if (!payload || !redis) return;
  const ttl = payload.exp - Math.floor(Date.now() / 1000);
  if (ttl > 0) try { await redis.setex(`session:revoked:${payload.jti}`, ttl, '1'); } catch {}
}

export async function revokeAllUserSessions(userId: string): Promise<void> {
  const redis = getRedisClient();
  if (redis) try {
    await redis.setex(`user:session-revoked-after:${userId}`, SESSION_TTL_SECONDS, String(Date.now()));
  } catch {}
}
