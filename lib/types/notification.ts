export interface NotificationEvent {
  id: string;
  user_id: string;
  event_type: string;
  payload: Record<string, any>;
  is_read: boolean;
  created_at: string;
}

export interface NotificationPreferences {
  user_id: string;
  new_unassigned_ticket: boolean;
  ticket_assigned_to_me: boolean;
  new_message_on_my_ticket: boolean;
  stale_ticket_reminder: boolean;
  updated_at: string;
}
