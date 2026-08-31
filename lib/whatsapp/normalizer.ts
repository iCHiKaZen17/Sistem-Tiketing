// Generated with: whatsapp-webhooks skill
// https://github.com/hookdeck/webhook-skills
import { InboundWhatsAppMessage } from './types';

export function normalizeWebhook(payload: any, provider: string): InboundWhatsAppMessage[] {
  if (provider === 'meta') {
    const messages: InboundWhatsAppMessage[] = [];
    for (const entry of payload?.entry || []) for (const change of entry?.changes || []) {
      if (change?.field !== 'messages') continue;
      for (const item of change?.value?.messages || []) messages.push({
        id: item.id,
        from: item.from,
        type: item.type,
        text: item.type === 'text' ? item.text?.body : undefined,
        timestamp: item.timestamp,
      });
    }
    return messages;
  }

  // Office gateway contract. Adapt only this function if its payload differs.
  const items = Array.isArray(payload?.messages) ? payload.messages : [payload];
  return items.filter(Boolean).map((item: any) => ({
    id: String(item.id || item.message_id || ''),
    from: String(item.from || item.sender || item.phone || '').replace(/[^0-9]/g, ''),
    type: String(item.type || 'text').toLowerCase(),
    text: item.text?.body || item.text || item.message || undefined,
    timestamp: item.timestamp,
  })).filter((item: InboundWhatsAppMessage) => item.id && item.from);
}
