import { NextRequest } from 'next/server';
import { AuthenticatedUser } from '@/lib/types/user';

/**
 * Extract authenticated user from request headers.
 * The frontend sends user info via x-user-data header (JSON stringified AuthenticatedUser).
 * In production, this should be replaced with proper JWT/session validation.
 */
export function getAuthenticatedUser(request: NextRequest): AuthenticatedUser | null {
  const userDataHeader = request.headers.get('x-user-data');
  if (!userDataHeader) return null;

  try {
    const user = JSON.parse(userDataHeader) as AuthenticatedUser;
    if (user && user.id && user.role) {
      return user;
    }
    return null;
  } catch {
    return null;
  }
}
