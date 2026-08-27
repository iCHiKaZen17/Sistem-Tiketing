import { NextRequest, NextResponse } from 'next/server';
import { TicketService } from '@/lib/tickets/ticket-service';
import { assignStaffSchema } from '@/lib/utils/validation';
import { createErrorResponse } from '@/lib/utils/error-response';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const validated = assignStaffSchema.parse(body);

    const ticket = await TicketService.assignStaff({
      ticket_id: params.id,
      staff_id: validated.staff_id,
      reason: validated.reason,
    });

    return NextResponse.json(ticket, { status: 200 });
  } catch (err: any) {
    return createErrorResponse('ASSIGNMENT_FAILED', err.message || 'Gagal menugaskan staff', 400);
  }
}
