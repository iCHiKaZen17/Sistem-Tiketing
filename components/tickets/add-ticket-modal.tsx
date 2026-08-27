'use client';

import React, { useState } from 'react';
import { Modal } from '@/components/ui/modal';
import { authHeaders } from '@/lib/frontend/auth';

interface AddTicketModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function AddTicketModal({ isOpen, onClose, onSuccess }: AddTicketModalProps) {
  const [reporterPhone, setReporterPhone] = useState('');
  const [reporterName, setReporterName] = useState('');
  const [appName, setAppName] = useState('');
  const [errorDesc, setErrorDesc] = useState('');
  const [reproSteps, setReproSteps] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!reporterPhone.trim() || !reporterName.trim()) {
      setError('Nomor telepon dan nama pelapor wajib diisi.');
      return;
    }

    if (reporterPhone.replace(/[^0-9]/g, '').length < 8) {
      setError('Nomor telepon minimal 8 digit.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/v1/tickets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders(),
        },
        body: JSON.stringify({
          reporter_phone: reporterPhone,
          reporter_name: reporterName,
          app_name: appName || undefined,
          error_desc: errorDesc || undefined,
          repro_steps: reproSteps || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Gagal membuat tiket');
      }

      // Reset form
      setReporterPhone('');
      setReporterName('');
      setAppName('');
      setErrorDesc('');
      setReproSteps('');
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setReporterPhone('');
      setReporterName('');
      setAppName('');
      setErrorDesc('');
      setReproSteps('');
      setError(null);
      onClose();
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Tambah Tiket Manual">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700 border border-red-200">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700">
              Nomor Telepon Pelapor <span className="text-red-500">*</span>
            </label>
            <input
              type="tel"
              value={reporterPhone}
              onChange={(e) => setReporterPhone(e.target.value)}
              placeholder="0812xxxxxxx"
              className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">
              Nama Pelapor <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={reporterName}
              onChange={(e) => setReporterName(e.target.value)}
              placeholder="Nama pelapor"
              className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              required
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700">Aplikasi Terkait</label>
          <input
            type="text"
            value={appName}
            onChange={(e) => setAppName(e.target.value)}
            placeholder="Contoh: Sistem Akuntansi, POS, dll"
            className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700">Deskripsi Error / Kendala</label>
          <textarea
            rows={3}
            value={errorDesc}
            onChange={(e) => setErrorDesc(e.target.value)}
            placeholder="Jelaskan error atau kendala yang dialami..."
            className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700">Langkah-langkah Reproduksi</label>
          <textarea
            rows={3}
            value={reproSteps}
            onChange={(e) => setReproSteps(e.target.value)}
            placeholder="1. Buka aplikasi&#10;2. Klik menu...&#10;3. Error muncul..."
            className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={handleClose}
            disabled={loading}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-colors"
          >
            Batal
          </button>
          <button
            type="submit"
            disabled={loading || !reporterPhone.trim() || !reporterName.trim()}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Membuat...' : 'Buat Tiket'}
          </button>
        </div>
      </form>
    </Modal>
  );
}