// Generated with: whatsapp-webhooks skill
// https://github.com/hookdeck/webhook-skills
import { NextRequest, NextResponse } from 'next/server';
import { normalizeWebhook } from '@/lib/whatsapp/normalizer';
import { verifyHmacSha256 } from '@/lib/whatsapp/signature';
import { markWebhookEventFailed, markWebhookEventProcessed, processInboundMessage } from '@/lib/whatsapp/webhook-service';
import { enqueueWhatsAppReply } from '@/lib/whatsapp/outbox-service';
import { checkRateLimit, requestIp } from '@/lib/cache/rate-limit';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  if (params.get('hub.mode') === 'subscribe' && params.get('hub.verify_token') === process.env.WHATSAPP_VERIFY_TOKEN) {
    return new NextResponse(params.get('hub.challenge') || '', { status: 200 });
  }
  return NextResponse.json({ status: 'ready' }, { status: 200 });
}

export async function POST(request: NextRequest) {
  const rate = await checkRateLimit(`webhook:${requestIp(request.headers)}`, 600, 60);
  if (!rate.allowed) return NextResponse.json({ message: 'Rate limit webhook terlampaui.' }, { status: 429, headers: { 'Retry-After': String(rate.retryAfter) } });
  const rawBody = await request.text();
  const provider = (process.env.WHATSAPP_WEBHOOK_PROVIDER || 'office').toLowerCase();
  const secret = provider === 'meta' ? process.env.WHATSAPP_APP_SECRET : process.env.WHATSAPP_OFFICE_WEBHOOK_SECRET;
  const signatureHeader = provider === 'meta' ? 'x-hub-signature-256' : (process.env.WHATSAPP_OFFICE_SIGNATURE_HEADER || 'x-webhook-signature');
  if (!secret || !verifyHmacSha256(rawBody, request.headers.get(signatureHeader), secret)) {
    return NextResponse.json({ message: 'Signature webhook tidak valid.' }, { status: 401 });
  }

  let payload: any;
  try { payload = JSON.parse(rawBody); } catch { return NextResponse.json({ message: 'Payload JSON tidak valid.' }, { status: 400 }); }
  const messages = normalizeWebhook(payload, provider);
  const results = [];
  for (const message of messages) {
    try {
      const result = await processInboundMessage(message, provider);
      if (result.reply && result.action !== 'TICKET_CREATED') await enqueueWhatsAppReply(`${provider}:${message.id}:${result.action}`, result.reply, result.ticketId);
      if (result.action !== 'DUPLICATE') await markWebhookEventProcessed(provider, message.id);
      results.push(result);
    } catch (error) {
      await markWebhookEventFailed(provider, message.id, error);
      throw error;
    }
  }
  return NextResponse.json({ received: messages.length, results });
}
