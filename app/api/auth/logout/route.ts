import { NextRequest, NextResponse } from 'next/server';
import { revokeSessionToken, SESSION_COOKIE, sessionCookieOptions } from '@/lib/auth/session';
import { verifySessionToken } from '@/lib/auth/session';
import { AuthService } from '@/lib/auth/auth-service';
import { requestIp } from '@/lib/cache/rate-limit';

export async function POST(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const user = await verifySessionToken(token);
  if (user) await AuthService.auditLogout(user, { ip: requestIp(request.headers), userAgent: request.headers.get('user-agent') || undefined });
  await revokeSessionToken(token);
  const response = NextResponse.json({ status: 'logged_out' }, { status: 200 });
  response.cookies.set(SESSION_COOKIE, '', { ...sessionCookieOptions, maxAge: 0 });
  return response;
}
