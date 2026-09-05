import { parseTicketReference, resolveReporterTicket } from '@/lib/whatsapp/ticket-routing';

function db(rows: any[]) {
  const query: any = { select: jest.fn(() => query), eq: jest.fn(() => query), in: jest.fn(() => query), limit: jest.fn(async () => ({ data: rows })) };
  return { from: () => query, query };
}
test('single active ticket routes automatically; multiple tickets need a reference', async () => {
  expect((await resolveReporterTicket(db([{ id: 'one' }]), 'reporter', '')).ticket.id).toBe('one');
  expect((await resolveReporterTicket(db([{ id: 'one' }, { id: 'two' }]), 'reporter', 'YA')).ticket).toBeNull();
});
test('explicit references are scoped to reporter and never fall back', async () => {
  const client = db([]);
  expect((await resolveReporterTicket(client, 'owner', 'YA TKT-20260905-0001')).ticket).toBeNull();
  expect(client.query.eq).toHaveBeenCalledWith('reporter_id', 'owner');
  expect(client.query.eq).toHaveBeenCalledWith('ticket_number', 'TKT-20260905-0001');
  expect(client.query.in).not.toHaveBeenCalled();
  expect(parseTicketReference('BELUM SELESAI TKT-20260905-0001').text).toBe('BELUM SELESAI');
  expect(parseTicketReference('TKT-invalid').invalid).toBe(true);
});
