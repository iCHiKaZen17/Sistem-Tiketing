import { NextRequest, NextResponse } from 'next/server';
import { TicketService } from '@/lib/tickets/ticket-service';
import { resolveTicketSchema } from '@/lib/utils/validation';
import { createErrorResponse } from '@/lib/utils/error-response';
import { getAuthenticatedUser } from '@/lib/auth/get-user';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const currentUser = getAuthenticatedUser(request);
    if (!currentUser) {
      return createErrorResponse('UNAUTHORIZED', 'Tidak terautentikasi.', 401);
    }

    const body = await request.json();
    const validated = resolveTicketSchema.parse(body);

    const ticket = await TicketService.resolveTicket({
      ticket_id: params.id,
      resolution_note: validated.resolution_note,
      actor_id: currentUser.id,
      actor_label: currentUser.full_name,
    });

    return NextResponse.json(ticket, { status: 200 });
  } catch (err: any) {
    return createErrorResponse('RESOLUTION_FAILED', err.message || 'Gagal menyelesaikan tiket', 400);
  }
}
