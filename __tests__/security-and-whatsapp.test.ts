import { hashPassword, verifyPassword } from '@/lib/auth/password';
import { createSessionToken, verifySessionToken } from '@/lib/auth/session';
import { parseStructuredTicketFields, parseTicketTrigger } from '@/lib/whatsapp/webhook-service';
import { verifyHmacSha256 } from '@/lib/whatsapp/signature';
import { createHmac } from 'crypto';

describe('security foundations', () => {
  it('hashes and verifies passwords without storing plaintext', async () => {
    const hash = await hashPassword('strong-password');
    expect(hash).not.toContain('strong-password');
    expect(await verifyPassword('strong-password', hash)).toBe(true);
    expect(await verifyPassword('wrong-password', hash)).toBe(false);
  });

  it('accepts signed sessions and rejects tampering', async () => {
    const token = await createSessionToken({ id: 'u1', username: 'staff', full_name: 'Staff', role: 'STAFF' });
    expect((await verifySessionToken(token))?.id).toBe('u1');
    expect(await verifySessionToken(`${token}tampered`)).toBeNull();
  });
});

describe('WhatsApp trigger and signature', () => {
  it('only creates a command for #t at the beginning', () => {
    expect(parseTicketTrigger('#t payroll error')).toBe('payroll error');
    expect(parseTicketTrigger('halo #t payroll error')).toBeNull();
    expect(parseTicketTrigger('#test')).toBeNull();
  });

  it('parses explicit structured ticket fields without guessing free text', () => {
    expect(parseStructuredTicketFields('Aplikasi: Payroll\nDeskripsi: Tidak bisa login\nLangkah: Buka aplikasi lalu login')).toEqual({
      app_name: 'Payroll', error_desc: 'Tidak bisa login', repro_steps: 'Buka aplikasi lalu login',
    });
    expect(parseStructuredTicketFields('Payroll gagal dibuka')).toEqual({ error_desc: 'Payroll gagal dibuka' });
  });

  it('verifies sha256 HMAC over the raw body', () => {
    const body = '{"message":"halo"}';
    const secret = 'office-secret';
    const signature = `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`;
    expect(verifyHmacSha256(body, signature, secret)).toBe(true);
    expect(verifyHmacSha256(`${body} `, signature, secret)).toBe(false);
  });
});
