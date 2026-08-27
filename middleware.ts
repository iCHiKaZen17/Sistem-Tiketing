import { updateSession } from '@/lib/supabase/middleware';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public routes
  if (
    pathname.startsWith('/api/auth/') ||
    pathname.startsWith('/api/webhook/') ||
    pathname.startsWith('/api/jobs/')
  ) {
    return NextResponse.next();
  }

  // Intercept protected API routes
  if (pathname.startsWith('/api/v1/')) {
    const response = await updateSession(request);
    
    // Check Authorization header or Auth cookie
    const authHeader = request.headers.get('Authorization');
    const hasAuthCookie = request.cookies.getAll().some((c) => c.name.includes('sb-') || c.name.includes('auth'));

    if (!authHeader && !hasAuthCookie) {
      return NextResponse.json(
        {
          code: 'UNAUTHORIZED',
          message: 'Request tidak terautentikasi. Silakan sertakan token/sesi yang valid.',
        },
        { status: 401 }
      );
    }

    return response;
  }

  return await updateSession(request);
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
