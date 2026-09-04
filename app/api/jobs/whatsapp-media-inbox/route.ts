import { NextRequest, NextResponse } from 'next/server';
import { verifyJobRequest } from '@/lib/jobs/verify-job-request';
import { processInboundMedia } from '@/lib/whatsapp/media-inbox-service';

export async function POST(request: NextRequest) {
  if (!await verifyJobRequest(request)) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  return NextResponse.json(await processInboundMedia());
}
