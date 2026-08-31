export type UserRole = 'STAFF' | 'SUPERVISOR';

export interface User {
  id: string;
  username: string;
  full_name: string;
  role: UserRole;
  is_active: boolean;
  failed_login_count: number;
  locked_until?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Reporter {
  id: string;
  phone: string;
  name: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AuthenticatedUser {
  id: string;
  username: string;
  full_name: string;
  role: UserRole;
}
