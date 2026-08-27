import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { createErrorResponse } from '@/lib/utils/error-response';

export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get('user_id');
  if (!userId) {
    return createErrorResponse('MISSING_USER_ID', 'Parameter user_id wajib diisi', 400);
  }

  const supabase = createAdminClient();
  const { data: notifications, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .eq('is_read', false)
    .order('created_at', { ascending: false });

  if (error) {
    return createErrorResponse('FETCH_NOTIF_FAILED', error.message, 400);
  }

  return NextResponse.json(notifications || [], { status: 200 });
}
