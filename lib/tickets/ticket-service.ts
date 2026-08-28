import { createAdminClient } from '@/lib/supabase/server';
import { generateTicketNumber } from '@/lib/utils/ticket-number';
import {
  Ticket,
  TicketDetail,
  TicketFilter,
  TicketStatus,
  PaginatedResult,
  HistoryEntryType,
} from '@/lib/types/ticket';
import { AuthenticatedUser } from '@/lib/types/user';

export class TicketService {
  /**
   * Allowed status transitions state machine dictionary.
   */
  private static VALID_TRANSITIONS: Record<TicketStatus, TicketStatus[]> = {
    OPEN: ['IN_PROGRESS', 'CLOSED'],
    IN_PROGRESS: ['RESOLVED', 'CLOSED'],
    RESOLVED: ['CLOSED'],
    CLOSED: ['IN_PROGRESS'], // Only Supervisor can reopen
  };

  /**
   * Create a new ticket and initial reporter message entry in history.
   */
  static async createTicket(params: {
    reporter_id: string;
    app_name?: string;
    error_desc?: string;
    repro_steps?: string;
    wa_message_id?: string;
  }): Promise<Ticket> {
    const supabase = createAdminClient();
    const ticketNumber = await generateTicketNumber();

    // 1. Insert Ticket Row
    const { data: ticket, error: ticketError } = await supabase
      .from('tickets')
      .insert({
        ticket_number: ticketNumber,
        reporter_id: params.reporter_id,
        status: 'OPEN',
        app_name: params.app_name || null,
        error_desc: params.error_desc || null,
        repro_steps: params.repro_steps || null,
      })
      .select('*')
      .single();

    if (ticketError || !ticket) {
      throw new Error(`Gagal membuat tiket: ${ticketError?.message}`);
    }

    // 2. Insert initial Ticket History entry
    const { error: historyError } = await supabase.from('ticket_history').insert({
      ticket_id: ticket.id,
      entry_type: 'REPORTER_MESSAGE',
      content: params.error_desc || 'Laporan baru diterima dari WhatsApp.',
      wa_message_id: params.wa_message_id || null,
    });

    if (historyError) {
      console.error('Failed to record initial history entry:', historyError);
    }

    return ticket;
  }

  /**
   * Append a new message/entry to ticket history.
   */
  static async appendMessage(params: {
    ticket_id: string;
    entry_type: HistoryEntryType;
    content: string;
    actor_id?: string;
    actor_label?: string;
    metadata?: Record<string, any>;
    wa_message_id?: string;
  }): Promise<void> {
    const supabase = createAdminClient();

    // Deduplication check if wa_message_id is provided
    if (params.wa_message_id) {
      const { data: existing } = await supabase
        .from('ticket_history')
        .select('id')
        .eq('wa_message_id', params.wa_message_id)
        .maybeSingle();

      if (existing) {
        return; // Message already recorded
      }
    }

    const { error } = await supabase.from('ticket_history').insert({
      ticket_id: params.ticket_id,
      entry_type: params.entry_type,
      content: params.content,
      actor_id: params.actor_id || null,
      actor_label: params.actor_label || null,
      metadata: params.metadata || null,
      wa_message_id: params.wa_message_id || null,
    });

    if (error) {
      throw new Error(`Gagal menambah pesan riwayat: ${error.message}`);
    }
  }

