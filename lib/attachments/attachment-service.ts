import { createAdminClient } from '@/lib/supabase/server';
import { AttachmentType, TicketAttachment } from '@/lib/types/ticket';

export class AttachmentService {
  private static ALLOWED_TYPES: Record<string, { category: AttachmentType; maxSize: number }> = {
    'image/jpeg': { category: 'IMAGE', maxSize: 5 * 1024 * 1024 },
    'image/png': { category: 'IMAGE', maxSize: 5 * 1024 * 1024 },
    'image/gif': { category: 'IMAGE', maxSize: 5 * 1024 * 1024 },
    'application/pdf': { category: 'DOCUMENT', maxSize: 10 * 1024 * 1024 },
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': {
      category: 'DOCUMENT',
      maxSize: 10 * 1024 * 1024,
    },
    'application/msword': { category: 'DOCUMENT', maxSize: 10 * 1024 * 1024 },
  };

  /**
   * Validates attachment mime type and file size in bytes.
   */
  static validateAttachment(mimeType: string, sizeBytes: number): { valid: boolean; error?: string; category?: AttachmentType } {
    const config = this.ALLOWED_TYPES[mimeType.toLowerCase()];
    if (!config) {
      return {
        valid: false,
        error: 'Tipe file tidak didukung. Lampiran hanya mendukung format JPG, PNG, GIF (<=5MB) dan PDF, DOCX (<=10MB).',
      };
    }

    if (sizeBytes > config.maxSize) {
      const maxMb = config.maxSize / (1024 * 1024);
      return {
        valid: false,
        error: `Ukuran file melebihi batas maksimum ${maxMb}MB.`,
      };
    }

    return { valid: true, category: config.category };
  }

  static hasValidSignature(mimeType: string, bytes: Uint8Array): boolean {
    const starts = (...signature: number[]) => signature.every((value, index) => bytes[index] === value);
    if (mimeType === 'image/jpeg') return starts(0xff, 0xd8, 0xff);
    if (mimeType === 'image/png') return starts(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
    if (mimeType === 'image/gif') return new TextDecoder().decode(bytes.slice(0, 6)) === 'GIF87a' || new TextDecoder().decode(bytes.slice(0, 6)) === 'GIF89a';
    if (mimeType === 'application/pdf') return new TextDecoder().decode(bytes.slice(0, 5)) === '%PDF-';
    if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') return starts(0x50, 0x4b, 0x03, 0x04);
    if (mimeType === 'application/msword') return starts(0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1);
    return false;
  }

  /**
   * Save attachment record to Supabase DB table `ticket_attachments`.
   */
  static async saveAttachment(params: {
    ticket_id: string;
    history_id?: string;
    file_type: AttachmentType;
    filename: string;
    mime_type: string;
    file_size: number;
    storage_path: string;
    wa_media_id?: string;
  }): Promise<TicketAttachment> {
    const supabase = createAdminClient();

    const { data: attachment, error } = await supabase
      .from('ticket_attachments')
      .insert({
        ticket_id: params.ticket_id,
        history_id: params.history_id || null,
        file_type: params.file_type,
        filename: params.filename,
        mime_type: params.mime_type,
        file_size: params.file_size,
        storage_path: params.storage_path,
        wa_media_id: params.wa_media_id || null,
      })
      .select('*')
      .single();

    if (error || !attachment) {
      throw new Error(`Gagal menyimpan lampiran: ${error?.message}`);
    }

    return attachment;
  }
}
