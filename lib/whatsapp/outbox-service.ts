import { createAdminClient } from '@/lib/supabase/server';
import { sendWhatsAppReply } from './gateway';
import { WhatsAppReply } from './types';
import { NotificationService } from '@/lib/notifications/notification-service';
import { log } from '@/lib/observability/logger';

export async function enqueueWhatsAppReply(dedupeKey: string, reply: WhatsAppReply, ticketId?: string): Promise<void> {
  const { error } = await createAdminClient().from('whatsapp_outbox').upsert({
    dedupe_key: dedupeKey,
    ticket_id: ticketId || null,
    to_phone: reply.to,
    payload: { type: 'text', text: reply.text },
  }, { onConflict: 'dedupe_key', ignoreDuplicates: true });
  if (error) throw new Error(`Gagal enqueue balasan WhatsApp: ${error.message}`);
}

export async function processWhatsAppOutbox(limit = 20) {
  const supabase = createAdminClient();
  const { data: messages, error } = await supabase.rpc('claim_whatsapp_outbox', { p_limit: limit });
  if (error) throw new Error(error.message);
  const summary = { claimed: messages?.length || 0, sent: 0, retried: 0, failed: 0 };
  for (const message of messages || []) {
    try {
      const sent = await sendWhatsAppReply({ to: message.to_phone, text: message.payload.text });
      if (!sent) throw new Error('WHATSAPP_OFFICE_SEND_URL belum dikonfigurasi.');
      await supabase.from('whatsapp_outbox').update({ status: 'SENT', processed_at: new Date().toISOString(), last_error: null }).eq('id', message.id);
      if (message.ticket_id) {
        const { error: historyError } = await supabase.from('ticket_history').insert({
          ticket_id: message.ticket_id,
          entry_type: 'BOT_MESSAGE',
          content: message.payload.text,
          actor_label: 'WHATSAPP_BOT',
          wa_message_id: `outbox:${message.id}`,
        });
        if (historyError && historyError.code !== '23505') log('error', 'whatsapp_history_failed', { outboxId: message.id, message: historyError.message });
      }
      summary.sent++;
    } catch (error: any) {
      const terminal = message.attempts >= 5;
      const delaySeconds = Math.min(3600, 30 * 2 ** Math.max(0, message.attempts - 1));
      await supabase.from('whatsapp_outbox').update({
        status: terminal ? 'FAILED' : 'PENDING',
        next_attempt_at: new Date(Date.now() + delaySeconds * 1000).toISOString(),
        last_error: String(error.message || error).slice(0, 1000),
      }).eq('id', message.id);
      if (terminal) await NotificationService.broadcastToSupervisors('WHATSAPP_OUTBOUND_FAILED', { outbox_id: message.id, to: message.to_phone }, `outbox:${message.id}:failed`);
      terminal ? summary.failed++ : summary.retried++;
    }
  }
  return summary;
}
