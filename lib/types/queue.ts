export type BotReplyJobType =
  | 'TICKET_CREATED'
  | 'GUIDANCE_REQUEST'
  | 'GUIDANCE_REMINDER'
  | 'STATUS_INFO'
  | 'ASSIGNMENT_NOTIFICATION'
  | 'RESOLUTION_CONFIRMATION'
  | 'UNREGISTERED'
  | 'INVALID_FORMAT'
  | 'INVALID_ATTACHMENT'
  | 'ERROR';

export interface BotReplyJob {
  job_type: BotReplyJobType;
  recipient_phone: string;
  ticket_id?: string;
  ticket_number?: string;
  staff_name?: string;
  resolution_note?: string;
  current_status?: string;
  details?: Record<string, any>;
}

export type TimerJobType =
  | 'GUIDANCE_REMINDER'
  | 'AUTO_CLOSE_NO_RESPONSE'
  | 'AUTO_CLOSE_RESOLVED'
  | 'UNASSIGNED_REMINDER'
  | 'STALE_TICKET_REMINDER';

export interface TimerJob {
  job_type: TimerJobType;
  ticket_id: string;
  scheduled_at: string;
  metadata?: Record<string, any>;
}
