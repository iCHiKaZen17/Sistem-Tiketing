import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthenticatedUser } from '@/lib/auth/get-user';
import { hashPassword } from '@/lib/auth/password';
import { revokeAllUserSessions } from '@/lib/auth/session';
import { createAdminClient } from '@/lib/supabase/server';
import { getErrorMessage } from '@/lib/utils/error-response';
import { userPasswordSchema } from '@/lib/utils/validation';

const schema = z.object({ password: userPasswordSchema });

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const actor = await getAuthenticatedUser(request);
  if (actor?.role !== 'SUPERVISOR') return NextResponse.json({ message: 'Hanya Supervisor yang dapat mereset password.' }, { status: 403 });
  try {
    const { password } = schema.parse(await request.json());
    const { data, error } = await createAdminClient().from('users').update({
      password_hash: await hashPassword(password), failed_login_count: 0, locked_until: null,
    }).eq('id', params.id).select('id').maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ message: 'User tidak ditemukan.' }, { status: 404 });
    await revokeAllUserSessions(params.id);
    return NextResponse.json({ status: 'password_reset' });
  } catch (error: unknown) {
    return NextResponse.json({ message: getErrorMessage(error, 'Password tidak valid.') }, { status: 400 });
  }
}
