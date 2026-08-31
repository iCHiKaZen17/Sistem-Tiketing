import { NextRequest, NextResponse } from 'next/server';
import { TicketService } from '@/lib/tickets/ticket-service';
import { createErrorResponse } from '@/lib/utils/error-response';
import { getAuthenticatedUser } from '@/lib/auth/get-user';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const currentUser = await getAuthenticatedUser(request);
    if (!currentUser) {
      return createErrorResponse('UNAUTHORIZED', 'Tidak terautentikasi.', 401);
    }
    if (currentUser.role !== 'SUPERVISOR') {
      return createErrorResponse('FORBIDDEN', 'Hanya Supervisor yang dapat menutup tiket.', 403);
    }

    const body = await request.json().catch(() => ({}));

    const ticket = await TicketService.closeTicket({
      ticket_id: params.id,
      actor_id: currentUser.id,
      actor_label: currentUser.full_name,
      actor_role: currentUser.role,
      reason: body.reason || undefined,
    });

    return NextResponse.json(ticket, { status: 200 });
  } catch (err: any) {
    const status = err.message.includes('Akses ditolak') || err.message.includes('diperbolehkan') ? 403 : 400;
    return createErrorResponse('CLOSE_FAILED', err.message || 'Gagal menutup tiket', status);
  }
}
