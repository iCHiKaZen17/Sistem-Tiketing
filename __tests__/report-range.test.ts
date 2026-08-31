import { parseReportRange } from '@/lib/reports/date-range';

describe('report range', () => {
  it('includes the full end day', () => {
    expect(parseReportRange('2026-08-01', '2026-08-31').dateTo).toContain('23:59:59.999Z');
  });
  it('rejects more than 365 days and inverted ranges', () => {
    expect(() => parseReportRange('2024-01-01', '2026-01-01')).toThrow('365');
    expect(() => parseReportRange('2026-09-01', '2026-08-01')).toThrow('tidak valid');
  });
});
