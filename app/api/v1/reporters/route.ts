import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { createErrorResponse } from '@/lib/utils/error-response';
import { z } from 'zod';

const createReporterSchema = z.object({
  phone: z.string().min(8, 'Nomor telepon minimal 8 digit'),
  name: z.string().min(2, 'Nama minimal 2 karakter'),
});

export async function GET(request: NextRequest) {
  try {
    const supabase = createAdminClient();
    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get('search')?.trim() || '';

    let query = supabase
      .from('reporters')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false });

    if (search) {
      query = query.or(`name.ilike.%${search}%,phone.ilike.%${search}%`);
    }

    const { data, count, error } = await query;
    if (error) throw error;

    return NextResponse.json({
      data: data || [],
      total: count || 0,
    });
  } catch (error: any) {
    return createErrorResponse('FETCH_REPORTERS_FAILED', error.message || 'Gagal mengambil data pelapor', 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = createReporterSchema.parse(body);

    const cleanPhone = validated.phone.replace(/[^0-9]/g, '');

    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from('reporters')
      .upsert(
        {
          phone: cleanPhone,
          name: validated.name,
          is_active: true,
        },
        { onConflict: 'phone' }
      )
      .select('*')
      .single();

    if (error) throw error;

    return NextResponse.json(data, { status: 201 });
  } catch (error: any) {
    return createErrorResponse('CREATE_REPORTER_FAILED', error.message || 'Gagal mendaftarkan pelapor baru', 400);
  }
}
