import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { createErrorResponse } from '@/lib/utils/error-response';
import { getAuthenticatedUser } from '@/lib/auth/get-user';

export async function GET(request: NextRequest) {
  const user = await getAuthenticatedUser(request);
  if (!user) return createErrorResponse('UNAUTHORIZED', 'Sesi tidak valid.', 401);
  const userId = user.id;

  const supabase = createAdminClient();
  const { data: pref, error } = await supabase
    .from('notification_preferences')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error || !pref) {
    // Return default preferences
    return NextResponse.json({
      user_id: userId,
      new_unassigned_ticket: true,
      ticket_assigned_to_me: true,
      new_message_on_my_ticket: true,
      stale_ticket_reminder: true,
    });
  }

  return NextResponse.json(pref, { status: 200 });
}

export async function PUT(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return createErrorResponse('UNAUTHORIZED', 'Sesi tidak valid.', 401);
    const body = await request.json();

    const supabase = createAdminClient();
    const { data: pref, error } = await supabase
      .from('notification_preferences')
      .upsert({
        user_id: user.id,
        new_unassigned_ticket: body.new_unassigned_ticket ?? true,
        ticket_assigned_to_me: body.ticket_assigned_to_me ?? true,
        new_message_on_my_ticket: body.new_message_on_my_ticket ?? true,
        stale_ticket_reminder: body.stale_ticket_reminder ?? true,
        updated_at: new Date().toISOString(),
      })
      .select('*')
      .single();

    if (error) {
      return createErrorResponse('UPDATE_PREF_FAILED', error.message, 400);
    }

    return NextResponse.json(pref, { status: 200 });
  } catch (err: any) {
    return createErrorResponse('SERVER_ERROR', err.message, 500);
  }
}
