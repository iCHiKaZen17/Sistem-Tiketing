import { NotificationEvent } from '@/lib/types/notification';

export interface NotificationPresentation {
  title: string;
  message: string;
  ticketHref?: string;
}

function payloadText(payload: NotificationEvent['payload'], key: string) {
  const value = payload?.[key];
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

export function presentNotification(
  notification: Pick<NotificationEvent, 'event_type' | 'payload'>
): NotificationPresentation {
  const ticketId = payloadText(notification.payload, 'ticket_id');
  const ticketNumber = payloadText(notification.payload, 'ticket_number');
  const ticket = ticketNumber ? `tiket ${ticketNumber}` : 'sebuah tiket';
  const ticketHref = ticketId ? `/tickets/${ticketId}` : undefined;

  switch (notification.event_type) {
    case 'NEW_UNASSIGNED_TICKET':
      return {
        title: 'Tiket baru belum ditugaskan',
        message: `${ticket} menunggu penugasan kepada staff.`,
        ticketHref,
      };
    case 'TICKET_ASSIGNED_TO_ME':
      return {
        title: 'Tiket ditugaskan kepada Anda',
        message: `Anda ditugaskan untuk menangani ${ticket}.`,
        ticketHref,
      };
    case 'NEW_MESSAGE_ON_MY_TICKET':
      return {
        title: 'Pesan baru pada tiket Anda',
        message: `${ticket} menerima pesan baru.`,
        ticketHref,
      };
    case 'STALE_TICKET_REMINDER':
      return {
        title: 'Tiket perlu ditindaklanjuti',
        message: `${ticket} belum mendapat pembaruan dalam beberapa waktu.`,
        ticketHref,
      };
    case 'UNASSIGNED_TICKET_REMINDER':
      return {
        title: 'Tiket masih belum ditugaskan',
        message: `${ticket} masih menunggu penugasan kepada staff.`,
        ticketHref,
      };
    case 'WHATSAPP_OUTBOUND_FAILED': {
      const destination = payloadText(notification.payload, 'to');
      const suffix = destination?.slice(-4);
      return {
        title: 'Pesan WhatsApp gagal dikirim',
        message: suffix
          ? `Pesan ke nomor berakhiran ${suffix} gagal dikirim setelah beberapa percobaan.`
          : 'Pesan WhatsApp gagal dikirim setelah beberapa percobaan.',
      };
    }
    case 'SYSTEM_JOB_FAILED':
      return {
        title: 'Proses otomatis mengalami kegagalan',
        message: 'Salah satu proses terjadwal tidak berhasil dijalankan dan perlu diperiksa.',
      };
    default:
      return {
        title: 'Pemberitahuan sistem',
        message: 'Ada pembaruan baru pada sistem ticketing.',
        ticketHref,
      };
  }
}
