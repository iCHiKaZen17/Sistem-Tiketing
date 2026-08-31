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
      return createErrorResponse('FORBIDDEN', 'Hanya Supervisor yang diperbolehkan membuka kembali tiket.', 403);
    }

    const body = await request.json().catch(() => ({}));

    const ticket = await TicketService.updateStatus({
      ticket_id: params.id,
      new_status: 'IN_PROGRESS',
      actor_id: currentUser.id,
      actor_label: currentUser.full_name,
      actor_role: currentUser.role,
      reason: body.reason || 'Tiket dibuka kembali oleh Supervisor',
    });

    return NextResponse.json(ticket, { status: 200 });
  } catch (err: any) {
    const status = err.message.includes('Akses ditolak') || err.message.includes('diperbolehkan') ? 403 : 400;
    return createErrorResponse('REOPEN_FAILED', err.message || 'Gagal membuka kembali tiket', status);
  }
}
