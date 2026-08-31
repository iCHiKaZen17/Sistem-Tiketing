// Generated with: whatsapp-webhooks skill
// https://github.com/hookdeck/webhook-skills
import { createHmac, timingSafeEqual } from 'crypto';

export function verifyHmacSha256(rawBody: string, header: string | null, secret: string): boolean {
  const [algorithm, suppliedHex] = (header || '').split('=');
  if (algorithm !== 'sha256' || !suppliedHex || !secret) return false;
  const expected = createHmac('sha256', secret).update(rawBody).digest();
  try {
    const supplied = Buffer.from(suppliedHex, 'hex');
    return supplied.length === expected.length && timingSafeEqual(supplied, expected);
  } catch { return false; }
}
