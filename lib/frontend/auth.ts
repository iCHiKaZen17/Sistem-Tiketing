import { AuthenticatedUser } from '@/lib/types/user';

/**
 * Get current authenticated user from localStorage.
 */
export function getCurrentUser(): AuthenticatedUser | null {
  if (typeof window === 'undefined') return null;
  try {
    const saved = localStorage.getItem('user');
    if (saved) return JSON.parse(saved);
  } catch {
    // ignore
  }
  return null;
}

/**
 * Build headers with user data for API calls.
 * The server uses this to identify the caller for RBAC enforcement.
 */
export function authHeaders(): Record<string, string> {
  const user = getCurrentUser();
  if (!user) return {};
  return { 'x-user-data': JSON.stringify(user) };
}
