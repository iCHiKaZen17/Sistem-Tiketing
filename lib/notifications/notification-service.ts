import { createAdminClient } from '@/lib/supabase/server';
import { NotificationEvent } from '@/lib/types/notification';
import { log } from '@/lib/observability/logger';

export class NotificationService {
  /**
   * Send notification to a specific user if preference allows.
   */
  static async notifyUser(
    userId: string,
    eventType: string,
    payload: Record<string, any>,
    dedupeKey?: string,
  ): Promise<NotificationEvent | null> {
    const supabase = createAdminClient();

    // Check user preference
    const { data: pref } = await supabase
      .from('notification_preferences')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (pref) {
      if (eventType === 'NEW_UNASSIGNED_TICKET' && !pref.new_unassigned_ticket) return null;
      if (eventType === 'TICKET_ASSIGNED_TO_ME' && !pref.ticket_assigned_to_me) return null;
      if (eventType === 'NEW_MESSAGE_ON_MY_TICKET' && !pref.new_message_on_my_ticket) return null;
      if (eventType === 'STALE_TICKET_REMINDER' && !pref.stale_ticket_reminder) return null;
    }

    const query = supabase
      .from('notifications')
      .upsert({
        user_id: userId,
        event_type: eventType,
        payload,
        dedupe_key: dedupeKey || null,
      }, { onConflict: 'user_id,dedupe_key', ignoreDuplicates: Boolean(dedupeKey) })
      .select('*')
      .single();
    const { data: notif, error } = await query;

    if (error || !notif) {
      log('error', 'notification_create_failed', { userId, eventType, message: error?.message });
      return null;
    }

    return notif;
  }

  /**
   * Broadcast notification to all active Supervisors.
   */
  static async broadcastToSupervisors(eventType: string, payload: Record<string, any>, dedupeKey?: string): Promise<void> {
    const supabase = createAdminClient();
    const { data: supervisors } = await supabase
      .from('users')
      .select('id')
      .eq('role', 'SUPERVISOR')
      .eq('is_active', true);

    if (supervisors) {
      for (const sup of supervisors) {
        await this.notifyUser(sup.id, eventType, payload, dedupeKey);
      }
    }
  }

  /**
   * Broadcast notification to all active users (Staff & Supervisor).
   */
  static async broadcastToAll(eventType: string, payload: Record<string, any>, dedupeKey?: string): Promise<void> {
    const supabase = createAdminClient();
    const { data: users } = await supabase.from('users').select('id').eq('is_active', true);

    if (users) {
      for (const user of users) {
        await this.notifyUser(user.id, eventType, payload, dedupeKey);
      }
    }
  }
}
