import { ReportService } from '@/lib/reports/report-service';
import * as supabaseServer from '@/lib/supabase/server';

describe('Tasks 12-14: Notification, Report, and API Service Tests', () => {
  beforeEach(() => {
    jest.spyOn(supabaseServer, 'createAdminClient').mockReturnValue({
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          gte: jest.fn().mockReturnValue({
            lte: jest.fn().mockReturnValue({
              order: jest.fn().mockResolvedValue({
                data: [
                  {
                    ticket_number: 'TKT-20241215-0001',
                    reporters: { name: 'Budi' },
                    app_name: 'App-A',
                    status: 'OPEN',
                    users: { full_name: 'Staff-1' },
                    created_at: '2024-12-15T08:00:00Z',
                    resolved_at: null,
                    resolution_note: null,
                  },
                ],
                error: null,
              }),
            }),
          }),
        }),
      }),
    } as any);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('ReportService CSV Formatting', () => {
    it('generates valid CSV header and data string', async () => {
      const csv = await ReportService.exportCsv(
        '2024-01-01T00:00:00Z',
        '2024-12-31T23:59:59Z'
      );
      expect(csv).toContain('Nomor Tiket,Pelapor,Aplikasi,Status,Staff,Waktu Masuk,Waktu Resolved,Catatan Resolusi');
      expect(csv).toContain('TKT-20241215-0001');
    });

    it('returns structured summary object', async () => {
      const summary = await ReportService.getSummary(
        '2024-01-01T00:00:00Z',
        '2024-12-31T23:59:59Z'
      );
      expect(summary).toHaveProperty('total_tickets');
      expect(summary).toHaveProperty('by_status');
      expect(summary).toHaveProperty('top_apps');
    });
  });
});
