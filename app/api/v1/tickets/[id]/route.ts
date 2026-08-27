import { NextRequest, NextResponse } from 'next/server';
import { TicketService } from '@/lib/tickets/ticket-service';
import { createErrorResponse } from '@/lib/utils/error-response';
import { getAuthenticatedUser } from '@/lib/auth/get-user';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const currentUser = getAuthenticatedUser(request);
    const detail = await TicketService.getTicketDetail(params.id, currentUser);
    return NextResponse.json(detail, { status: 200 });
  } catch (err: any) {
    const status = err.message.includes('Akses ditolak') ? 403 : 404;
    return createErrorResponse('TICKET_NOT_FOUND', err.message || 'Tiket tidak ditemukan', status);
  }
}
