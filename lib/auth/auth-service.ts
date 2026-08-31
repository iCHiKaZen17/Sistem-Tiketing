import { createAdminClient } from '@/lib/supabase/server';
import { AuthenticatedUser } from '@/lib/types/user';
import { hashPassword, isHashedPassword, verifyPassword } from './password';

export class AuthService {
  private static MAX_FAILED_ATTEMPTS = 5;
  private static LOCKOUT_TTL_SECONDS = 900; // 15 minutes

  /**
   * Log in user with username and password.
   * Enforces 15-minute lockout after 5 consecutive failed attempts.
   */
  static async login(username: string, password: string, context: { ip?: string; userAgent?: string } = {}): Promise<AuthenticatedUser> {
    const supabase = createAdminClient();

    // 1. Fetch user by username from Supabase DB
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('username', username)
      .single();

    if (userError || !user || !user.is_active) {
      await this.audit(username, 'LOGIN_FAILED', context);
      throw new Error('Username atau password tidak valid, atau akun tidak aktif.');
    }

    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      await this.audit(username, 'LOGIN_LOCKED', context, user.id);
      throw new Error('Akun terkunci sementara karena 5 kali gagal login. Silakan coba lagi dalam 15 menit.');
    }

    // 3. Authenticate with password check or Supabase Auth
    // Legacy plaintext rows are accepted once, then transparently migrated.
    const isPasswordValid = isHashedPassword(user.password_hash)
      ? await verifyPassword(password, user.password_hash)
      : user.password_hash === password;

    if (!isPasswordValid) {
      const failedCount = Number(user.failed_login_count || 0) + 1;
      await supabase.from('users').update({
        failed_login_count: failedCount,
        locked_until: failedCount >= this.MAX_FAILED_ATTEMPTS ? new Date(Date.now() + this.LOCKOUT_TTL_SECONDS * 1000).toISOString() : null,
      }).eq('id', user.id);
      await this.audit(username, failedCount >= this.MAX_FAILED_ATTEMPTS ? 'LOGIN_LOCKED' : 'LOGIN_FAILED', context, user.id);
      throw new Error('Username atau password tidak valid.');
    }

    await supabase.from('users').update({ failed_login_count: 0, locked_until: null }).eq('id', user.id);

    if (!isHashedPassword(user.password_hash)) {
      await supabase.from('users').update({ password_hash: await hashPassword(password) }).eq('id', user.id);
    }

    const authenticatedUser: AuthenticatedUser = {
      id: user.id,
      username: user.username,
      full_name: user.full_name,
      role: user.role,
    };

    await this.audit(username, 'LOGIN_SUCCEEDED', context, user.id);
    return authenticatedUser;
  }

  static async auditLogout(user: AuthenticatedUser, context: { ip?: string; userAgent?: string } = {}): Promise<void> {
    await this.audit(user.username, 'LOGOUT', context, user.id);
  }

  private static async audit(username: string, eventType: string, context: { ip?: string; userAgent?: string }, userId?: string): Promise<void> {
    try {
      await createAdminClient().from('auth_audit_logs').insert({
        user_id: userId || null,
        username: username.slice(0, 100),
        event_type: eventType,
        ip_address: context.ip?.slice(0, 100) || null,
        user_agent: context.userAgent?.slice(0, 500) || null,
      });
    } catch { /* Audit outage must not disclose or block authentication. */ }
  }
}
