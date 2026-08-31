export interface InboundWhatsAppMessage {
  id: string;
  from: string;
  type: string;
  text?: string;
  timestamp?: string;
}

export interface WhatsAppReply {
  to: string;
  text: string;
}

export interface WebhookProcessingResult {
  eventId: string;
  action: 'TICKET_CREATED' | 'MESSAGE_APPENDED' | 'TICKET_CLOSED' | 'IGNORED' | 'REJECTED' | 'DUPLICATE';
  ticketNumber?: string;
  ticketId?: string;
  reply?: WhatsAppReply;
}
