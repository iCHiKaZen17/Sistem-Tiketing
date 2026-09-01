'use client';

import React, { useState, useEffect } from 'react';
import { ReportSummary } from '@/lib/reports/report-service';
import { ErrorMessage } from '@/components/ui/error-message';

export default function ReportsPage() {
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().slice(0, 10));

  const [summary, setSummary] = useState<ReportSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchReport = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/reports/summary?from=${dateFrom}&to=${dateTo}`);
      const data = await res.json();
      if (res.ok) {
        setSummary(data);
      } else {
        throw new Error(data.message || 'Gagal memuat laporan');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
    // Perubahan rentang tanggal baru diterapkan melalui tombol Tampilkan Laporan.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleExportCsv = () => {
    window.open(`/api/v1/reports/export?from=${dateFrom}&to=${dateTo}`, '_blank');
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Laporan Kinerja Tiket</h1>
          <p className="mt-1 text-sm text-slate-500">Statistik performa penanganan tiket kendala dan ekspor CSV.</p>
        </div>

        <button
          onClick={handleExportCsv}
          className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-500 transition-colors shrink-0"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
          </svg>
          Export File CSV
        </button>
      </div>

      {/* Date Filter Controls */}
      <div className="rounded-xl bg-white p-4 shadow-sm border border-slate-200 flex flex-col sm:flex-row items-end gap-4">
        <div className="flex-1">
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">Dari Tanggal</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none"
          />
        </div>
        <div className="flex-1">
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">Sampai Tanggal</label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none"
          />
        </div>
        <button
          onClick={fetchReport}
          className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-500 transition-colors"
        >
          Tampilkan Laporan
        </button>
      </div>

      <ErrorMessage message={error} />

      {loading ? (
        <div className="p-12 text-center text-slate-500">Memuat statistik laporan...</div>
      ) : summary ? (
        <div className="space-y-8">
          {/* Summary Metric Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="rounded-xl bg-white p-6 shadow-sm border border-slate-200">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Laporan Tiket</span>
              <p className="mt-2 text-4xl font-extrabold text-slate-900">{summary.total_tickets}</p>
            </div>
            <div className="rounded-xl bg-white p-6 shadow-sm border border-slate-200">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Rata-rata First Response (FRT)</span>
              <p className="mt-2 text-4xl font-extrabold text-blue-600">{summary.avg_first_response_minutes} <span className="text-sm font-normal text-slate-500">menit</span></p>
            </div>
            <div className="rounded-xl bg-white p-6 shadow-sm border border-slate-200">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Rata-rata Waktu Resolusi</span>
              <p className="mt-2 text-4xl font-extrabold text-emerald-600">{summary.avg_resolution_minutes} <span className="text-sm font-normal text-slate-500">menit</span></p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <section className="rounded-xl bg-white p-6 shadow-sm border border-slate-200">
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700">Tiket per Status</h2>
              <dl className="mt-4 space-y-3">
                {Object.entries(summary.by_status).map(([status, count]) => (
                  <div key={status} className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <dt className="text-sm text-slate-600">{status.replace('_', ' ')}</dt>
                    <dd className="font-bold text-slate-900">{count}</dd>
                  </div>
                ))}
              </dl>
            </section>

            <section className="rounded-xl bg-white p-6 shadow-sm border border-slate-200">
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700">Tiket per Staff</h2>
              <dl className="mt-4 space-y-3">
                {Object.entries(summary.by_staff).length === 0 ? (
                  <div className="text-sm text-slate-500">Belum ada data Staff pada periode ini.</div>
                ) : Object.entries(summary.by_staff).map(([staff, count]) => (
                  <div key={staff} className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <dt className="text-sm text-slate-600">{staff}</dt>
                    <dd className="font-bold text-slate-900">{count}</dd>
                  </div>
                ))}
              </dl>
            </section>
          </div>

          {/* Top Apps Table */}
          <div className="rounded-xl bg-white shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-200 bg-slate-50">
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700">Top 10 Aplikasi Kendala Terbanyak</h2>
            </div>
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Peringkat</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Nama Aplikasi</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Jumlah Tiket</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {summary.top_apps.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-6 py-8 text-center text-sm text-slate-500">Tidak ada data tiket pada rentang tanggal ini.</td>
                  </tr>
                ) : (
                  summary.top_apps.map((app, idx) => (
                    <tr key={app.app_name} className="hover:bg-slate-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-slate-500">#{idx + 1}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-slate-900">{app.app_name}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-blue-600 text-right">{app.count} tiket</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}
