import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { createUserSchema } from '@/lib/utils/validation';
import { createErrorResponse } from '@/lib/utils/error-response';
import { hashPassword } from '@/lib/auth/password';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = createAdminClient();
  const { data: users, error } = await supabase
    .from('users')
    .select('id, username, full_name, role, is_active')
    .order('full_name', { ascending: true });

  if (error) {
    return createErrorResponse('FETCH_USERS_FAILED', error.message, 400);
  }

  return NextResponse.json(users || [], { status: 200 });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = createUserSchema.parse(body);

    const supabase = createAdminClient();
    const { data: user, error } = await supabase
      .from('users')
      .insert({
        username: validated.username,
        password_hash: await hashPassword(validated.password),
        full_name: validated.full_name,
        role: validated.role,
        is_active: true,
      })
      .select('id, username, full_name, role, is_active')
      .single();

    if (error || !user) {
      return createErrorResponse('CREATE_USER_FAILED', error?.message || 'Gagal menambah user', 400);
    }

    return NextResponse.json(user, { status: 201 });
  } catch (err: any) {
    return createErrorResponse('VALIDATION_ERROR', err.message, 400);
  }
}
