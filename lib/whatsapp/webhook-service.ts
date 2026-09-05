import { createAdminClient } from '@/lib/supabase/server';
import { TicketService } from '@/lib/tickets/ticket-service';
import { InboundWhatsAppMessage, WebhookProcessingResult, WhatsAppReply } from './types';
import { enqueueInboundMedia } from './media-inbox-service';
import { resolveReporterTicket } from './ticket-routing';

const TRIGGER = '#t';

export function parseTicketTrigger(text?: string): string | null {
  if (!text) return null;
  const trimmed = text.trim();
  if (!/^#t(?:\s|$)/i.test(trimmed)) return null;
  return trimmed.replace(/^#t(?:\s+)?/i, '').trim();
}

export function parseResolutionReply(text: string): 'CONFIRMED' | 'NOT_RESOLVED' | null {
  const answer = text.trim().toLowerCase();
  if (answer === 'ya') return 'CONFIRMED';
  if (answer === 'belum selesai') return 'NOT_RESOLVED';
  return null;
}

export function parseStructuredTicketFields(text: string): { app_name?: string; error_desc?: string; repro_steps?: string } {
  const fields: { app_name?: string; error_desc?: string; repro_steps?: string } = {};
  const labels: Record<string, keyof typeof fields> = {
    aplikasi: 'app_name', app: 'app_name', deskripsi: 'error_desc', error: 'error_desc', langkah: 'repro_steps', repro: 'repro_steps',
  };
  let active: keyof typeof fields | undefined;
  let foundLabel = false;
  for (const rawLine of text.split(/\r?\n/)) {
    const match = rawLine.match(/^\s*(aplikasi|app|deskripsi|error|langkah|repro)\s*:\s*(.*)$/i);
    if (match) {
      active = labels[match[1].toLowerCase()];
      fields[active] = match[2].trim();
      foundLabel = true;
    } else if (active && rawLine.trim()) {
      fields[active] = `${fields[active] || ''}\n${rawLine.trim()}`.trim();
    }
  }
  if (!foundLabel) return { error_desc: text.trim() };
  return Object.fromEntries(Object.entries(fields).filter(([, value]) => value)) as typeof fields;
}

export async function processInboundMessage(message: InboundWhatsAppMessage, provider: string): Promise<WebhookProcessingResult> {
  const supabase = createAdminClient();
  const { error: claimError } = await supabase.from('webhook_events').insert({
    provider, provider_event_id: message.id, sender: message.from, event_type: message.type,
    status: 'PROCESSING', processed_at: null, updated_at: new Date().toISOString(),
  });
  if (claimError?.code === '23505') {
    const { data: existing } = await supabase.from('webhook_events').select('id,status,updated_at')
      .eq('provider', provider).eq('provider_event_id', message.id).maybeSingle();
    const stale = existing?.status === 'PROCESSING' && new Date(existing.updated_at).getTime() < Date.now() - 5 * 60_000;
    if (!existing || (existing.status !== 'FAILED' && !stale)) return { eventId: message.id, action: 'DUPLICATE' };
    const { error: retryError } = await supabase.from('webhook_events').update({
      status: 'PROCESSING', last_error: null, updated_at: new Date().toISOString(),
    }).eq('id', existing.id);
    if (retryError) throw new Error(`Gagal mengulang event webhook: ${retryError.message}`);
  } else if (claimError) {
    throw new Error(`Gagal mencatat event webhook: ${claimError.message}`);
  }

  const reply = (text: string): WhatsAppReply => ({ to: message.from, text });
  const { data: reporter } = await supabase.from('reporters').select('id, name, is_active').eq('phone', message.from).maybeSingle();
  if (!reporter?.is_active) return {
    eventId: message.id, action: 'REJECTED', reply: reply('Nomor WhatsApp Anda belum terdaftar atau tidak aktif. Silakan hubungi administrator ticketing.'),
  };
  if (!message.text && !message.media) return { eventId: message.id, action: 'IGNORED' };

  const description = parseTicketTrigger(message.text);
  if (description === null) {
    if (!message.media && message.type !== 'text') return { eventId: message.id, action: 'IGNORED' };
    const { data: completed, error: confirmationError } = await supabase.from('whatsapp_resolution_confirmations')
      .select('ticket_id,confirmed').eq('event_id', `${provider}:${message.id}`).eq('reporter_id', reporter.id).maybeSingle();
    if (confirmationError) throw new Error(confirmationError.message);
    if (completed) return {
      eventId: message.id, action: completed.confirmed ? 'TICKET_CLOSED' : 'TICKET_REOPENED', ticketId: completed.ticket_id,
      reply: reply(completed.confirmed ? 'Tiket telah ditutup. Terima kasih.' : 'Tiket dikembalikan ke proses penanganan.'),
    };
    const routed = await resolveReporterTicket(supabase, reporter.id, message.text || '');
    if (!routed.ticket) return { eventId: message.id, action: 'REJECTED', reply: reply(routed.error!) };
    const latest = routed.ticket;
    const text = routed.text;
    if (message.media) {
      if (!['OPEN', 'IN_PROGRESS'].includes(latest.status)) return { eventId: message.id, action: 'REJECTED', reply: reply('Lampiran hanya dapat ditambahkan ke tiket OPEN atau IN_PROGRESS. Jika solusi belum berhasil, balas BELUM SELESAI beserta nomor tiket.') };
      await enqueueInboundMedia({ provider, providerEventId: message.id, mediaId: message.media.id, ticketId: latest.id, filename: message.media.filename, mimeType: message.media.mimeType });
      return { eventId: message.id, action: 'MESSAGE_APPENDED', ticketId: latest.id, ticketNumber: latest.ticket_number, reply: reply(`Lampiran untuk tiket ${latest.ticket_number} diterima dan sedang diproses.`) };
    }
    const confirmation = parseResolutionReply(text);
    if (confirmation && latest.status !== 'RESOLVED') return { eventId: message.id, action: 'REJECTED', reply: reply('Konfirmasi hanya berlaku untuk tiket RESOLVED.') };
    if (latest.status === 'RESOLVED') {
      // The RPC checks ownership and RESOLVED under a row lock.
      if (confirmation === 'CONFIRMED') {
        const { error } = await supabase.rpc('confirm_reporter_resolution', { p_ticket_id: latest.id, p_reporter_id: reporter.id, p_confirmed: true, p_event_id: `${provider}:${message.id}` });
        if (error) throw new Error(error.message);
        return { eventId: message.id, action: 'TICKET_CLOSED', ticketId: latest.id, ticketNumber: latest.ticket_number, reply: reply(`Tiket ${latest.ticket_number} telah ditutup. Terima kasih.`) };
      }
      if (confirmation === 'NOT_RESOLVED') {
        const { error } = await supabase.rpc('confirm_reporter_resolution', { p_ticket_id: latest.id, p_reporter_id: reporter.id, p_confirmed: false, p_event_id: `${provider}:${message.id}` });
        if (error) throw new Error(error.message);
        return { eventId: message.id, action: 'TICKET_REOPENED', ticketId: latest.id, ticketNumber: latest.ticket_number, reply: reply(`Tiket ${latest.ticket_number} dikembalikan ke proses penanganan.`) };
      }
    }
    if (latest.status === 'OPEN' || latest.status === 'IN_PROGRESS') {
      if (!text) return { eventId: message.id, action: 'REJECTED', reply: reply('Tambahkan pesan setelah nomor tiket.') };
      await TicketService.appendMessage({ ticket_id: latest.id, entry_type: 'REPORTER_MESSAGE', content: text, wa_message_id: message.id, actor_label: reporter.name });
      const parsed = parseStructuredTicketFields(text);
      const update = {
        ...(!latest.app_name && parsed.app_name ? { app_name: parsed.app_name } : {}),
        ...(!latest.error_desc && parsed.error_desc ? { error_desc: parsed.error_desc } : {}),
        ...(!latest.repro_steps && parsed.repro_steps ? { repro_steps: parsed.repro_steps } : {}),
      };
      if (Object.keys(update).length) await supabase.from('tickets').update(update).eq('id', latest.id);
      const complete = Boolean(latest.app_name || update.app_name) && Boolean(latest.error_desc || update.error_desc) && Boolean(latest.repro_steps || update.repro_steps);
      return {
        eventId: message.id, action: 'MESSAGE_APPENDED', ticketId: latest.id, ticketNumber: latest.ticket_number,
        reply: Object.keys(update).length ? reply(complete ? `Informasi tiket ${latest.ticket_number} sudah lengkap.` : `Informasi tiket ${latest.ticket_number} diperbarui. Lengkapi dengan format Aplikasi:, Deskripsi:, dan Langkah:.`) : undefined,
      };
    }
    return { eventId: message.id, action: 'REJECTED', reply: reply(`Tiket ${latest.ticket_number} berstatus ${latest.status}. Untuk tiket RESOLVED, balas YA atau BELUM SELESAI beserta nomor tiket.`) };
  }

  if (!description) return {
    eventId: message.id, action: 'REJECTED', reply: reply('Tambahkan deskripsi setelah trigger. Contoh: #t Aplikasi payroll gagal dibuka.'),
  };

  const structured = parseStructuredTicketFields(description);
  {
    const { data: previousHistory } = await supabase.from('ticket_history').select('ticket_id').eq('wa_message_id', message.id).maybeSingle();
    if (previousHistory?.ticket_id) {
      const { data: previousTicket } = await supabase.from('tickets').select('ticket_number').eq('id', previousHistory.ticket_id).single();
      if (message.media) await enqueueInboundMedia({
        provider, providerEventId: message.id, mediaId: message.media.id, ticketId: previousHistory.ticket_id,
        filename: message.media.filename, mimeType: message.media.mimeType,
      });
      return {
        eventId: message.id, action: 'TICKET_CREATED', ticketId: previousHistory.ticket_id,
        ticketNumber: previousTicket?.ticket_number,
      };
    }
  }
  const ticket = await TicketService.createTicket({ reporter_id: reporter.id, ...structured, wa_message_id: message.id });
  if (message.media) await enqueueInboundMedia({
    provider,
    providerEventId: message.id,
    mediaId: message.media.id,
    ticketId: ticket.id,
    filename: message.media.filename,
    mimeType: message.media.mimeType,
  });
  return {
    eventId: message.id,
    action: 'TICKET_CREATED',
    ticketId: ticket.id,
    ticketNumber: ticket.ticket_number,
    reply: reply(`Tiket ${ticket.ticket_number} berhasil dibuat. Tim support akan menindaklanjuti laporan Anda.`),
  };
}

export async function markWebhookEventProcessed(provider: string, eventId: string) {
  await createAdminClient().from('webhook_events').update({
    status: 'PROCESSED', processed_at: new Date().toISOString(), updated_at: new Date().toISOString(), last_error: null,
  }).eq('provider', provider).eq('provider_event_id', eventId);
}

export async function markWebhookEventFailed(provider: string, eventId: string, error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  await createAdminClient().from('webhook_events').update({
    status: 'FAILED', updated_at: new Date().toISOString(), last_error: message.slice(0, 1000),
  }).eq('provider', provider).eq('provider_event_id', eventId).eq('status', 'PROCESSING');
}
