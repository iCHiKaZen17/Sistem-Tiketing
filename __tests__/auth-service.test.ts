import { isSupervisor, isStaff, assertSupervisor } from '@/lib/auth/rbac';
import { canAccessTicket } from '@/lib/auth/ticket-access';
import { AuthenticatedUser } from '@/lib/types/user';

describe('Task 3: Auth & RBAC Tests', () => {
  const supervisorUser: AuthenticatedUser = {
    id: 'sup-123',
    username: 'supervisor1',
    full_name: 'Super Visor',
    role: 'SUPERVISOR',
  };

  const staffUser: AuthenticatedUser = {
    id: 'staff-456',
    username: 'staff1',
    full_name: 'Staff One',
    role: 'STAFF',
  };

  describe('RBAC Helpers', () => {
    it('identifies supervisor and staff roles correctly', () => {
      expect(isSupervisor(supervisorUser)).toBe(true);
      expect(isStaff(supervisorUser)).toBe(false);

      expect(isStaff(staffUser)).toBe(true);
      expect(isSupervisor(staffUser)).toBe(false);
    });

    it('asserts supervisor role and throws 403 error for non-supervisors', () => {
      expect(() => assertSupervisor(supervisorUser)).not.toThrow();
      expect(() => assertSupervisor(staffUser)).toThrow('Akses ditolak');
    });
  });

  describe('Ticket Access Control (canAccessTicket)', () => {
    it('Supervisor has access to all tickets', () => {
      expect(canAccessTicket(supervisorUser, { assigned_to: 'other-user' })).toBe(true);
      expect(canAccessTicket(supervisorUser, { assigned_to: null })).toBe(true);
    });

    it('Staff can access unassigned tickets or tickets assigned to them', () => {
      expect(canAccessTicket(staffUser, { assigned_to: null })).toBe(true);
      expect(canAccessTicket(staffUser, { assigned_to: 'staff-456' })).toBe(true);
    });

    it('Staff cannot access tickets assigned to another staff member', () => {
      expect(canAccessTicket(staffUser, { assigned_to: 'other-staff-789' })).toBe(false);
    });
  });
});
