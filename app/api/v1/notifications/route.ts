import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { createErrorResponse } from '@/lib/utils/error-response';
import { getAuthenticatedUser } from '@/lib/auth/get-user';

export async function GET(request: NextRequest) {
  const user = await getAuthenticatedUser(request);
  if (!user) return createErrorResponse('UNAUTHORIZED', 'Sesi tidak valid.', 401);
  const userId = user.id;

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
