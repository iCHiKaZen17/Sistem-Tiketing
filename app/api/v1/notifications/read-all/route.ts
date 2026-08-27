import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { createErrorResponse } from '@/lib/utils/error-response';

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    if (!body.user_id) {
      return createErrorResponse('MISSING_USER_ID', 'Field user_id wajib diisi', 400);
    }

    const supabase = createAdminClient();
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', body.user_id)
      .eq('is_read', false);

    if (error) {
      return createErrorResponse('MARK_READ_ALL_FAILED', error.message, 400);
    }

    return NextResponse.json({ status: 'all_marked_read' }, { status: 200 });
  } catch (err: any) {
    return createErrorResponse('SERVER_ERROR', err.message, 500);
  }
}
