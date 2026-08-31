import { NextRequest, NextResponse } from 'next/server';
import { ReportService } from '@/lib/reports/report-service';
import { createErrorResponse } from '@/lib/utils/error-response';
import { parseReportRange } from '@/lib/reports/date-range';

export async function GET(request: NextRequest) {
  try {
    const { dateFrom, dateTo } = parseReportRange(request.nextUrl.searchParams.get('from'), request.nextUrl.searchParams.get('to'));

    const csvContent = await ReportService.exportCsv(dateFrom, dateTo);

    const dateFormatted = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const filename = `report-${dateFormatted}.csv`;

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (err: any) {
    return createErrorResponse('EXPORT_FAILED', err.message || 'Gagal mengunduh CSV laporan', 400);
  }
}
