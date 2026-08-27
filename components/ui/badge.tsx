import React from 'react';
import { TicketStatus } from '@/lib/types/ticket';

interface BadgeProps {
  status: TicketStatus;
}

export function StatusBadge({ status }: BadgeProps) {
  const styles: Record<TicketStatus, { bg: string; label: string }> = {
    OPEN: { bg: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20', label: 'OPEN' },
    IN_PROGRESS: { bg: 'bg-amber-500/10 text-amber-600 border-amber-500/20', label: 'IN PROGRESS' },
    RESOLVED: { bg: 'bg-blue-500/10 text-blue-600 border-blue-500/20', label: 'RESOLVED' },
    CLOSED: { bg: 'bg-slate-500/10 text-slate-600 border-slate-500/20', label: 'CLOSED' },
  };

  const config = styles[status] || styles.OPEN;

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider transition-colors ${config.bg}`}
    >
      {config.label}
    </span>
  );
}