  /**
   * Update ticket status with state machine enforcement.
   */
  static async updateStatus(params: {
    ticket_id: string;
    new_status: TicketStatus;
    actor_id?: string;
    actor_label?: string;
    actor_role?: 'STAFF' | 'SUPERVISOR';
    reason?: string;
  }): Promise<Ticket> {
    const supabase = createAdminClient();

    // 1. Fetch current ticket
    const { data: currentTicket, error: fetchError } = await supabase
      .from('tickets')
      .select('*')
      .eq('id', params.ticket_id)
      .single();

    if (fetchError || !currentTicket) {
      throw new Error('Tiket tidak ditemukan.');
    }

    const currentStatus: TicketStatus = currentTicket.status;

    // Check reopening permission - only Supervisor can reopen CLOSED tickets
    if (currentStatus === 'CLOSED' && params.new_status === 'IN_PROGRESS') {
      if (!params.actor_role || params.actor_role !== 'SUPERVISOR') {
        throw new Error('Hanya Supervisor yang diperbolehkan membuka kembali tiket CLOSED.');
      }
    }

    // Check State Machine Transition
    const allowed = this.VALID_TRANSITIONS[currentStatus];
    if (!allowed || !allowed.includes(params.new_status)) {
      throw new Error(`Transisi status tidak valid dari ${currentStatus} ke ${params.new_status}.`);
    }

    // Update timestamp fields
    const updates: Record<string, any> = {
      status: params.new_status,
      updated_at: new Date().toISOString(),
    };

    if (params.new_status === 'CLOSED') {
      updates.closed_at = new Date().toISOString();
    }

    const { data: updatedTicket, error: updateError } = await supabase
      .from('tickets')
      .update(updates)
      .eq('id', params.ticket_id)
      .select('*')
      .single();

    if (updateError || !updatedTicket) {
      throw new Error(`Gagal memperbarui status: ${updateError?.message}`);
    }

    // Log history
    await this.appendMessage({
      ticket_id: params.ticket_id,
      entry_type: 'STATUS_CHANGE',
      content: `Status tiket diubah dari ${currentStatus} menjadi ${params.new_status}.`,
      actor_id: params.actor_id,
      actor_label: params.actor_label,
      metadata: {
        previousStatus: currentStatus,
        newStatus: params.new_status,
        reason: params.reason || null,
      },
    });

    return updatedTicket;
  }

  /**
   * Resolve ticket with resolution note validation (10 - 2000 characters).
   * Uses updateStatus() to enforce state machine and log STATUS_CHANGE history.
   */
  static async resolveTicket(params: {
    ticket_id: string;
    resolution_note: string;
    actor_id: string;
    actor_label: string;
    actor_role?: 'STAFF' | 'SUPERVISOR';
  }): Promise<Ticket> {
    const trimmedNote = params.resolution_note.trim();
    if (trimmedNote.length < 10 || trimmedNote.length > 2000) {
      throw new Error('Catatan resolusi harus terdiri dari 10 hingga 2000 karakter.');
    }

    // 1. Validate state machine transition: only IN_PROGRESS → RESOLVED is allowed
    const ticket = await this.updateStatus({
      ticket_id: params.ticket_id,
      new_status: 'RESOLVED',
      actor_id: params.actor_id,
      actor_label: params.actor_label,
      actor_role: params.actor_role,
    });

    // 2. Update resolution_note and resolved_at fields
    const supabase = createAdminClient();
    const resolvedAt = new Date().toISOString();

    const { data: updatedTicket, error } = await supabase
      .from('tickets')
      .update({
        resolution_note: trimmedNote,
        resolved_at: resolvedAt,
      })
      .eq('id', params.ticket_id)
      .select('*')
      .single();

    if (error || !updatedTicket) {
      throw new Error(`Gagal menyelesaikan tiket: ${error?.message}`);
    }

    // 3. Record RESOLUTION_NOTE in history
    await this.appendMessage({
      ticket_id: params.ticket_id,
      entry_type: 'RESOLUTION_NOTE',
      content: trimmedNote,
      actor_id: params.actor_id,
      actor_label: params.actor_label,
    });

    return updatedTicket;
  }

