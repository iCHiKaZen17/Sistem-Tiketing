import { NextRequest, NextResponse } from 'next/server';
import { TicketService } from '@/lib/tickets/ticket-service';
import { createErrorResponse } from '@/lib/utils/error-response';
import { ticketFilterSchema } from '@/lib/utils/validation';
import { getAuthenticatedUser } from '@/lib/auth/get-user';
import { createAdminClient } from '@/lib/supabase/server';
import { z } from 'zod';

const createManualTicketSchema = z.object({
  reporter_phone: z.string().min(8, 'Nomor telepon minimal 8 digit'),
  reporter_name: z.string().min(2, 'Nama minimal 2 karakter'),
  app_name: z.string().max(200).optional(),
  error_desc: z.string().optional(),
  repro_steps: z.string().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const currentUser = await getAuthenticatedUser(request);
    if (!currentUser) return createErrorResponse('UNAUTHORIZED', 'Sesi tidak valid.', 401);
    const searchParams = Object.fromEntries(request.nextUrl.searchParams.entries());
    const filter = ticketFilterSchema.parse(searchParams);

    const result = await TicketService.listTickets(filter, currentUser);
    return NextResponse.json(result, { status: 200 });
  } catch (err: any) {
    return createErrorResponse('FETCH_TICKETS_FAILED', err.message || 'Gagal mengambil tiket', 400);
  }
}

export async function POST(request: NextRequest) {
  try {
    const currentUser = await getAuthenticatedUser(request);
    if (!currentUser || currentUser.role !== 'SUPERVISOR') {
      return createErrorResponse('FORBIDDEN', 'Hanya Supervisor yang dapat membuat tiket manual.', 403);
    }

    const body = await request.json();
    const validated = createManualTicketSchema.parse(body);

    const supabase = createAdminClient();
    const cleanPhone = validated.reporter_phone.replace(/[^0-9]/g, '');

    // Upsert reporter by phone
    const { data: reporter, error: reporterError } = await supabase
      .from('reporters')
      .upsert(
        {
          phone: cleanPhone,
          name: validated.reporter_name,
          is_active: true,
        },
        { onConflict: 'phone' }
      )
      .select('id')
      .single();

    if (reporterError || !reporter) {
      throw new Error('Gagal membuat/mencari pelapor: ' + (reporterError?.message || 'Unknown error'));
    }

    // Create ticket via service
    const ticket = await TicketService.createTicket({
      reporter_id: reporter.id,
      app_name: validated.app_name,
      error_desc: validated.error_desc,
      repro_steps: validated.repro_steps,
    });

    // Log manual creation in history
    await TicketService.appendMessage({
      ticket_id: ticket.id,
      entry_type: 'SYSTEM_EVENT',
      content: `Tiket dibuat secara manual oleh Supervisor ${currentUser.full_name}.`,
      actor_id: currentUser.id,
      actor_label: currentUser.full_name,
    });

    return NextResponse.json(ticket, { status: 201 });
  } catch (err: any) {
    const message = err instanceof z.ZodError
      ? err.errors.map((e: any) => e.message).join(', ')
      : err.message || 'Gagal membuat tiket';
    return createErrorResponse('CREATE_TICKET_FAILED', message, 400);
  }
}
