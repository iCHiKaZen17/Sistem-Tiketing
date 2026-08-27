import { NextRequest, NextResponse } from 'next/server';
import { ReportService } from '@/lib/reports/report-service';
import { createErrorResponse } from '@/lib/utils/error-response';

export async function GET(request: NextRequest) {
  try {
    const dateFrom = request.nextUrl.searchParams.get('from') || new Date(Date.now() - 30 * 86400000).toISOString();
    const dateTo = request.nextUrl.searchParams.get('to') || new Date().toISOString();

    const summary = await ReportService.getSummary(dateFrom, dateTo);
    return NextResponse.json(summary, { status: 200 });
  } catch (err: any) {
    return createErrorResponse('REPORT_SUMMARY_FAILED', err.message || 'Gagal mengambil laporan', 400);
  }
}
