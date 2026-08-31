import { NextRequest, NextResponse } from 'next/server';
import { ReportService } from '@/lib/reports/report-service';
import { createErrorResponse } from '@/lib/utils/error-response';
import { parseReportRange } from '@/lib/reports/date-range';
import { getRedisClient } from '@/lib/cache/redis-client';

export async function GET(request: NextRequest) {
  try {
    const { dateFrom, dateTo } = parseReportRange(request.nextUrl.searchParams.get('from'), request.nextUrl.searchParams.get('to'));
    const redis = getRedisClient();
    const cacheKey = `report:summary:${dateFrom}:${dateTo}`;
    if (redis) {
      try {
        const cached = await redis.get(cacheKey);
        if (cached) return NextResponse.json(cached, { headers: { 'X-Cache': 'HIT' } });
      } catch { /* Report remains available if Redis is down. */ }
    }
    const summary = await ReportService.getSummary(dateFrom, dateTo);
    if (redis) try { await redis.set(cacheKey, summary, { ex: 30 }); } catch {}
    return NextResponse.json(summary, { status: 200, headers: { 'X-Cache': 'MISS' } });
  } catch (err: any) {
    return createErrorResponse('REPORT_SUMMARY_FAILED', err.message || 'Gagal mengambil laporan', 400);
  }
}
