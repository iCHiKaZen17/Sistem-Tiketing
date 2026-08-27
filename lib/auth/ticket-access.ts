import { AuthenticatedUser } from '@/lib/types/user';
import { Ticket } from '@/lib/types/ticket';

/**
 * Checks if a user has access to a specific ticket.
 * - Supervisor has access to all tickets.
 * - Staff can only access tickets assigned to them or unassigned tickets (assigned_to == null).
 */
export function canAccessTicket(
  user: AuthenticatedUser,
  ticket: Pick<Ticket, 'assigned_to'>
): boolean {
  if (user.role === 'SUPERVISOR') {
    return true;
  }

  if (user.role === 'STAFF') {
    return ticket.assigned_to === null || ticket.assigned_to === undefined || ticket.assigned_to === user.id;
  }

  return false;
}
