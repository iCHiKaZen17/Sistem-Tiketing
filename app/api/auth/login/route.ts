import { NextRequest, NextResponse } from 'next/server';
import { AuthService } from '@/lib/auth/auth-service';
import { loginSchema } from '@/lib/utils/validation';
import { createErrorResponse } from '@/lib/utils/error-response';
import { createSessionToken, SESSION_COOKIE, sessionCookieOptions } from '@/lib/auth/session';
import { checkRateLimit, requestIp } from '@/lib/cache/rate-limit';

export async function POST(request: NextRequest) {
  try {
    const rate = await checkRateLimit(`login:${requestIp(request.headers)}`, 10, 60);
    if (!rate.allowed) {
      const response = createErrorResponse('RATE_LIMITED', 'Terlalu banyak percobaan login. Coba lagi nanti.', 429);
      response.headers.set('Retry-After', String(rate.retryAfter));
      return response;
    }
    const body = await request.json();
    const validated = loginSchema.parse(body);

    const user = await AuthService.login(validated.username, validated.password, {
      ip: requestIp(request.headers),
      userAgent: request.headers.get('user-agent') || undefined,
    });
    const response = NextResponse.json({ user }, { status: 200 });
    response.cookies.set(SESSION_COOKIE, await createSessionToken(user), sessionCookieOptions);
    return response;
  } catch (err: any) {
    return createErrorResponse('LOGIN_FAILED', err.message || 'Gagal login', 401);
  }
}
