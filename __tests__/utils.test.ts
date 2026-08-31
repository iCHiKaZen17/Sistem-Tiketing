import * as fc from 'fast-check';
import { formatTicketNumber } from '@/lib/utils/ticket-number';
import { isWorkingHour, calculateWorkingMinutes } from '@/lib/utils/working-hours';
import { resolveTicketSchema } from '@/lib/utils/validation';

describe('Task 2 Utilities & Property Tests', () => {
  describe('Ticket Number Generation (Property Test)', () => {
    it('Property 1 (partial): Ticket number format TKT-YYYYMMDD-NNNN is always valid', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.date({ min: new Date(2020, 0, 1), max: new Date(2099, 11, 31) }),
          fc.integer({ min: 1, max: 9999 }),
          async (date, seq) => {
            const formattedDate = date.toISOString().slice(0, 10).replace(/-/g, '');
            const ticketNumber = formatTicketNumber(formattedDate, seq);
            
            expect(ticketNumber).toMatch(/^TKT-\d{8}-\d{4}$/);
          }
        )
      );
    });

  });

  describe('Working Hours Calculation', () => {
    it('correctly identifies working hours (Mon-Fri 08:00-17:00)', () => {
      const monWorking = new Date(2024, 11, 16, 10, 0); // Monday 10:00 AM
      const monOffHours = new Date(2024, 11, 16, 18, 0); // Monday 6:00 PM
      const sunday = new Date(2024, 11, 15, 10, 0);      // Sunday 10:00 AM

      expect(isWorkingHour(monWorking)).toBe(true);
      expect(isWorkingHour(monOffHours)).toBe(false);
      expect(isWorkingHour(sunday)).toBe(false);
    });

    it('calculates working minutes correctly', () => {
      const start = new Date(2024, 11, 16, 9, 0);  // Monday 09:00
      const end = new Date(2024, 11, 16, 10, 30);  // Monday 10:30
      expect(calculateWorkingMinutes(start, end)).toBe(90);
    });
  });

  describe('Validation Schemas', () => {
    it('validates resolution notes properly', () => {
      expect(resolveTicketSchema.safeParse({ resolution_note: 'Short' }).success).toBe(false);
      expect(
        resolveTicketSchema.safeParse({
          resolution_note: 'Masalah sudah diselesaikan dengan me-restart service server.',
        }).success
      ).toBe(true);
    });
  });
});
