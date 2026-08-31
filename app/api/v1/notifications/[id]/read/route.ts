import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth/get-user';
import { createAdminClient } from '@/lib/supabase/server';

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const user = await getAuthenticatedUser(request);
  if (!user) return NextResponse.json({ message: 'Sesi tidak valid.' }, { status: 401 });
  const { data, error } = await createAdminClient().from('notifications')
    .update({ is_read: true }).eq('id', params.id).eq('user_id', user.id).select('id').maybeSingle();
  if (error) return NextResponse.json({ message: error.message }, { status: 400 });
  if (!data) return NextResponse.json({ message: 'Notifikasi tidak ditemukan.' }, { status: 404 });
  return NextResponse.json({ status: 'marked_read' });
}
