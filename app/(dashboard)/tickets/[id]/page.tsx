'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { StatusBadge } from '@/components/ui/badge';
import { ErrorMessage } from '@/components/ui/error-message';
import { TicketDetail, TicketStatus } from '@/lib/types/ticket';
import { User } from '@/lib/types/user';
import { authHeaders, getCurrentUser } from '@/lib/frontend/auth';

export default function TicketDetailPage({ params }: { params: { id: string } }) {
  const [ticket, setTicket] = useState<TicketDetail | null>(null);
  const [activeStaffList, setActiveStaffList] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentUser, setCurrentUserState] = useState<ReturnType<typeof getCurrentUser>>(null);

  // Assignment Form State
  const [selectedStaff, setSelectedStaff] = useState('');
  const [assignReason, setAssignReason] = useState('');
  const [assignLoading, setAssignLoading] = useState(false);

  // Resolution Form State
  const [resolutionNote, setResolutionNote] = useState('');
  const [resolveLoading, setResolveLoading] = useState(false);

  // Close/Reopen State
  const [closeLoading, setCloseLoading] = useState(false);
  const [reopenLoading, setReopenLoading] = useState(false);

  useEffect(() => {
    setCurrentUserState(getCurrentUser());
  }, []);

  const fetchTicketDetail = async () => {
    try {
      const url = `/api/v1/tickets/${params.id}?_=${Date.now()}`;
      const res = await fetch(url, {
        headers: authHeaders(),
        cache: 'no-store',
      });
      const data = await res.json();
      if (res.ok) {
        setTicket(data);
      } else {
        setError(data.message || 'Tiket tidak ditemukan');
      }
    } catch {
      setError('Gagal memuat detail tiket');
    } finally {
      setLoading(false);
    }
  };

  const fetchStaffList = async () => {
    try {
      const res = await fetch(`/api/v1/users?_=${Date.now()}`, { cache: 'no-store' });
      const data = await res.json();
      if (res.ok && Array.isArray(data)) {
        setActiveStaffList(data.filter((u: User) => u.is_active));
      }
    } catch {
      // Ignore fallback
    }
  };

  useEffect(() => {
    fetchTicketDetail();
    fetchStaffList();
  }, [params.id]);

  const handleAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStaff) return;

    setAssignLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/tickets/${params.id}/assign`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders(),
        },
        body: JSON.stringify({ staff_id: selectedStaff, reason: assignReason }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Gagal menugaskan staff');

      setSelectedStaff('');
      setAssignReason('');
      await fetchTicketDetail();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setAssignLoading(false);
    }
  };

  const handleResolve = async (e: React.FormEvent) => {
    e.preventDefault();
    if (resolutionNote.trim().length < 10) {
      setError('Catatan resolusi minimal 10 karakter.');
      return;
    }

    setResolveLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/tickets/${params.id}/resolve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders(),
        },
        body: JSON.stringify({ resolution_note: resolutionNote }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Gagal menyelesaikan tiket');

      setResolutionNote('');
      await fetchTicketDetail();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setResolveLoading(false);
    }
  };

  const handleClose = async () => {
    setCloseLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/tickets/${params.id}/close`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders(),
        },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Gagal menutup tiket');

      await fetchTicketDetail();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setCloseLoading(false);
    }
  };

  const handleReopen = async () => {
    setReopenLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/tickets/${params.id}/reopen`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders(),
        },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Gagal membuka kembali tiket');

      await fetchTicketDetail();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setReopenLoading(false);
    }
  };

  const isSupervisor = currentUser?.role === 'SUPERVISOR';
  const canAssign = isSupervisor && (ticket?.status === 'OPEN' || ticket?.status === 'IN_PROGRESS');
  const canResolve = ticket?.status === 'IN_PROGRESS';
  const canClose = isSupervisor && ticket && ticket.status !== 'CLOSED';
  const canReopen = isSupervisor && ticket?.status === 'CLOSED';

  if (loading) {
    return <div className="p-8 text-center text-slate-500">Memuat detail tiket...</div>;
  }

  if (!ticket) {
    return (
      <div className="space-y-4">
        <ErrorMessage message={error || 'Tiket tidak ditemukan'} />
        <Link href="/tickets" className="text-blue-600 font-medium">&larr; Kembali ke Antrian Tiket</Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Header & Breadcrumb */}
      <div className="flex items-center justify-between">
        <Link href="/tickets" className="text-sm font-semibold text-blue-600 hover:text-blue-800">
          &larr; Kembali ke Antrian Tiket
        </Link>
        <StatusBadge status={ticket.status as TicketStatus} />
      </div>

      <ErrorMessage message={error} />

      {/* Ticket Overview Card */}
      <div className="rounded-xl bg-white p-6 shadow-sm border border-slate-200 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-4 gap-2">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{ticket.ticket_number}</h1>
            <p className="text-sm text-slate-500">Dibuat pada {new Date(ticket.created_at).toLocaleString('id-ID')}</p>
          </div>
          <div className="text-left sm:text-right">
            <span className="text-xs text-slate-400 block uppercase tracking-wider font-semibold">Petugas Penanggung Jawab</span>
            <span className="text-sm font-semibold text-slate-800">{ticket.assigned_to_name || 'Belum Ditugaskan'}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Informasi Pelapor</h3>
            <p className="mt-1 text-base font-semibold text-slate-900">{ticket.reporter_name}</p>
            <p className="text-sm text-slate-500">WA: {ticket.reporter_phone}</p>
          </div>
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Aplikasi Terkait</h3>
            <p className="mt-1 text-base font-semibold text-slate-900">{ticket.app_name || 'Tidak Diberitahukan'}</p>
          </div>
        </div>
      </div>

      {/* Action Forms Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Assign / Reassign Staff Form - Only Supervisors, only OPEN/IN_PROGRESS */}
        {canAssign && (
          <div className="rounded-xl bg-white p-6 shadow-sm border border-slate-200">
            <h3 className="text-lg font-bold text-slate-900 mb-4">Penugasan Staff</h3>
            <form onSubmit={handleAssign} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700">Pilih Staff Aktif</label>
                <select
                  value={selectedStaff}
                  onChange={(e) => setSelectedStaff(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="">-- Pilih Staff --</option>
                  {activeStaffList.filter((s) => s.role === 'STAFF').map((s) => (
                    <option key={s.id} value={s.id}>{s.full_name} ({s.username})</option>
                  ))}
                </select>
              </div>

              {ticket.assigned_to && (
                <div>
                  <label className="block text-sm font-medium text-slate-700">Alasan Pengalihan (Reassignment)</label>
                  <input
                    type="text"
                    value={assignReason}
                    onChange={(e) => setAssignReason(e.target.value)}
                    placeholder="Contoh: Bebas beban kerja / spesialis modul"
                    className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              )}

              <button
                type="submit"
                disabled={assignLoading || !selectedStaff}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 disabled:opacity-50 transition-colors"
              >
                {assignLoading ? 'Menyimpan...' : ticket.assigned_to ? 'Alihkan Petugas' : 'Tugaskan Staff'}
              </button>
            </form>
          </div>
        )}

        {/* Resolve Ticket Form - Only for IN_PROGRESS tickets */}
        <div className="rounded-xl bg-white p-6 shadow-sm border border-slate-200">
          <h3 className="text-lg font-bold text-slate-900 mb-4">Resolusi Kendala</h3>
          {ticket.status === 'RESOLVED' || ticket.status === 'CLOSED' ? (
            <div className="rounded-lg bg-slate-50 p-4 border border-slate-200">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Catatan Resolusi Terdaftar</span>
              <p className="mt-1 text-sm text-slate-800 italic">"{ticket.resolution_note || 'Tidak ada catatan'}"</p>
            </div>
          ) : canResolve ? (
            <form onSubmit={handleResolve} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700">Catatan Resolusi Penanganan (Min. 10 Karakter)</label>
                <textarea
                  rows={3}
                  value={resolutionNote}
                  onChange={(e) => setResolutionNote(e.target.value)}
                  placeholder="Jelaskan tindakan perbaikan yang telah dilakukan..."
                  className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <button
                type="submit"
                disabled={resolveLoading || resolutionNote.trim().length < 10}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-500 disabled:opacity-50 transition-colors"
              >
                {resolveLoading ? 'Memproses...' : 'Tandai Tiket Selesai (Resolve)'}
              </button>
            </form>
          ) : (
            <div className="rounded-lg bg-slate-50 p-4 border border-slate-200">
              <p className="text-sm text-slate-500 italic">
                {ticket.status === 'OPEN'
                  ? 'Tiket belum ditugaskan ke staff. Resolusi tersedia setelah tiket dalam status IN_PROGRESS.'
                  : 'Tiket belum dalam status yang dapat diselesaikan.'}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Close / Reopen Actions */}
      {(canClose || canReopen) && (
        <div className="rounded-xl bg-white p-6 shadow-sm border border-slate-200">
          <h3 className="text-lg font-bold text-slate-900 mb-4">Tindakan Tambahan</h3>
          <div className="flex gap-3">
            {canClose && (
              <button
                onClick={handleClose}
                disabled={closeLoading}
                className="rounded-lg bg-slate-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-500 disabled:opacity-50 transition-colors"
              >
                {closeLoading ? 'Menutup...' : 'Tutup Tiket (Close)'}
              </button>
            )}
            {canReopen && (
              <button
                onClick={handleReopen}
                disabled={reopenLoading}
                className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-amber-500 disabled:opacity-50 transition-colors"
              >
                {reopenLoading ? 'Membuka...' : 'Buka Kembali Tiket (Reopen)'}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Timeline Audit History */}
      <div className="rounded-xl bg-white p-6 shadow-sm border border-slate-200 space-y-4">
        <h3 className="text-lg font-bold text-slate-900">Riwayat Kronologis & Percakapan</h3>
        <div className="space-y-4 pt-2">
          {ticket.history.length === 0 ? (
            <p className="text-sm text-slate-500 italic">Belum ada riwayat percakapan.</p>
          ) : (
            ticket.history.map((entry) => (
              <div key={entry.id} className="flex gap-4 border-l-2 border-slate-200 pl-4 py-1">
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                      {entry.actor_label || entry.entry_type}
                    </span>
                    <span className="text-xs text-slate-400">
                      {new Date(entry.created_at).toLocaleString('id-ID')}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-slate-800 whitespace-pre-wrap">{entry.content}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
