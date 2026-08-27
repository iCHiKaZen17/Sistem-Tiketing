import { NextRequest, NextResponse } from 'next/server';
import { TicketService } from '@/lib/tickets/ticket-service';
import { createErrorResponse } from '@/lib/utils/error-response';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const detail = await TicketService.getTicketDetail(params.id);
    return NextResponse.json(detail, { status: 200 });
  } catch (err: any) {
    return createErrorResponse('TICKET_NOT_FOUND', err.message || 'Tiket tidak ditemukan', 404);
  }
}
