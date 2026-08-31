import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { createErrorResponse } from '@/lib/utils/error-response';
import { getAuthenticatedUser } from '@/lib/auth/get-user';
import { revokeAllUserSessions } from '@/lib/auth/session';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const actor = await getAuthenticatedUser(request);
    if (actor?.role !== 'SUPERVISOR') return createErrorResponse('FORBIDDEN', 'Hanya Supervisor yang dapat mengubah status user.', 403);
    const body = await request.json();
    if (typeof body.is_active !== 'boolean') {
      return createErrorResponse('INVALID_BODY', 'Field is_active wajib boolean', 400);
    }

    const supabase = createAdminClient();
    const { data: user, error } = await supabase
      .from('users')
      .update({ is_active: body.is_active, updated_at: new Date().toISOString() })
      .eq('id', params.id)
      .select('id, username, full_name, role, is_active')
      .single();

    if (error || !user) {
      return createErrorResponse('UPDATE_STATUS_FAILED', error?.message || 'Gagal mengubah status user', 400);
    }
    if (!body.is_active) await revokeAllUserSessions(params.id);

    return NextResponse.json(user, { status: 200 });
  } catch (err: any) {
    return createErrorResponse('SERVER_ERROR', err.message, 500);
  }
}
