import { NextRequest, NextResponse } from 'next/server';
import { TicketService } from '@/lib/tickets/ticket-service';
import { createErrorResponse } from '@/lib/utils/error-response';
import { ticketFilterSchema } from '@/lib/utils/validation';

export async function GET(request: NextRequest) {
  try {
    const searchParams = Object.fromEntries(request.nextUrl.searchParams.entries());
    const filter = ticketFilterSchema.parse(searchParams);

    const result = await TicketService.listTickets(filter);
    return NextResponse.json(result, { status: 200 });
  } catch (err: any) {
    return createErrorResponse('FETCH_TICKETS_FAILED', err.message || 'Gagal mengambil tiket', 400);
  }
}
