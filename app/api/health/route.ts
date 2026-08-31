import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { getRedisClient } from '@/lib/cache/redis-client';

export const dynamic = 'force-dynamic';

export async function GET() {
  const checks = { database: false, redis: false };
  try { checks.database = !(await createAdminClient().from('tickets').select('id').limit(1)).error; } catch {}
  try { const redis = getRedisClient(); checks.redis = redis ? (await redis.ping()) === 'PONG' : false; } catch {}
  const healthy = checks.database;
  return NextResponse.json({ status: healthy ? 'ok' : 'degraded', checks, timestamp: new Date().toISOString() }, { status: healthy ? 200 : 503 });
}
