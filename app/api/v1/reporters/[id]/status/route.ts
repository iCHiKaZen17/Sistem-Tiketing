import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { createErrorResponse } from '@/lib/utils/error-response';
import { z } from 'zod';

const updateStatusSchema = z.object({
  is_active: z.boolean(),
});

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await request.json();
    const { is_active } = updateStatusSchema.parse(body);

    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from('reporters')
      .update({ is_active })
      .eq('id', params.id)
      .select('*')
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    return createErrorResponse('UPDATE_REPORTER_STATUS_FAILED', error.message || 'Gagal merubah status pelapor', 400);
  }
}
