import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { createErrorResponse } from '@/lib/utils/error-response';
import { getAuthenticatedUser } from '@/lib/auth/get-user';

export async function PATCH(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return createErrorResponse('UNAUTHORIZED', 'Sesi tidak valid.', 401);

    const supabase = createAdminClient();
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', user.id)
      .eq('is_read', false);

    if (error) {
      return createErrorResponse('MARK_READ_ALL_FAILED', error.message, 400);
    }

    return NextResponse.json({ status: 'all_marked_read' }, { status: 200 });
  } catch (err: any) {
    return createErrorResponse('SERVER_ERROR', err.message, 500);
  }
}
