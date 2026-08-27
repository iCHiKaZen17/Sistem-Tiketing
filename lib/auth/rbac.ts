import { AuthenticatedUser, UserRole } from '@/lib/types/user';

export function isSupervisor(user: AuthenticatedUser | null): boolean {
  return user?.role === 'SUPERVISOR';
}

export function isStaff(user: AuthenticatedUser | null): boolean {
  return user?.role === 'STAFF';
}

export function requireRole(user: AuthenticatedUser | null, role: UserRole): boolean {
  if (!user || !user.role) return false;
  return user.role === role;
}

export function assertSupervisor(user: AuthenticatedUser | null): void {
  if (!isSupervisor(user)) {
    throw new Error('Akses ditolak: Hanya Supervisor yang diperbolehkan mengakses fitur ini.');
  }
}

export function assertStaff(user: AuthenticatedUser | null): void {
  if (!user) {
    throw new Error('Akses ditolak: Pengguna tidak terautentikasi.');
  }
}
