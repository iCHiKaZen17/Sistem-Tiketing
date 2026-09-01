'use client';

import React, { useState, useEffect } from 'react';
import { User, UserRole } from '@/lib/types/user';
import { ErrorMessage } from '@/components/ui/error-message';

export default function UserManagementPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<UserRole>('STAFF');
  const [createLoading, setCreateLoading] = useState(false);
  const [resetUserId, setResetUserId] = useState('');
  const [newPassword, setNewPassword] = useState('');

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/v1/users');
      const data = await res.json();
      if (res.ok && Array.isArray(data)) {
        setUsers(data);
      }
    } catch {
      // Ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/v1/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, full_name: fullName, role }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Gagal membuat user baru');

      setUsername('');
      setPassword('');
      setFullName('');
      fetchUsers();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setCreateLoading(false);
    }
  };

  const toggleUserStatus = async (userId: string, currentActive: boolean) => {
    try {
      await fetch(`/api/v1/users/${userId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !currentActive }),
      });
      fetchUsers();
    } catch {
      // Ignore
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault(); setError(null);
    const res = await fetch(`/api/v1/users/${resetUserId}/password`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: newPassword }) });
    const data = await res.json();
    if (!res.ok) return setError(data.message || 'Gagal mereset password');
    setResetUserId(''); setNewPassword('');
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Manajemen Pengguna (User)</h1>
        <p className="mt-1 text-sm text-slate-500">Kelola akun Staff & Supervisor yang memiliki akses ke dashboard.</p>
      </div>

      <ErrorMessage message={error} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Create User Form */}
        <div className="rounded-xl bg-white p-6 shadow-sm border border-slate-200 lg:col-span-1 h-fit">
          <h2 className="text-lg font-bold text-slate-900 mb-4">Tambah User Baru</h2>
          <form onSubmit={handleCreateUser} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700">Username</label>
              <input
                type="text"
                required
                minLength={3}
                maxLength={100}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="cth: budi.staff"
                className="mt-1 block w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700">Nama Lengkap</label>
              <input
                type="text"
                required
                maxLength={200}
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="cth: Budi Setiawan"
                className="mt-1 block w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700">Password</label>
              <input
                type="password"
                required
                minLength={10}
                maxLength={128}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimal 10 karakter"
                className="mt-1 block w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700">Peran / Role</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as UserRole)}
                className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none"
              >
                <option value="STAFF">STAFF</option>
                <option value="SUPERVISOR">SUPERVISOR</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={createLoading}
              className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 transition-colors"
            >
              {createLoading ? 'Menyimpan...' : 'Tambah User'}
            </button>
          </form>
        </div>

        {/* Users List Table */}
        <div className="rounded-xl bg-white shadow-sm border border-slate-200 lg:col-span-2 overflow-hidden">
          <div className="p-4 border-b border-slate-200 bg-slate-50">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700">Daftar Pengguna Terdaftar</h2>
          </div>
          {loading ? (
            <div className="p-8 text-center text-sm text-slate-500">Memuat daftar user...</div>
          ) : (
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Pengguna</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Role</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <p className="text-sm font-semibold text-slate-900">{u.full_name}</p>
                      <p className="text-xs text-slate-500">@{u.username}</p>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-bold ${u.role === 'SUPERVISOR' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${u.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                        {u.is_active ? 'Aktif' : 'Non-Aktif'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => toggleUserStatus(u.id, u.is_active)}
                        className={`text-xs font-semibold hover:underline ${u.is_active ? 'text-red-600' : 'text-emerald-600'}`}
                      >
                        {u.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                      </button>
                      <button onClick={() => setResetUserId(u.id)} className="ml-3 text-xs font-semibold text-blue-600 hover:underline">Reset Password</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {resetUserId && <form onSubmit={handleResetPassword} className="flex gap-2 border-t border-slate-200 p-4">
            <input type="password" minLength={10} maxLength={128} required value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Password baru, min. 10 karakter" className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            <button className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white">Simpan</button>
            <button type="button" onClick={() => { setResetUserId(''); setNewPassword(''); }} className="px-3 py-2 text-sm">Batal</button>
          </form>}
        </div>
      </div>
    </div>
  );
}
