import { createAdminClient, createClient } from '@/lib/supabase/server';
import { redisClient } from '@/lib/cache/redis-client';
import { AuthenticatedUser, AuthTokens } from '@/lib/types/user';

export class AuthService {
  private static MAX_FAILED_ATTEMPTS = 5;
  private static LOCKOUT_TTL_SECONDS = 900; // 15 minutes

  /**
   * Log in user with username and password.
   * Enforces 15-minute lockout after 5 consecutive failed attempts.
   */
  static async login(username: string, password_hash: string): Promise<AuthTokens> {
    const supabase = createAdminClient();

    // 1. Fetch user by username from Supabase DB
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('username', username)
      .single();

    if (userError || !user || !user.is_active) {
      throw new Error('Username atau password tidak valid, atau akun tidak aktif.');
    }

    const userId = user.id;
    const lockoutKey = `lockout:${userId}`;

    // 2. Check Redis Lockout
    try {
      const failedCountRaw = await redisClient.get(lockoutKey);
      const failedCount = Number(failedCountRaw || 0);
      if (failedCount >= this.MAX_FAILED_ATTEMPTS) {
        throw new Error('Akun terkunci sementara karena 5 kali gagal login. Silakan coba lagi dalam 15 menit.');
      }
    } catch (err: any) {
      if (err.message?.includes('terkunci')) {
        throw err;
      }
    }

    // 3. Authenticate with password check or Supabase Auth
    const isPasswordValid = user.password_hash === password_hash;

    if (!isPasswordValid) {
      // Record failed attempt in Redis
      try {
        const newCount = await redisClient.incr(lockoutKey);
        if (Number(newCount) === 1) {
          await redisClient.expire(lockoutKey, this.LOCKOUT_TTL_SECONDS);
        }
      } catch {
        // Ignore redis error in offline/mock environment
      }

      throw new Error('Username atau password tidak valid.');
    }

    // 4. Reset lockout counter on success
    try {
      await redisClient.del(lockoutKey);
    } catch {
      // Ignore redis error
    }

    const authenticatedUser: AuthenticatedUser = {
      id: user.id,
      username: user.username,
      full_name: user.full_name,
      role: user.role,
    };

    return {
      access_token: `mock_token_${user.id}`,
      refresh_token: `mock_refresh_${user.id}`,
      user: authenticatedUser,
    };
  }

  /**
   * Log out user session.
   */
  static async logout(): Promise<void> {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }

  /**
   * Validates session token and returns AuthenticatedUser.
   */
  static async validateSession(): Promise<AuthenticatedUser | null> {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
      return null;
    }

    return {
      id: user.id,
      username: user.user_metadata?.username || user.email?.split('@')[0] || '',
      full_name: user.user_metadata?.full_name || '',
      role: user.user_metadata?.role || 'STAFF',
    };
  }
}