  /**
   * Assign or reassign ticket to a Staff member.
   */
  static async assignStaff(params: {
    ticket_id: string;
    staff_id: string;
    assigned_by_id?: string;
    assigned_by_label?: string;
    assigned_by_role?: string;
    reason?: string;
  }): Promise<Ticket> {
    const supabase = createAdminClient();

    // RBAC: Only Supervisor can assign tickets
    if (!params.assigned_by_role || params.assigned_by_role !== 'SUPERVISOR') {
      throw new Error('Akses ditolak: Hanya Supervisor yang diperbolehkan menugaskan tiket.');
    }

    // Verify staff exists and is active
    const { data: staffUser, error: staffError } = await supabase
      .from('users')
      .select('id, full_name, is_active, role')
      .eq('id', params.staff_id)
      .single();

    if (staffError || !staffUser || !staffUser.is_active || staffUser.role !== 'STAFF') {
      throw new Error('Staff yang ditunjuk tidak ditemukan atau tidak aktif.');
    }

    const { data: ticket, error: ticketError } = await supabase
      .from('tickets')
      .select('*')
      .eq('id', params.ticket_id)
      .single();

    if (ticketError || !ticket) {
      throw new Error('Tiket tidak ditemukan.');
    }

    // Cannot assign tickets that are RESOLVED or CLOSED
    if (ticket.status === 'RESOLVED' || ticket.status === 'CLOSED') {
      throw new Error('Tiket yang sudah selesai atau ditutup tidak dapat ditugaskan.');
    }

    const isReassignment = ticket.assigned_to !== null && ticket.assigned_to !== undefined;
    if (isReassignment && (!params.reason || params.reason.trim().length === 0)) {
      throw new Error('Alasan wajib diisi saat pengalihan (reassignment) petugas.');
    }

    const now = new Date().toISOString();
    const isStatusChangingToInProgress = ticket.status === 'OPEN';
    const updates: Record<string, any> = {
      assigned_to: params.staff_id,
      status: isStatusChangingToInProgress ? 'IN_PROGRESS' : ticket.status,
      updated_at: now,
    };

    if (!ticket.first_assigned_at) {
      updates.first_assigned_at = now;
    }

    const { data: updatedTicket, error: updateError } = await supabase
      .from('tickets')
      .update(updates)
      .eq('id', params.ticket_id)
      .select('*')
      .single();

    if (updateError || !updatedTicket) {
      throw new Error(`Gagal menugaskan staff: ${updateError?.message}`);
    }

    // Log STATUS_CHANGE if status transitioned OPEN → IN_PROGRESS
    if (isStatusChangingToInProgress) {
      await this.appendMessage({
        ticket_id: params.ticket_id,
        entry_type: 'STATUS_CHANGE',
        content: `Status tiket diubah dari OPEN menjadi IN_PROGRESS.`,
        actor_id: params.assigned_by_id,
        actor_label: params.assigned_by_label,
        metadata: {
          previousStatus: 'OPEN',
          newStatus: 'IN_PROGRESS',
        },
      });
    }

    await this.appendMessage({
      ticket_id: params.ticket_id,
      entry_type: 'ASSIGNMENT_CHANGE',
      content: isReassignment
        ? `Tiket dialihkan kepada ${staffUser.full_name}. Alasan: ${params.reason}`
        : `Tiket ditugaskan kepada ${staffUser.full_name}.`,
      actor_id: params.assigned_by_id,
      actor_label: params.assigned_by_label,
      metadata: {
        previousAssignedTo: ticket.assigned_to,
        newAssignedTo: params.staff_id,
        reason: params.reason || null,
      },
    });

    return updatedTicket;
  }

  /**
   * Close a ticket. Uses updateStatus() to enforce state machine.
   * Allowed transitions: OPEN → CLOSED, IN_PROGRESS → CLOSED, RESOLVED → CLOSED.
   */
  static async closeTicket(params: {
    ticket_id: string;
    actor_id: string;
    actor_label: string;
    actor_role?: 'STAFF' | 'SUPERVISOR';
    reason?: string;
  }): Promise<Ticket> {
    return this.updateStatus({
      ticket_id: params.ticket_id,
      new_status: 'CLOSED',
      actor_id: params.actor_id,
      actor_label: params.actor_label,
      actor_role: params.actor_role,
      reason: params.reason,
    });
  }

