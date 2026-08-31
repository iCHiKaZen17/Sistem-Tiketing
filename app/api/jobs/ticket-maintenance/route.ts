import { NextRequest, NextResponse } from 'next/server';
import { runTicketMaintenance } from '@/lib/jobs/ticket-maintenance';
import { verifyJobRequest } from '@/lib/jobs/verify-job-request';
import { getRedisClient } from '@/lib/cache/redis-client';

export async function POST(request: NextRequest) {
  if (!await verifyJobRequest(request)) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }
  const redis = getRedisClient();
  const token = crypto.randomUUID();
  let locked = false;
  if (redis) {
    try {
      const acquired = await redis.set('lock:ticket-maintenance', token, { nx: true, ex: 240 });
      if (!acquired) return NextResponse.json({ status: 'skipped', reason: 'already_running' });
      locked = true;
    } catch { /* Maintenance remains available during Redis outage. */ }
  }
  try { return NextResponse.json(await runTicketMaintenance()); }
  finally {
    if (redis && locked) try { if (await redis.get('lock:ticket-maintenance') === token) await redis.del('lock:ticket-maintenance'); } catch {}
  }
}
