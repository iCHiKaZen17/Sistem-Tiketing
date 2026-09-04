import { randomUUID } from 'crypto';
import { createAdminClient } from '@/lib/supabase/server';
import { sendWhatsAppAttachment, sendWhatsAppText } from './gateway';
import { WhatsAppReply } from './types';
import { NotificationService } from '@/lib/notifications/notification-service';
import { AttachmentService } from '@/lib/attachments/attachment-service';
import { log } from '@/lib/observability/logger';

interface DeliveryAttachment {
  attachmentId: string;
  caption?: string;
}

export function buildDeliveryRows(params: {
  deliveryId: string;
  dedupeKey: string;
  to: string;
  ticketId?: string;
  text?: string;
  attachments?: DeliveryAttachment[];
}) {
  let sequence = 0;
  const common = { delivery_id: params.deliveryId, ticket_id: params.ticketId || null, to_phone: params.to };
  const rows: Array<Record<string, unknown>> = [];
  if (params.text) rows.push({
    ...common, dedupe_key: params.dedupeKey, sequence_no: ++sequence, message_type: 'TEXT', attachment_id: null,
    payload: { type: 'text', text: params.text },
  });
  for (const attachment of params.attachments || []) rows.push({
    ...common,
    dedupe_key: `${params.dedupeKey}:attachment:${attachment.attachmentId}`,
    sequence_no: ++sequence,
    message_type: 'ATTACHMENT',
    attachment_id: attachment.attachmentId,
    payload: { type: 'attachment', ...(attachment.caption ? { caption: attachment.caption } : {}) },
  });
  return rows;
}

export async function enqueueWhatsAppDelivery(params: {
  dedupeKey: string;
  to: string;
  ticketId?: string;
  text?: string;
  attachments?: DeliveryAttachment[];
}): Promise<void> {
  const rows = buildDeliveryRows({ ...params, deliveryId: randomUUID() });
  if (!rows.length) return;
  const { error } = await createAdminClient().from('whatsapp_outbox').upsert(rows, { onConflict: 'dedupe_key', ignoreDuplicates: true });
  if (error) throw new Error(`Gagal enqueue balasan WhatsApp: ${error.message}`);
}

export async function enqueueWhatsAppReply(dedupeKey: string, reply: WhatsAppReply, ticketId?: string): Promise<void> {
  return enqueueWhatsAppDelivery({ dedupeKey, to: reply.to, text: reply.text, ticketId });
}

async function deliverOutboxItem(message: any) {
  if (message.message_type !== 'ATTACHMENT') {
    const sent = await sendWhatsAppText({ to: message.to_phone, text: message.payload.text });
    if (!sent) throw new Error('WHATSAPP_OFFICE_SEND_URL belum dikonfigurasi.');
    return message.payload.text;
  }

  if (!message.attachment_id) throw new Error('Referensi lampiran WhatsApp tidak tersedia.');
  const supabase = createAdminClient();
  const { data: attachment, error } = await supabase.from('ticket_attachments').select('*').eq('id', message.attachment_id).single();
  if (error || !attachment) throw new Error('Lampiran WhatsApp tidak ditemukan.');
  const { data: file, error: downloadError } = await supabase.storage.from('ticket-attachments').download(attachment.storage_path);
  if (downloadError || !file) throw new Error(`Gagal membaca lampiran: ${downloadError?.message || 'file tidak tersedia'}.`);
  const bytes = new Uint8Array(await file.arrayBuffer());
  const validation = AttachmentService.validateAttachment(attachment.mime_type, bytes.length);
  if (!validation.valid || !AttachmentService.hasValidSignature(attachment.mime_type, bytes)) throw new Error(validation.error || 'Isi lampiran tidak valid.');
  const sent = await sendWhatsAppAttachment({
    to: message.to_phone, filename: attachment.filename, mimeType: attachment.mime_type, bytes, caption: message.payload.caption,
  });
  if (!sent) throw new Error('WHATSAPP_OFFICE_ATTACHMENT_SEND_URL belum dikonfigurasi.');
  return `Lampiran dikirim: ${attachment.filename}`;
}

export async function processWhatsAppOutbox(limit = 20) {
  const supabase = createAdminClient();
  const summary = { claimed: 0, sent: 0, retried: 0, failed: 0 };
  while (summary.claimed < limit) {
    const { data: messages, error } = await supabase.rpc('claim_whatsapp_outbox', { p_limit: limit - summary.claimed });
    if (error) throw new Error(error.message);
    if (!messages?.length) break;
    summary.claimed += messages.length;
    for (const message of messages) {
      try {
        const historyContent = await deliverOutboxItem(message);
        await supabase.from('whatsapp_outbox').update({ status: 'SENT', processed_at: new Date().toISOString(), last_error: null }).eq('id', message.id);
        if (message.ticket_id) {
          const { error: historyError } = await supabase.from('ticket_history').insert({
            ticket_id: message.ticket_id, entry_type: 'BOT_MESSAGE', content: historyContent,
            actor_label: 'WHATSAPP_BOT', wa_message_id: `outbox:${message.id}`,
          });
          if (historyError && historyError.code !== '23505') log('error', 'whatsapp_history_failed', { outboxId: message.id, message: historyError.message });
        }
        summary.sent++;
      } catch (error: any) {
        const terminal = message.attempts >= 5;
        const errorMessage = String(error.message || error).slice(0, 1000);
        const delaySeconds = Math.min(3600, 30 * 2 ** Math.max(0, message.attempts - 1));
        await supabase.from('whatsapp_outbox').update({
          status: terminal ? 'FAILED' : 'PENDING', next_attempt_at: new Date(Date.now() + delaySeconds * 1000).toISOString(), last_error: errorMessage,
        }).eq('id', message.id);
        if (terminal) {
          await supabase.from('whatsapp_outbox').update({ status: 'FAILED', last_error: 'Langkah pengiriman sebelumnya gagal.' })
            .eq('delivery_id', message.delivery_id).gt('sequence_no', message.sequence_no).in('status', ['PENDING', 'PROCESSING']);
          await NotificationService.broadcastToSupervisors('WHATSAPP_OUTBOUND_FAILED', { outbox_id: message.id, to: message.to_phone }, `outbox:${message.id}:failed`);
        }
        terminal ? summary.failed++ : summary.retried++;
      }
    }
  }
  return summary;
}
