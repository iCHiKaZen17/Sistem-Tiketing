import { createAdminClient } from '@/lib/supabase/server';
import { TicketService } from '@/lib/tickets/ticket-service';
import { InboundWhatsAppMessage, WebhookProcessingResult, WhatsAppReply } from './types';

const TRIGGER = '#t';

export function parseTicketTrigger(text?: string): string | null {
  if (!text) return null;
  const trimmed = text.trim();
  if (!/^#t(?:\s|$)/i.test(trimmed)) return null;
  return trimmed.replace(/^#t(?:\s+)?/i, '').trim();
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
  });
  if (claimError?.code === '23505') return { eventId: message.id, action: 'DUPLICATE' };
  if (claimError) throw new Error(`Gagal mencatat event webhook: ${claimError.message}`);

  const reply = (text: string): WhatsAppReply => ({ to: message.from, text });
  const { data: reporter } = await supabase.from('reporters').select('id, name, is_active').eq('phone', message.from).maybeSingle();
  if (!reporter?.is_active) return {
    eventId: message.id, action: 'REJECTED', reply: reply('Nomor WhatsApp Anda belum terdaftar atau tidak aktif. Silakan hubungi administrator ticketing.'),
  };
  if (message.type !== 'text' || !message.text) return { eventId: message.id, action: 'IGNORED' };

  const description = parseTicketTrigger(message.text);
  if (description === null) {
    const { data: latest } = await supabase.from('tickets').select('id,ticket_number,status,app_name,error_desc,repro_steps').eq('reporter_id', reporter.id).in('status', ['OPEN','IN_PROGRESS','RESOLVED']).order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (!latest) return { eventId: message.id, action: 'IGNORED' };
    if (latest.status === 'RESOLVED' && message.text.trim().toLowerCase() === 'ya') {
      const { error } = await supabase.rpc('change_ticket_status_atomic', { p_ticket_id: latest.id, p_new_status: 'CLOSED', p_actor_id: null, p_actor_label: reporter.name, p_reason: 'Dikonfirmasi Reporter melalui WhatsApp.' });
      if (error) throw new Error(error.message);
      return { eventId: message.id, action: 'TICKET_CLOSED', ticketId: latest.id, ticketNumber: latest.ticket_number, reply: reply(`Tiket ${latest.ticket_number} telah ditutup. Terima kasih.`) };
    }
    if (latest.status === 'OPEN' || latest.status === 'IN_PROGRESS') {
      await TicketService.appendMessage({ ticket_id: latest.id, entry_type: 'REPORTER_MESSAGE', content: message.text.trim(), wa_message_id: message.id, actor_label: reporter.name });
      const parsed = parseStructuredTicketFields(message.text);
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
    return { eventId: message.id, action: 'IGNORED' };
  }

  if (!description) return {
    eventId: message.id, action: 'REJECTED', reply: reply('Tambahkan deskripsi setelah trigger. Contoh: #t Aplikasi payroll gagal dibuka.'),
  };

  const structured = parseStructuredTicketFields(description);
  const ticket = await TicketService.createTicket({ reporter_id: reporter.id, ...structured, wa_message_id: message.id });
  return {
    eventId: message.id,
    action: 'TICKET_CREATED',
    ticketId: ticket.id,
    ticketNumber: ticket.ticket_number,
    reply: reply(`Tiket ${ticket.ticket_number} berhasil dibuat. Tim support akan menindaklanjuti laporan Anda.`),
  };
}
