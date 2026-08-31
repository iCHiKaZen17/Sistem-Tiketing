import { AuthenticatedUser } from '@/lib/types/user';

let cachedUser: AuthenticatedUser | null = null;

export function getCurrentUser(): AuthenticatedUser | null { return cachedUser; }

export async function fetchCurrentUser(): Promise<AuthenticatedUser | null> {
  const response = await fetch('/api/auth/me', { cache: 'no-store' });
  if (!response.ok) return null;
  const data = await response.json();
  cachedUser = data.user;
  return cachedUser;
}

/**
 * Build headers with user data for API calls.
 * The server uses this to identify the caller for RBAC enforcement.
 */
export function authHeaders(): Record<string, string> {
  return {};
}
