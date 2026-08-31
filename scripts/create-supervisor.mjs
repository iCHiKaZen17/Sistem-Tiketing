import { createClient } from '@supabase/supabase-js';
import { randomBytes, scrypt as nodeScrypt } from 'node:crypto';
import { promisify } from 'node:util';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const username = process.env.BOOTSTRAP_SUPERVISOR_USERNAME?.trim();
const password = process.env.BOOTSTRAP_SUPERVISOR_PASSWORD;
const fullName = process.env.BOOTSTRAP_SUPERVISOR_NAME?.trim();

if (!url || !serviceRoleKey || !username || !password || !fullName) {
  throw new Error('Isi NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, BOOTSTRAP_SUPERVISOR_USERNAME, BOOTSTRAP_SUPERVISOR_PASSWORD, dan BOOTSTRAP_SUPERVISOR_NAME.');
}
if (password.length < 10) throw new Error('Password minimal 10 karakter.');

const salt = randomBytes(16).toString('hex');
const derived = await promisify(nodeScrypt)(password, salt, 64);
const passwordHash = `scrypt$${salt}$${Buffer.from(derived).toString('hex')}`;
const supabase = createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
const { data, error } = await supabase.from('users').insert({
  username,
  password_hash: passwordHash,
  full_name: fullName,
  role: 'SUPERVISOR',
  is_active: true,
}).select('id, username, full_name, role').single();

if (error) throw new Error(`Gagal membuat Supervisor: ${error.message}`);
console.log(`Supervisor ${data.username} berhasil dibuat (${data.id}).`);