  /**
   * List tickets with filtering, full-text search, and pagination.
   */
  static async listTickets(filter: TicketFilter, currentUser?: AuthenticatedUser | null): Promise<PaginatedResult<any>> {
    const supabase = createAdminClient();
    const page = filter.page || 1;
    const limit = filter.limit || 20;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = supabase
      .from('tickets')
      .select('*, reporters(name)', { count: 'exact' });

    if (filter.status) {
      if (Array.isArray(filter.status)) {
        query = query.in('status', filter.status);
      } else {
        query = query.eq('status', filter.status);
      }
    }

    if (filter.app_name) {
      query = query.ilike('app_name', `%${filter.app_name}%`);
    }

    // RBAC: Staff only sees tickets assigned to them or unassigned tickets
    if (currentUser && currentUser.role === 'STAFF') {
      query = query.or(`assigned_to.eq.${currentUser.id},assigned_to.is.null`);
    } else if (filter.assigned_to) {
      query = query.eq('assigned_to', filter.assigned_to);
    }

    if (filter.date_from) {
      query = query.gte('created_at', filter.date_from);
    }

    if (filter.date_to) {
      query = query.lte('created_at', filter.date_to);
    }

    // Enhanced search: ticket_number, error_desc, app_name, reporter name
    if (filter.search && filter.search.trim().length >= 3) {
      const searchTerm = filter.search.trim();

      // Find matching reporter IDs by name
      const { data: matchingReporters } = await supabase
        .from('reporters')
        .select('id')
        .ilike('name', `%${searchTerm}%`);

      // Find matching staff IDs by name
      const { data: matchingStaff } = await supabase
        .from('users')
        .select('id')
        .ilike('full_name', `%${searchTerm}%`);

      const reporterIds = (matchingReporters || []).map((r: any) => r.id);
      const staffIds = (matchingStaff || []).map((u: any) => u.id);

      // Construct OR filter
      const conditions: string[] = [
        `ticket_number.ilike.%${searchTerm}%`,
        `error_desc.ilike.%${searchTerm}%`,
        `app_name.ilike.%${searchTerm}%`,
      ];

      if (reporterIds.length > 0) {
        conditions.push(`reporter_id.in.(${reporterIds.join(',')})`);
      }

      if (staffIds.length > 0) {
        conditions.push(`assigned_to.in.(${staffIds.join(',')})`);
      }

      query = query.or(conditions.join(','));
    }

    query = query.order('created_at', { ascending: false }).range(from, to);

    const { data, count, error } = await query;

    if (error) {
      throw new Error(`Gagal mengambil daftar tiket: ${error.message}`);
    }

    // Fetch assigned users if any
    const assignedUserIds = Array.from(new Set((data || []).map((t: any) => t.assigned_to).filter(Boolean)));
    let userMap: Record<string, string> = {};

    if (assignedUserIds.length > 0) {
      const { data: usersData } = await supabase
        .from('users')
        .select('id, full_name')
        .in('id', assignedUserIds);
      if (usersData) {
        userMap = Object.fromEntries(usersData.map((u: any) => [u.id, u.full_name]));
      }
    }

    let formattedData = (data || []).map((t: any) => ({
      id: t.id,
      ticket_number: t.ticket_number,
      reporter_name: t.reporters?.name || 'Pelapor',
      app_name: t.app_name,
      error_desc_summary: t.error_desc ? t.error_desc.slice(0, 150) : null,
      status: t.status,
      created_at: t.created_at,
      assigned_to_name: t.assigned_to ? userMap[t.assigned_to] || 'Staff' : null,
    }));

    // Additional client-side filter as safety net for reporter/staff name search
    if (filter.search && filter.search.trim().length >= 3) {
      const searchTerm = filter.search.toLowerCase().trim();
      formattedData = formattedData.filter((t: any) =>
        t.ticket_number?.toLowerCase().includes(searchTerm) ||
        t.error_desc_summary?.toLowerCase().includes(searchTerm) ||
        t.app_name?.toLowerCase().includes(searchTerm) ||
        t.reporter_name?.toLowerCase().includes(searchTerm) ||
        t.assigned_to_name?.toLowerCase().includes(searchTerm)
      );
    }

    const totalItems = count || 0;
    return {
      data: formattedData,
      pagination: {
        page,
        limit,
        total_items: totalItems,
        total_pages: Math.ceil(totalItems / limit) || 1,
      },
    };
  }

  /**
   * Get full ticket details with history and attachments.
   */
  static async getTicketDetail(ticketId: string, currentUser?: AuthenticatedUser | null): Promise<TicketDetail> {
    const supabase = createAdminClient();

    const { data: ticket, error: ticketError } = await supabase
      .from('tickets')
      .select('*, reporters(name, phone)')
      .eq('id', ticketId)
      .single();

    if (ticketError || !ticket) {
      throw new Error('Tiket tidak ditemukan.');
    }

    // RBAC: Staff can only access their own assigned tickets or unassigned tickets
    if (currentUser && currentUser.role === 'STAFF') {
      if (ticket.assigned_to !== null && ticket.assigned_to !== undefined && ticket.assigned_to !== currentUser.id) {
        throw new Error('Akses ditolak: Anda tidak memiliki akses ke tiket ini.');
      }
    }

    let assignedToName: string | null = null;
    if (ticket.assigned_to) {
      const { data: user } = await supabase
        .from('users')
        .select('full_name')
        .eq('id', ticket.assigned_to)
        .maybeSingle();
      if (user) assignedToName = user.full_name;
    }

    const { data: history } = await supabase
      .from('ticket_history')
      .select('*')
      .eq('ticket_id', ticketId)
      .order('created_at', { ascending: true });

    const { data: attachments } = await supabase
      .from('ticket_attachments')
      .select('*')
      .eq('ticket_id', ticketId)
      .order('uploaded_at', { ascending: true });

    return {
      ...ticket,
      reporter_name: ticket.reporters?.name || 'Pelapor',
      reporter_phone: ticket.reporters?.phone || '',
      assigned_to_name: assignedToName,
      history: history || [],
      attachments: attachments || [],
    };
  }
}
