import { NextRequest, NextResponse } from 'next/server';
import { TicketService } from '@/lib/tickets/ticket-service';
import { resolveTicketSchema } from '@/lib/utils/validation';
import { createErrorResponse } from '@/lib/utils/error-response';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const validated = resolveTicketSchema.parse(body);

    const ticket = await TicketService.resolveTicket({
      ticket_id: params.id,
      resolution_note: validated.resolution_note,
      actor_id: body.actor_id || 'system',
      actor_label: body.actor_label || 'Staff',
    });

    return NextResponse.json(ticket, { status: 200 });
  } catch (err: any) {
    return createErrorResponse('RESOLUTION_FAILED', err.message || 'Gagal menyelesaikan tiket', 400);
  }
}
