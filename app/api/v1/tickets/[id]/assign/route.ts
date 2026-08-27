import { NextRequest, NextResponse } from 'next/server';
import { TicketService } from '@/lib/tickets/ticket-service';
import { assignStaffSchema } from '@/lib/utils/validation';
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
    const validated = assignStaffSchema.parse(body);

    const ticket = await TicketService.assignStaff({
      ticket_id: params.id,
      staff_id: validated.staff_id,
      assigned_by_id: currentUser.id,
      assigned_by_label: currentUser.full_name,
      assigned_by_role: currentUser.role,
      reason: validated.reason,
    });

    return NextResponse.json(ticket, { status: 200 });
  } catch (err: any) {
    const status = err.message.includes('Akses ditolak') ? 403 : 400;
    return createErrorResponse('ASSIGNMENT_FAILED', err.message || 'Gagal menugaskan staff', status);
  }
}
