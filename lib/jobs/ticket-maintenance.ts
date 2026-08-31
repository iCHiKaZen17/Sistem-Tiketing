import { createAdminClient } from '@/lib/supabase/server';
import { calculateWorkingMinutes } from '@/lib/utils/working-hours';
import { NotificationService } from '@/lib/notifications/notification-service';
import { enqueueWhatsAppReply } from '@/lib/whatsapp/outbox-service';

export interface MaintenanceSummary { remindedForInfo: number; remindedForAssignment: number; remindedStale: number; closed: number }

export async function runTicketMaintenance(now = new Date()): Promise<MaintenanceSummary> {
  const supabase = createAdminClient();
  const summary = { remindedForInfo: 0, remindedForAssignment: 0, remindedStale: 0, closed: 0 };
  const { data: tickets, error } = await supabase.from('tickets')
    .select('*, reporters(phone)').in('status', ['OPEN', 'IN_PROGRESS', 'RESOLVED']);
  if (error) throw new Error(error.message);

  for (const ticket of tickets || []) {
    const ageMinutes = (now.getTime() - new Date(ticket.created_at).getTime()) / 60000;
    const incomplete = !ticket.app_name || !ticket.error_desc || !ticket.repro_steps;

    if (ticket.status === 'OPEN' && incomplete && ageMinutes >= 15 && !ticket.info_reminder_sent_at) {
      await enqueueWhatsAppReply(`ticket:${ticket.id}:info-reminder`, { to: ticket.reporters.phone, text: `Tiket ${ticket.ticket_number} membutuhkan nama aplikasi, deskripsi error, dan langkah reproduksi.` }, ticket.id);
      await supabase.from('tickets').update({ info_reminder_sent_at: now.toISOString() }).eq('id', ticket.id);
      summary.remindedForInfo++;
      continue;
    }
    if (ticket.status === 'OPEN' && incomplete && ticket.info_reminder_sent_at && now.getTime() - new Date(ticket.info_reminder_sent_at).getTime() >= 15 * 60000) {
      await closeAutomatically(ticket.id, 'Ditutup karena tidak ada respons dari Reporter.');
      summary.closed++;
      continue;
    }
    if (ticket.status === 'OPEN' && !ticket.assigned_to && ageMinutes >= 30 && !ticket.assignment_reminder_sent_at) {
      await NotificationService.broadcastToSupervisors('UNASSIGNED_TICKET_REMINDER', { ticket_id: ticket.id, ticket_number: ticket.ticket_number });
      await supabase.from('tickets').update({ assignment_reminder_sent_at: now.toISOString() }).eq('id', ticket.id);
      summary.remindedForAssignment++;
    }
    if (ticket.status === 'IN_PROGRESS' && calculateWorkingMinutes(new Date(ticket.updated_at), now) >= 240 && !ticket.stale_reminder_sent_at) {
      if (ticket.assigned_to) await NotificationService.notifyUser(ticket.assigned_to, 'STALE_TICKET_REMINDER', { ticket_id: ticket.id, ticket_number: ticket.ticket_number });
      await NotificationService.broadcastToSupervisors('STALE_TICKET_REMINDER', { ticket_id: ticket.id, ticket_number: ticket.ticket_number });
      await supabase.from('tickets').update({ stale_reminder_sent_at: now.toISOString() }).eq('id', ticket.id);
      summary.remindedStale++;
    }
    if (ticket.status === 'RESOLVED' && ticket.resolved_confirmation_deadline && new Date(ticket.resolved_confirmation_deadline) <= now) {
      await closeAutomatically(ticket.id, 'Auto-closed: tidak ada konfirmasi dari Reporter.');
      summary.closed++;
    }
  }
  return summary;
}

async function closeAutomatically(ticketId: string, reason: string): Promise<void> {
  const { error } = await createAdminClient().rpc('change_ticket_status_atomic', {
    p_ticket_id: ticketId, p_new_status: 'CLOSED', p_actor_id: null, p_actor_label: 'SYSTEM', p_reason: reason,
  });
  if (error) throw new Error(error.message);
}
