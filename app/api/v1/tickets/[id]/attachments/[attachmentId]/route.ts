import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth/get-user';
import { TicketService } from '@/lib/tickets/ticket-service';
import { createAdminClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest, { params }: { params: { id: string; attachmentId: string } }) {
  const user = await getAuthenticatedUser(request);
  if (!user) return NextResponse.json({ message: 'Sesi tidak valid.' }, { status: 401 });
  try {
    await TicketService.getTicketDetail(params.id, user);
    const supabase = createAdminClient();
    const { data: attachment } = await supabase.from('ticket_attachments').select('storage_path').eq('id', params.attachmentId).eq('ticket_id', params.id).single();
    if (!attachment) return NextResponse.json({ message: 'Lampiran tidak ditemukan.' }, { status: 404 });
    const { data, error } = await supabase.storage.from('ticket-attachments').createSignedUrl(attachment.storage_path, 60);
    if (error || !data) throw new Error(error?.message);
    return NextResponse.redirect(data.signedUrl);
  } catch (error: any) {
    return NextResponse.json({ message: error.message || 'Gagal membuka lampiran.' }, { status: 400 });
  }
}
