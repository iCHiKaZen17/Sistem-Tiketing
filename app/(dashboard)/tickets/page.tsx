import React from 'react';
import { TicketList } from './ticket-list';

export default function TicketsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Antrian Tiket Masuk</h1>
        <p className="mt-1 text-sm text-slate-500">Kelola dan pantau seluruh laporan kendala aplikasi dari WhatsApp.</p>
      </div>

      <TicketList />
    </div>
  );
}
