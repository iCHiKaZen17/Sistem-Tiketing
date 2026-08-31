import { createAdminClient } from '@/lib/supabase/server';

export interface ReportSummary {
  total_tickets: number;
  by_status: Record<string, number>;
  by_app: Record<string, number>;
  by_staff: Record<string, number>;
  avg_first_response_minutes: number;
  avg_resolution_minutes: number;
  top_apps: Array<{ app_name: string; count: number }>;
}

export class ReportService {
  /**
   * Generates summary metrics for a given date range.
   */
  static async getSummary(dateFrom: string, dateTo: string): Promise<ReportSummary> {
    const supabase = createAdminClient();

    const { data: tickets, error } = await supabase
      .from('tickets')
      .select('*, reporters(name), users!assigned_to(full_name)')
      .gte('created_at', dateFrom)
      .lte('created_at', dateTo);

    if (error) {
      throw new Error(`Gagal mengambil data laporan: ${error.message}`);
    }

    const list = tickets || [];
    const byStatus: Record<string, number> = { OPEN: 0, IN_PROGRESS: 0, RESOLVED: 0, CLOSED: 0 };
    const byApp: Record<string, number> = {};
    const byStaff: Record<string, number> = {};

    let totalFrtMinutes = 0;
    let frtCount = 0;

    let totalResolutionMinutes = 0;
    let resolutionCount = 0;

    for (const t of list) {
      // By Status
      byStatus[t.status] = (byStatus[t.status] || 0) + 1;

      // By App
      const appName = t.app_name || 'Lainnya';
      byApp[appName] = (byApp[appName] || 0) + 1;

      // By Staff
      const staffName = t.users?.full_name || 'Belum di-assign';
      byStaff[staffName] = (byStaff[staffName] || 0) + 1;

      // FRT calculation
      if (t.first_assigned_at && t.created_at) {
        const frtMs = new Date(t.first_assigned_at).getTime() - new Date(t.created_at).getTime();
        totalFrtMinutes += Math.max(0, Math.floor(frtMs / 60000));
        frtCount++;
      }

      // Resolution time calculation
      if (t.resolved_at && t.created_at) {
        const resMs = new Date(t.resolved_at).getTime() - new Date(t.created_at).getTime();
        totalResolutionMinutes += Math.max(0, Math.floor(resMs / 60000));
        resolutionCount++;
      }
    }

    const topApps = Object.entries(byApp)
      .map(([app_name, count]) => ({ app_name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      total_tickets: list.length,
      by_status: byStatus,
      by_app: byApp,
      by_staff: byStaff,
      avg_first_response_minutes: frtCount > 0 ? Math.round(totalFrtMinutes / frtCount) : 0,
      avg_resolution_minutes: resolutionCount > 0 ? Math.round(totalResolutionMinutes / resolutionCount) : 0,
      top_apps: topApps,
    };
  }

  /**
   * Generates CSV format report for a given date range.
   */
  static async exportCsv(dateFrom: string, dateTo: string): Promise<string> {
    const supabase = createAdminClient();

    const { data: tickets } = await supabase
      .from('tickets')
      .select('*, reporters(name), users!assigned_to(full_name)')
      .gte('created_at', dateFrom)
      .lte('created_at', dateTo)
      .order('created_at', { ascending: false });

    const header = [
      'Nomor Tiket',
      'Pelapor',
      'Aplikasi',
      'Status',
      'Staff',
      'Waktu Masuk',
      'Waktu Resolved',
      'Catatan Resolusi',
    ].join(',');

    const rows = (tickets || []).map((t) => {
      const escapeCsv = (str: string | null | undefined) => {
        const safe = /^[=+\-@]/.test(str || '') ? `'${str}` : (str || '');
        return `"${safe.replace(/"/g, '""')}"`;
      };
      return [
        escapeCsv(t.ticket_number),
        escapeCsv(t.reporters?.name),
        escapeCsv(t.app_name),
        escapeCsv(t.status),
        escapeCsv(t.users?.full_name),
        escapeCsv(t.created_at),
        escapeCsv(t.resolved_at),
        escapeCsv(t.resolution_note),
      ].join(',');
    });

    return [header, ...rows].join('\n');
  }
}
