export interface InboundWhatsAppMessage {
  id: string;
  from: string;
  type: string;
  text?: string;
  timestamp?: string;
  media?: {
    id: string;
    filename?: string;
    mimeType?: string;
  };
}

export interface WhatsAppReply {
  to: string;
  text: string;
}

export interface WhatsAppAttachmentReply {
  to: string;
  filename: string;
  mimeType: string;
  bytes: Uint8Array;
  caption?: string;
}

export interface WebhookProcessingResult {
  eventId: string;
  action: 'TICKET_CREATED' | 'MESSAGE_APPENDED' | 'TICKET_CLOSED' | 'TICKET_REOPENED' | 'IGNORED' | 'REJECTED' | 'DUPLICATE';
  ticketNumber?: string;
  ticketId?: string;
  reply?: WhatsAppReply;
}
