'use client';

import React, { useState, useEffect } from 'react';
import { authHeaders, getCurrentUser, fetchCurrentUser } from '@/lib/frontend/auth';

interface StaffWorkload {
  staff_id: string;
  staff_name: string;
  staff_username: string;
  open_tickets: number;
  in_progress_tickets: number;
  resolved_tickets: number;
  total_active_tickets: number;
}

export default function StaffWorkloadPage() {
  const [workload, setWorkload] = useState<StaffWorkload[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<ReturnType<typeof getCurrentUser>>(null);

  useEffect(() => {
    fetchCurrentUser().then(setCurrentUser);
  }, []);

  useEffect(() => {
    if (!currentUser) return;

    const fetchWorkload = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/v1/staff/workload?_=' + Date.now(), {
          headers: authHeaders(),
          cache: 'no-store',
        });

        if (!res.ok) {
          throw new Error('Gagal mengambil data beban kerja staff');
        }

        const data = await res.json();
        setWorkload(data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchWorkload();
  }, [currentUser]);

  if (currentUser?.role !== 'SUPERVISOR') {
    return (
      <div className="space-y-6">
        <div className="rounded-xl bg-white p-8 shadow-sm border border-slate-200 text-center">
          <p className="text-slate-600">Anda tidak memiliki akses ke halaman ini. Hanya Supervisor yang dapat melihat beban kerja staff.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Staff Workload</h1>
        <p className="mt-1 text-sm text-slate-500">Pantau jumlah tiket yang sedang ditangani oleh setiap anggota staff.</p>
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 p-4">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="rounded-xl bg-white p-8 shadow-sm border border-slate-200 text-center">
          <p className="text-slate-500">Memuat Staff Workload...</p>
        </div>
      ) : workload.length === 0 ? (
        <div className="rounded-xl bg-white p-8 shadow-sm border border-slate-200 text-center">
          <p className="text-slate-600">Tidak ada staff aktif dalam sistem.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {workload.map((staff) => (
            <div
              key={staff.staff_id}
              className="rounded-xl bg-white p-6 shadow-sm border border-slate-200 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">{staff.staff_name}</h3>
                  <p className="text-xs text-slate-500">@{staff.staff_username}</p>
                </div>
                <div className="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold bg-blue-100 text-blue-700">
                  {staff.total_active_tickets}
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-orange-50 rounded-lg border border-orange-200">
                  <span className="text-sm font-medium text-orange-900">Terbuka (OPEN)</span>
                  <span className="text-lg font-bold text-orange-600">{staff.open_tickets}</span>
                </div>

                <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <span className="text-sm font-medium text-blue-900">Sedang Diproses</span>
                  <span className="text-lg font-bold text-blue-600">{staff.in_progress_tickets}</span>
                </div>

                <div className="flex items-center justify-between p-3 bg-purple-50 rounded-lg border border-purple-200">
                  <span className="text-sm font-medium text-purple-900">Menunggu Konfirmasi</span>
                  <span className="text-lg font-bold text-purple-600">{staff.resolved_tickets}</span>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-slate-200">
                <p className="text-xs text-slate-600">
                  Total tiket aktif: <span className="font-semibold text-slate-900">{staff.total_active_tickets}</span>
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
