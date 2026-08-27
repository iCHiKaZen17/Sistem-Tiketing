export type TicketStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';

export type HistoryEntryType =
  | 'REPORTER_MESSAGE'
  | 'BOT_MESSAGE'
  | 'STATUS_CHANGE'
  | 'ASSIGNMENT_CHANGE'
  | 'RESOLUTION_NOTE'
  | 'SYSTEM_EVENT';

export type AttachmentType = 'IMAGE' | 'DOCUMENT';

export interface Ticket {
  id: string;
  ticket_number: string;
  reporter_id: string;
  status: TicketStatus;
  app_name?: string | null;
  error_desc?: string | null;
  repro_steps?: string | null;
  assigned_to?: string | null;
  resolution_note?: string | null;
  created_at: string;
  updated_at: string;
  resolved_at?: string | null;
  closed_at?: string | null;
  first_assigned_at?: string | null;
  resolved_confirmation_deadline?: string | null;
}

export interface TicketSummary {
  id: string;
  ticket_number: string;
  reporter_name: string;
  app_name?: string | null;
  error_desc_summary?: string | null;
  status: TicketStatus;
  created_at: string;
  assigned_to_name?: string | null;
}

export interface TicketHistoryEntry {
  id: string;
  ticket_id: string;
  entry_type: HistoryEntryType;
  content?: string | null;
  actor_id?: string | null;
  actor_label?: string | null;
  metadata?: Record<string, any> | null;
  wa_message_id?: string | null;
  created_at: string;
}

export interface TicketAttachment {
  id: string;
  ticket_id: string;
  history_id?: string | null;
  file_type: AttachmentType;
  filename: string;
  mime_type: string;
  file_size: number;
  storage_path: string;
  wa_media_id?: string | null;
  uploaded_at: string;
}

export interface TicketDetail extends Ticket {
  reporter_name: string;
  reporter_phone: string;
  assigned_to_name?: string | null;
  history: TicketHistoryEntry[];
  attachments: TicketAttachment[];
}

export interface TicketFilter {
  status?: TicketStatus | TicketStatus[];
  app_name?: string;
  assigned_to?: string;
  date_from?: string;
  date_to?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface CreateTicketParams {
  reporter_id: string;
  app_name?: string;
  error_desc?: string;
  repro_steps?: string;
  wa_message_id?: string;
  attachment?: {
    file_type: AttachmentType;
    filename: string;
    mime_type: string;
    file_size: number;
    storage_path: string;
    wa_media_id?: string;
  };
}

export interface Pagination {
  page: number;
  limit: number;
  total_items: number;
  total_pages: number;
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: Pagination;
}
