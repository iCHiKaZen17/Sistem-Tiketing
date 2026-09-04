import { normalizeWebhook } from '@/lib/whatsapp/normalizer';
import { sendWhatsAppAttachment, sendWhatsAppText } from '@/lib/whatsapp/gateway';
import { buildDeliveryRows } from '@/lib/whatsapp/outbox-service';
import { buildMediaDownloadUrl } from '@/lib/whatsapp/media-inbox-service';

describe('WhatsApp ordered text and attachment delivery', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    delete process.env.WHATSAPP_OFFICE_SEND_URL;
    delete process.env.WHATSAPP_OFFICE_API_TOKEN;
    delete process.env.WHATSAPP_OFFICE_ATTACHMENT_SEND_URL;
    delete process.env.WHATSAPP_OFFICE_ATTACHMENT_API_TOKEN;
  });

  it('builds text then attachment rows without storing binary data', () => {
    const rows = buildDeliveryRows({
      deliveryId: 'delivery-1', dedupeKey: 'ticket-1', to: '628123456789', text: 'Tiket dibuat',
      attachments: [{ attachmentId: 'attachment-1' }, { attachmentId: 'attachment-2', caption: 'Log error' }],
    });

    expect(rows.map((row) => [row.sequence_no, row.message_type])).toEqual([
      [1, 'TEXT'], [2, 'ATTACHMENT'], [3, 'ATTACHMENT'],
    ]);
    expect(JSON.stringify(rows)).not.toContain('bytes');

    const attachmentOnly = buildDeliveryRows({
      deliveryId: 'delivery-2', dedupeKey: 'attachment-only', to: '6281',
      attachments: [{ attachmentId: 'attachment-3' }],
    });
    expect(attachmentOnly[0]).toEqual(expect.objectContaining({ sequence_no: 1, message_type: 'ATTACHMENT' }));
  });

  it('uses separate endpoints for text and multipart attachment', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true });
    process.env.WHATSAPP_OFFICE_SEND_URL = 'https://gateway.test/text';
    process.env.WHATSAPP_OFFICE_ATTACHMENT_SEND_URL = 'https://gateway.test/attachment';
    process.env.WHATSAPP_OFFICE_ATTACHMENT_API_TOKEN = 'attachment-token';

    await sendWhatsAppText({ to: '6281', text: 'Halo' });
    await sendWhatsAppAttachment({
      to: '6281', filename: 'error.png', mimeType: 'image/png', bytes: new Uint8Array([1, 2]), caption: 'Bukti',
    });

    expect(global.fetch).toHaveBeenNthCalledWith(1, 'https://gateway.test/text', expect.objectContaining({
      body: JSON.stringify({ to: '6281', type: 'text', text: 'Halo' }),
    }));
    const attachmentRequest = (global.fetch as jest.Mock).mock.calls[1][1];
    expect((global.fetch as jest.Mock).mock.calls[1][0]).toBe('https://gateway.test/attachment');
    expect(attachmentRequest.headers.Authorization).toBe('Bearer attachment-token');
    expect(attachmentRequest.body).toBeInstanceOf(FormData);
    expect(attachmentRequest.body.get('to')).toBe('6281');
    expect(attachmentRequest.body.get('caption')).toBe('Bukti');
  });

  it('normalizes an inbound media caption with #t and builds a safe download URL', () => {
    expect(normalizeWebhook({
      id: 'message-1', from: '+62 812', type: 'image', caption: '#t Layar aplikasi error',
      media_id: 'media/1', filename: 'error.png', mime_type: 'image/png',
    }, 'office')).toEqual([{
      id: 'message-1', from: '62812', type: 'image', text: '#t Layar aplikasi error', timestamp: undefined,
      media: { id: 'media/1', filename: 'error.png', mimeType: 'image/png' },
    }]);
    expect(buildMediaDownloadUrl('https://gateway.test/media/{media_id}', 'media/1'))
      .toBe('https://gateway.test/media/media%2F1');
  });
});
