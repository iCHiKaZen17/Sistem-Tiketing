import { randomUUID } from 'crypto';
import { AttachmentService } from '@/lib/attachments/attachment-service';
import { NotificationService } from '@/lib/notifications/notification-service';
import { createAdminClient } from '@/lib/supabase/server';
import { TicketService } from '@/lib/tickets/ticket-service';

export async function enqueueInboundMedia(params: {
  provider: string;
  providerEventId: string;
  mediaId: string;
  ticketId: string;
  filename?: string;
  mimeType?: string;
}) {
  const { error } = await createAdminClient().from('whatsapp_media_inbox').upsert({
    provider: params.provider,
    provider_event_id: params.providerEventId,
    media_id: params.mediaId,
    ticket_id: params.ticketId,
    filename: params.filename || null,
    mime_type: params.mimeType || null,
  }, { onConflict: 'provider,media_id', ignoreDuplicates: true });
  if (error) throw new Error(`Gagal mencatat media WhatsApp: ${error.message}`);
}

export function buildMediaDownloadUrl(template: string, mediaId: string) {
  if (!template.includes('{media_id}')) throw new Error('WHATSAPP_OFFICE_MEDIA_DOWNLOAD_URL harus memuat placeholder {media_id}.');
  return template.replace('{media_id}', encodeURIComponent(mediaId));
}

async function downloadOfficeMedia(mediaId: string) {
  const template = process.env.WHATSAPP_OFFICE_MEDIA_DOWNLOAD_URL;
  if (!template) throw new Error('WHATSAPP_OFFICE_MEDIA_DOWNLOAD_URL belum dikonfigurasi.');
  const response = await fetch(buildMediaDownloadUrl(template, mediaId), {
    headers: process.env.WHATSAPP_OFFICE_MEDIA_API_TOKEN
      ? { Authorization: `Bearer ${process.env.WHATSAPP_OFFICE_MEDIA_API_TOKEN}` }
      : {},
  });
  if (!response.ok) throw new Error(`Gateway WA kantor gagal memberikan media (${response.status}).`);
  return {
    bytes: new Uint8Array(await response.arrayBuffer()),
    mimeType: response.headers.get('content-type')?.split(';')[0],
  };
}

async function saveInboundMedia(message: any) {
  if (message.provider !== 'office') throw new Error(`Download media provider ${message.provider} belum didukung.`);
  const supabase = createAdminClient();
  const { data: existing } = await supabase.from('ticket_attachments').select('id').eq('wa_media_id', message.media_id).maybeSingle();
  if (existing) return;

  const downloaded = await downloadOfficeMedia(message.media_id);
  const mimeType = message.mime_type || downloaded.mimeType || '';
  const validation = AttachmentService.validateAttachment(mimeType, downloaded.bytes.length);
  if (!validation.valid || !validation.category) throw new Error(validation.error || 'Media WhatsApp tidak valid.');
  if (!AttachmentService.hasValidSignature(mimeType, downloaded.bytes)) throw new Error('Isi media WhatsApp tidak sesuai tipe file.');

  const filename = message.filename || `whatsapp-${message.media_id}`;
  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
  const storagePath = `${message.ticket_id}/${randomUUID()}-${safeName}`;
  const { error: uploadError } = await supabase.storage.from('ticket-attachments').upload(storagePath, downloaded.bytes, { contentType: mimeType });
  if (uploadError) throw new Error(uploadError.message);
  try {
    await AttachmentService.saveAttachment({
      ticket_id: message.ticket_id,
      file_type: validation.category,
      filename,
      mime_type: mimeType,
      file_size: downloaded.bytes.length,
      storage_path: storagePath,
      wa_media_id: message.media_id,
    });
    await TicketService.appendMessage({
      ticket_id: message.ticket_id,
      entry_type: 'SYSTEM_EVENT',
      content: `Lampiran WhatsApp ${filename} ditambahkan.`,
      actor_label: 'WHATSAPP_BOT',
    });
  } catch (error) {
    await supabase.storage.from('ticket-attachments').remove([storagePath]);
    throw error;
  }
}

export async function processInboundMedia(limit = 10) {
  const supabase = createAdminClient();
  const { data: messages, error } = await supabase.rpc('claim_whatsapp_media_inbox', { p_limit: limit });
  if (error) throw new Error(error.message);
  const summary = { claimed: messages?.length || 0, saved: 0, retried: 0, failed: 0 };
  for (const message of messages || []) {
    try {
      await saveInboundMedia(message);
      await supabase.from('whatsapp_media_inbox').update({ status: 'SAVED', processed_at: new Date().toISOString(), last_error: null }).eq('id', message.id);
      summary.saved++;
    } catch (error: any) {
      const terminal = message.attempts >= 5;
      const delaySeconds = Math.min(3600, 30 * 2 ** Math.max(0, message.attempts - 1));
      await supabase.from('whatsapp_media_inbox').update({
        status: terminal ? 'FAILED' : 'PENDING',
        next_attempt_at: new Date(Date.now() + delaySeconds * 1000).toISOString(),
        last_error: String(error.message || error).slice(0, 1000),
      }).eq('id', message.id);
      if (terminal) await NotificationService.broadcastToSupervisors(
        'WHATSAPP_INBOUND_MEDIA_FAILED',
        { ticket_id: message.ticket_id, media_id: message.media_id },
        `media:${message.id}:failed`
      );
      terminal ? summary.failed++ : summary.retried++;
    }
  }
  return summary;
}
