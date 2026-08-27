import { NextRequest, NextResponse } from 'next/server';
import { AuthService } from '@/lib/auth/auth-service';
import { loginSchema } from '@/lib/utils/validation';
import { createErrorResponse } from '@/lib/utils/error-response';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = loginSchema.parse(body);

    const tokens = await AuthService.login(validated.username, validated.password);
    const response = NextResponse.json(tokens, { status: 200 });
    response.cookies.set('sb-access-token', tokens.access_token, {
      httpOnly: true,
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
    });
    return response;
  } catch (err: any) {
    return createErrorResponse('LOGIN_FAILED', err.message || 'Gagal login', 400);
  }
}
