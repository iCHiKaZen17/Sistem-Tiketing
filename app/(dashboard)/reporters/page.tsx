'use client';

import React, { useState, useEffect } from 'react';
import { ErrorMessage } from '@/components/ui/error-message';

interface Reporter {
  id: string;
  phone: string;
  name: string;
  is_active: boolean;
  created_at: string;
}

export default function ReporterManagementPage() {
  const [reporters, setReporters] = useState<Reporter[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [createLoading, setCreateLoading] = useState(false);

  const fetchReporters = async () => {
    try {
      const res = await fetch(`/api/v1/reporters?search=${encodeURIComponent(search)}`);
      const data = await res.json();
      if (res.ok && Array.isArray(data.data)) {
        setReporters(data.data);
      }
    } catch {
      // Ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReporters();
  }, [search]);

  const handleCreateReporter = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/v1/reporters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Gagal menambahkan pelapor');

      setPhone('');
      setName('');
      fetchReporters();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setCreateLoading(false);
    }
  };

  const toggleReporterStatus = async (id: string, currentActive: boolean) => {
    try {
      await fetch(`/api/v1/reporters/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !currentActive }),
      });
      fetchReporters();
    } catch {
      // Ignore
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Manajemen Pelapor WA (Karyawan)</h1>
        <p className="mt-1 text-sm text-slate-500">Kelola daftar nomor WhatsApp karyawan yang diizinkan menyampaikan kendala aplikasi.</p>
      </div>

      <ErrorMessage message={error} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Create Reporter Form */}
        <div className="rounded-xl bg-white p-6 shadow-sm border border-slate-200 lg:col-span-1 h-fit">
          <h2 className="text-lg font-bold text-slate-900 mb-4">Daftarkan Pelapor Baru</h2>
          <form onSubmit={handleCreateReporter} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700">Nomor WhatsApp HP</label>
              <input
                type="text"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="cth: 6285155401156"
                className="mt-1 block w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none"
              />
              <span className="text-[11px] text-slate-400 mt-1 block">Gunakan kode negara (62...) tanpa tanda '+'</span>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700">Nama Pelapor / Karyawan</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="cth: Zen Setiawan"
                className="mt-1 block w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={createLoading}
              className="w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-500 transition-colors"
            >
              {createLoading ? 'Menyimpan...' : 'Daftarkan Pelapor WA'}
            </button>
          </form>
        </div>

        {/* Reporters Table List */}
        <div className="rounded-xl bg-white shadow-sm border border-slate-200 lg:col-span-2 overflow-hidden flex flex-col">
          <div className="p-4 border-b border-slate-200 bg-slate-50 flex flex-col sm:flex-row items-center justify-between gap-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700">Pelapor WhatsApp Terdaftar</h2>
            <div className="w-full sm:w-64">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari nama atau nomor..."
                className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-900 focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>

          {loading ? (
            <div className="p-8 text-center text-sm text-slate-500">Memuat daftar pelapor...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Nama Pelapor</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Nomor WA</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Status Access</th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {reporters.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-8 text-center text-sm text-slate-500">Belum ada pelapor WA terdaftar.</td>
                    </tr>
                  ) : (
                    reporters.map((r) => (
                      <tr key={r.id} className="hover:bg-slate-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <p className="text-sm font-semibold text-slate-900">{r.name}</p>
                          <p className="text-[11px] text-slate-400">Terdaftar {new Date(r.created_at).toLocaleDateString('id-ID')}</p>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-blue-600">
                          +{r.phone}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${r.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                            {r.is_active ? 'Aktif' : 'Di-blokir'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <button
                            onClick={() => toggleReporterStatus(r.id, r.is_active)}
                            className={`text-xs font-semibold hover:underline ${r.is_active ? 'text-red-600' : 'text-emerald-600'}`}
                          >
                            {r.is_active ? 'Blokir WA' : 'Aktifkan Access'}
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
