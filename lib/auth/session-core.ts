import { AuthenticatedUser } from '@/lib/types/user';

export const SESSION_COOKIE = 'ticketing-session';
export const SESSION_TTL_SECONDS = 60 * 60 * 8;

export interface SessionPayload extends AuthenticatedUser {
  iat: number;
  exp: number;
  jti: string;
}

function encode(value: string): string {
  return Buffer.from(value).toString('base64url');
}

function decode(value: string): string {
  return Buffer.from(value, 'base64url').toString('utf8');
}

async function signature(value: string): Promise<string> {
  const secret = process.env.AUTH_SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error('AUTH_SESSION_SECRET minimal 32 karakter wajib dikonfigurasi.');
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signed = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value));
  return Buffer.from(signed).toString('base64url');
}

export async function createSessionToken(user: AuthenticatedUser): Promise<string> {
  const iat = Date.now();
  const payload: SessionPayload = { ...user, iat, exp: Math.floor(iat / 1000) + SESSION_TTL_SECONDS, jti: crypto.randomUUID() };
  const encoded = encode(JSON.stringify(payload));
  return `${encoded}.${await signature(encoded)}`;
}

export async function verifiedSessionPayload(token?: string | null): Promise<SessionPayload | null> {
  if (!token) return null;
  const [encoded, supplied] = token.split('.');
  if (!encoded || !supplied || (await signature(encoded)) !== supplied) return null;
  const payload = JSON.parse(decode(encoded)) as SessionPayload;
  if (!payload.id || !payload.role || !payload.jti || !payload.iat || payload.exp <= Math.floor(Date.now() / 1000)) return null;
  return payload;
}

export async function verifySessionSignature(token?: string | null): Promise<AuthenticatedUser | null> {
  try {
    const payload = await verifiedSessionPayload(token);
    return payload ? { id: payload.id, username: payload.username, full_name: payload.full_name, role: payload.role } : null;
  } catch { return null; }
}

export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/',
  maxAge: SESSION_TTL_SECONDS,
};
