import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: any }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // 1. Ambil data user saat ini dari Supabase
  const { data: { user } } = await supabase.auth.getUser();
  const { pathname } = request.nextUrl;

  // 2. Logika Proteksi: Jika TIDAK ADA user dan mencoba akses halaman selain /login
  // (Kita abaikan /api karena sudah di-handle di middleware.ts utama)
  if (!user && !pathname.startsWith('/login') && !pathname.startsWith('/api')) {
    // Lempar kembali ke halaman login
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  // 3. Logika UX: Jika ADA user (sudah login) tapi malah mencoba akses halaman /login
  if (user && pathname.startsWith('/login')) {
    // Arahkan langsung ke dashboard/tickets agar tidak perlu login 2 kali
    const url = request.nextUrl.clone();
    url.pathname = '/tickets'; // Ubah sesuai URL dashboard utamamu
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}