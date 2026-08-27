import { AttachmentService } from '@/lib/attachments/attachment-service';

describe('Tasks 5-10: Backend Core Services Tests', () => {
  describe('AttachmentService Validation', () => {
    it('validates allowed image formats under 5MB', () => {
      const validJpg = AttachmentService.validateAttachment('image/jpeg', 2 * 1024 * 1024);
      expect(validJpg.valid).toBe(true);
      expect(validJpg.category).toBe('IMAGE');

      const oversizedJpg = AttachmentService.validateAttachment('image/jpeg', 6 * 1024 * 1024);
      expect(oversizedJpg.valid).toBe(false);
      expect(oversizedJpg.error).toContain('melebihi batas');
    });

    it('validates allowed document formats under 10MB', () => {
      const validPdf = AttachmentService.validateAttachment('application/pdf', 8 * 1024 * 1024);
      expect(validPdf.valid).toBe(true);
      expect(validPdf.category).toBe('DOCUMENT');

      const invalidType = AttachmentService.validateAttachment('application/zip', 1024);
      expect(invalidType.valid).toBe(false);
      expect(invalidType.error).toContain('tidak didukung');
    });
  });
});
