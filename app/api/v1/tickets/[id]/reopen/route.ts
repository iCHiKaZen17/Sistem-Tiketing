import { NextRequest, NextResponse } from 'next/server';
import { TicketService } from '@/lib/tickets/ticket-service';
import { createErrorResponse } from '@/lib/utils/error-response';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();

    const ticket = await TicketService.updateStatus({
      ticket_id: params.id,
      new_status: 'IN_PROGRESS',
      actor_role: body.actor_role || 'SUPERVISOR',
      reason: body.reason || 'Tiket dibuka kembali oleh Supervisor',
    });

    return NextResponse.json(ticket, { status: 200 });
  } catch (err: any) {
    return createErrorResponse('REOPEN_FAILED', err.message || 'Gagal membuka kembali tiket', 400);
  }
}
