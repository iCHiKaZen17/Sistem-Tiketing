import { presentNotification } from '@/lib/notifications/presentation';
import { getErrorMessage } from '@/lib/utils/error-response';

describe('human-readable presentation', () => {
  it('presents ticket notifications without exposing their raw payload', () => {
    expect(presentNotification({
      event_type: 'TICKET_ASSIGNED_TO_ME',
      payload: { ticket_id: 'ticket-id', ticket_number: 'TKT-20260901-0001' },
    })).toEqual({
      title: 'Tiket ditugaskan kepada Anda',
      message: 'Anda ditugaskan untuk menangani tiket TKT-20260901-0001.',
      ticketHref: '/tickets/ticket-id',
    });
  });

  it('turns serialized validation issues into a readable sentence', () => {
    const rawMessage = JSON.stringify([
      { code: 'too_small', message: 'Password harus terdiri dari minimal 10 karakter.' },
    ]);

    expect(getErrorMessage(rawMessage)).toBe('Password harus terdiri dari minimal 10 karakter.');
  });
});
