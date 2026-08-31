import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth/get-user';
import { TicketService } from '@/lib/tickets/ticket-service';
import { AttachmentService } from '@/lib/attachments/attachment-service';
import { createAdminClient } from '@/lib/supabase/server';
import { createErrorResponse } from '@/lib/utils/error-response';

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const user = await getAuthenticatedUser(request);
  if (!user) return createErrorResponse('UNAUTHORIZED', 'Sesi tidak valid.', 401);
  try {
    await TicketService.getTicketDetail(params.id, user);
    const form = await request.formData();
    const file = form.get('file');
    if (!(file instanceof File)) return createErrorResponse('FILE_REQUIRED', 'File wajib dipilih.', 400);
    const validation = AttachmentService.validateAttachment(file.type, file.size);
    if (!validation.valid || !validation.category) return createErrorResponse('INVALID_ATTACHMENT', validation.error || 'File tidak valid.', 400);

    const bytes = new Uint8Array(await file.arrayBuffer());
    if (!AttachmentService.hasValidSignature(file.type, bytes)) return createErrorResponse('INVALID_FILE_CONTENT', 'Isi file tidak sesuai tipe yang dinyatakan.', 400);
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = `${params.id}/${crypto.randomUUID()}-${safeName}`;
    const supabase = createAdminClient();
    const { error: uploadError } = await supabase.storage.from('ticket-attachments').upload(path, bytes, { contentType: file.type });
    if (uploadError) throw new Error(uploadError.message);
    try {
      const attachment = await AttachmentService.saveAttachment({
        ticket_id: params.id, file_type: validation.category, filename: file.name,
        mime_type: file.type, file_size: file.size, storage_path: path,
      });
      await TicketService.appendMessage({ ticket_id: params.id, entry_type: 'SYSTEM_EVENT', content: `Lampiran ${file.name} ditambahkan.`, actor_id: user.id, actor_label: user.full_name });
      return NextResponse.json(attachment, { status: 201 });
    } catch (error) {
      await supabase.storage.from('ticket-attachments').remove([path]);
      throw error;
    }
  } catch (error: any) {
    return createErrorResponse('UPLOAD_FAILED', error.message || 'Gagal mengunggah lampiran.', 500);
  }
}
