import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE, verifySessionSignature } from '@/lib/auth/session-core';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const requestId = request.headers.get('x-request-id') || crypto.randomUUID();
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-request-id', requestId);
  const next = () => NextResponse.next({ request: { headers: requestHeaders }, headers: { 'x-request-id': requestId } });

  const isPublic = pathname === '/login' || pathname === '/api/health' || pathname.startsWith('/api/auth/') || pathname.startsWith('/api/webhook/') || pathname.startsWith('/api/jobs/');
  if (isPublic) return next();

  const user = await verifySessionSignature(request.cookies.get(SESSION_COOKIE)?.value);
  if (user) {
    const supervisorOnly = ['/users', '/reporters', '/reports', '/staff-workload', '/api/v1/users', '/api/v1/reporters', '/api/v1/reports', '/api/v1/staff/workload'];
    if (user.role !== 'SUPERVISOR' && supervisorOnly.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) {
      if (pathname.startsWith('/api/')) return NextResponse.json({ code: 'FORBIDDEN', message: 'Hanya Supervisor yang dapat mengakses fitur ini.' }, { status: 403 });
      return NextResponse.redirect(new URL('/tickets', request.url));
    }
    return next();
  }

  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ code: 'UNAUTHORIZED', message: 'Sesi tidak valid atau sudah berakhir.' }, { status: 401 });
  }
  return NextResponse.redirect(new URL('/login', request.url));
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
