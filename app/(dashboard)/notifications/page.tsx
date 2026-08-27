'use client';

import React, { useState, useEffect } from 'react';
import { NotificationEvent } from '@/lib/types/notification';

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<NotificationEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchNotifications = async () => {
    try {
      const savedUser = localStorage.getItem('user');
      const userId = savedUser ? JSON.parse(savedUser).id : 'user-1';

      const res = await fetch(`/api/v1/notifications?user_id=${userId}`);
      const data = await res.json();
      if (res.ok && Array.isArray(data)) {
        setNotifications(data);
      }
    } catch {
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      const savedUser = localStorage.getItem('user');
      const userId = savedUser ? JSON.parse(savedUser).id : 'user-1';

      await fetch('/api/v1/notifications/read-all', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId }),
      });

      setNotifications([]);
    } catch {
      // Ignore
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Panel Notifikasi</h1>
          <p className="mt-1 text-sm text-slate-500">Pemberitahuan tiket belum dibaca milik Anda.</p>
        </div>

        {notifications.length > 0 && (
          <button
            onClick={handleMarkAllRead}
            className="rounded-lg bg-slate-200 px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-300 transition-colors"
          >
            Tandai Semua Dibaca
          </button>
        )}
      </div>

      <div className="rounded-xl bg-white shadow-sm border border-slate-200 divide-y divide-slate-100 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm text-slate-500">Memuat notifikasi...</div>
        ) : notifications.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">Tidak ada notifikasi baru.</div>
        ) : (
          notifications.map((n) => (
            <div key={n.id} className="p-4 flex items-start gap-4 hover:bg-slate-50 transition-colors">
              <div className="rounded-full bg-blue-100 p-2 text-blue-600 shrink-0">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31" />
                </svg>
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-slate-900">{n.event_type}</p>
                <pre className="mt-1 text-xs text-slate-600 font-sans whitespace-pre-wrap">{JSON.stringify(n.payload, null, 2)}</pre>
                <span className="mt-2 block text-[11px] text-slate-400">{new Date(n.created_at).toLocaleString('id-ID')}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
