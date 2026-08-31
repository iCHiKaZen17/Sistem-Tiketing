import { NextRequest, NextResponse } from 'next/server';
import { verifyJobRequest } from '@/lib/jobs/verify-job-request';
import { NotificationService } from '@/lib/notifications/notification-service';
import { log } from '@/lib/observability/logger';

export async function POST(request: NextRequest) {
  if (!await verifyJobRequest(request)) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  const payload = await request.json().catch(() => ({}));
  const failure = {
    messageId: payload?.messageId,
    url: payload?.url,
    status: payload?.status,
    error: String(payload?.error || payload?.body || 'QStash delivery failed').slice(0, 500),
  };
  log('error', 'qstash_delivery_failed', failure);
  await NotificationService.broadcastToSupervisors('SYSTEM_JOB_FAILED', { source: 'QSTASH', ...failure }, failure.messageId ? `qstash:${failure.messageId}:failed` : undefined);
  return NextResponse.json({ received: true });
}
