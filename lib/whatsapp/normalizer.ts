// Generated with: whatsapp-webhooks skill
// https://github.com/hookdeck/webhook-skills
import { InboundWhatsAppMessage } from './types';

export function normalizeWebhook(payload: any, provider: string): InboundWhatsAppMessage[] {
  if (provider === 'meta') {
    const messages: InboundWhatsAppMessage[] = [];
    for (const entry of payload?.entry || []) for (const change of entry?.changes || []) {
      if (change?.field !== 'messages') continue;
      for (const item of change?.value?.messages || []) {
        const media = ['image', 'document'].includes(item.type) ? item[item.type] : undefined;
        messages.push({
          id: item.id,
          from: item.from,
          type: item.type,
          text: item.type === 'text' ? item.text?.body : media?.caption,
          timestamp: item.timestamp,
          ...(media?.id ? { media: { id: String(media.id), filename: media.filename, mimeType: media.mime_type } } : {}),
        });
      }
    }
    return messages;
  }

  // Office gateway contract. Adapt only this function if its payload differs.
  const items = Array.isArray(payload?.messages) ? payload.messages : [payload];
  return items.filter(Boolean).map((item: any) => {
    const source = item.media || item.attachment || item;
    const mediaId = source.media_id || source.mediaId || (item.media || item.attachment ? source.id : undefined);
    const mimeType = source.mime_type || source.mimeType;
    const type = String(item.type || (mediaId ? (String(mimeType).startsWith('image/') ? 'image' : 'document') : 'text')).toLowerCase();
    return {
      id: String(item.id || item.message_id || ''),
      from: String(item.from || item.sender || item.phone || '').replace(/[^0-9]/g, ''),
      type,
      text: item.text?.body || item.text || item.message || item.caption || source.caption || undefined,
      timestamp: item.timestamp,
      ...(mediaId ? { media: { id: String(mediaId), filename: source.filename || source.file_name, mimeType } } : {}),
    };
  }).filter((item: InboundWhatsAppMessage) => item.id && item.from);
}
