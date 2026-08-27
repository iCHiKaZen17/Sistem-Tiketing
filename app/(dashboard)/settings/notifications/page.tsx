'use client';

import React, { useState, useEffect } from 'react';
import { NotificationPreferences } from '@/lib/types/notification';

export default function NotificationPreferencesPage() {
  const [prefs, setPrefs] = useState<NotificationPreferences>({
    user_id: 'user-1',
    new_unassigned_ticket: true,
    ticket_assigned_to_me: true,
    new_message_on_my_ticket: true,
    stale_ticket_reminder: true,
    updated_at: new Date().toISOString(),
  });
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const savedUser = localStorage.getItem('user');
    const userId = savedUser ? JSON.parse(savedUser).id : 'user-1';

    fetch(`/api/v1/notifications/preferences?user_id=${userId}`)
      .then((res) => res.json())
      .then((data) => {
        if (data && data.user_id) setPrefs(data);
      })
      .catch(() => {});
  }, []);

  const handleToggle = (key: keyof NotificationPreferences) => {
    setPrefs((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setSaved(false);

    try {
      await fetch('/api/v1/notifications/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(prefs),
      });
      setSaved(true);
    } catch {
      // Ignore
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Preferensi Notifikasi</h1>
        <p className="mt-1 text-sm text-slate-500">Atur pengiriman notifikasi pemberitahuan tiket untuk akun Anda.</p>
      </div>

      {saved && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
          Preferensi notifikasi berhasil diperbarui!
        </div>
      )}

      <form onSubmit={handleSave} className="rounded-xl bg-white p-6 shadow-sm border border-slate-200 space-y-6">
        <div className="space-y-4">
          <label className="flex items-center justify-between cursor-pointer">
            <div>
              <span className="text-sm font-semibold text-slate-900 block">Tiket Baru Belum Di-assign</span>
              <span className="text-xs text-slate-500 block">Pemberitahuan saat ada tiket baru masuk tanpa petugas</span>
            </div>
            <input
              type="checkbox"
              checked={prefs.new_unassigned_ticket}
              onChange={() => handleToggle('new_unassigned_ticket')}
              className="h-5 w-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
          </label>

          <hr className="border-slate-100" />

          <label className="flex items-center justify-between cursor-pointer">
            <div>
              <span className="text-sm font-semibold text-slate-900 block">Tiket Di-assign Kepada Saya</span>
              <span className="text-xs text-slate-500 block">Pemberitahuan saat Supervisor menugaskan tiket kepada Anda</span>
            </div>
            <input
              type="checkbox"
              checked={prefs.ticket_assigned_to_me}
              onChange={() => handleToggle('ticket_assigned_to_me')}
              className="h-5 w-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
          </label>

          <hr className="border-slate-100" />

          <label className="flex items-center justify-between cursor-pointer">
            <div>
              <span className="text-sm font-semibold text-slate-900 block">Pesan Baru Pada Tiket Saya</span>
              <span className="text-xs text-slate-500 block">Pemberitahuan saat ada balasan baru dari pelapor pada tiket Anda</span>
            </div>
            <input
              type="checkbox"
              checked={prefs.new_message_on_my_ticket}
              onChange={() => handleToggle('new_message_on_my_ticket')}
              className="h-5 w-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
          </label>

          <hr className="border-slate-100" />

          <label className="flex items-center justify-between cursor-pointer">
            <div>
              <span className="text-sm font-semibold text-slate-900 block">Pengingat Tiket Stagnan</span>
              <span className="text-xs text-slate-500 block">Pengingat tiket IN PROGRESS tanpa aktivitas &gt; 4 jam kerja</span>
            </div>
            <input
              type="checkbox"
              checked={prefs.stale_ticket_reminder}
              onChange={() => handleToggle('stale_ticket_reminder')}
              className="h-5 w-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
          </label>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 transition-colors"
        >
          {loading ? 'Menyimpan...' : 'Simpan Perubahan'}
        </button>
      </form>
    </div>
  );
}
