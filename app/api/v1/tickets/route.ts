import { NextRequest, NextResponse } from 'next/server';
import { TicketService } from '@/lib/tickets/ticket-service';
import { createErrorResponse } from '@/lib/utils/error-response';
import { ticketFilterSchema } from '@/lib/utils/validation';
import { getAuthenticatedUser } from '@/lib/auth/get-user';

export async function GET(request: NextRequest) {
  try {
    const currentUser = getAuthenticatedUser(request);
    const searchParams = Object.fromEntries(request.nextUrl.searchParams.entries());
    const filter = ticketFilterSchema.parse(searchParams);

    const result = await TicketService.listTickets(filter, currentUser);
    return NextResponse.json(result, { status: 200 });
  } catch (err: any) {
    return createErrorResponse('FETCH_TICKETS_FAILED', err.message || 'Gagal mengambil tiket', 400);
  }
}
