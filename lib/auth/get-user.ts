import { NextRequest } from 'next/server';
import { AuthenticatedUser } from '@/lib/types/user';
import { SESSION_COOKIE, verifySessionToken } from './session';
import { createAdminClient } from '@/lib/supabase/server';

/**
 * Validate the signed, HTTP-only session cookie and return its user identity.
 */
export async function getAuthenticatedUser(request: NextRequest): Promise<AuthenticatedUser | null> {
  const sessionUser = await verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value);
  if (!sessionUser) return null;
  const { data: user } = await createAdminClient()
    .from('users')
    .select('id, username, full_name, role, is_active')
    .eq('id', sessionUser.id)
    .maybeSingle();
  if (!user?.is_active) return null;
  return { id: user.id, username: user.username, full_name: user.full_name, role: user.role };
}
