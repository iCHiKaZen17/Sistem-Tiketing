import { createAdminClient } from '@/lib/supabase/server';
import {
  Ticket,
  TicketDetail,
  TicketFilter,
  TicketStatus,
  PaginatedResult,
  HistoryEntryType,
} from '@/lib/types/ticket';
import { AuthenticatedUser } from '@/lib/types/user';
import { NotificationService } from '@/lib/notifications/notification-service';
import { enqueueWhatsAppReply } from '@/lib/whatsapp/outbox-service';

export class TicketService {
  /**
   * Allowed status transitions state machine dictionary.
   */
  private static VALID_TRANSITIONS: Record<TicketStatus, TicketStatus[]> = {
    OPEN: ['IN_PROGRESS', 'CLOSED'],
    IN_PROGRESS: ['RESOLVED', 'CLOSED'],
    RESOLVED: ['IN_PROGRESS', 'CLOSED'],
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
    const { data, error: ticketError } = await supabase.rpc('create_ticket_atomic', {
      p_ticket_number: null,
      p_reporter_id: params.reporter_id,
      p_app_name: params.app_name || '',
      p_error_desc: params.error_desc || '',
      p_repro_steps: params.repro_steps || '',
      p_wa_message_id: params.wa_message_id || null,
    });
    const ticket = data?.[0];

    if (ticketError || !ticket) {
      throw new Error(`Gagal membuat tiket: ${ticketError?.message}`);
    }

    const { data: reporter } = await supabase.from('reporters').select('phone').eq('id', params.reporter_id).single();
    const missing = [!params.app_name && 'Aplikasi', !params.error_desc && 'Deskripsi', !params.repro_steps && 'Langkah'].filter(Boolean);
    if (reporter?.phone) await enqueueWhatsAppReply(`ticket:${ticket.id}:created`, {
      to: reporter.phone,
      text: `Tiket ${ticket.ticket_number} berhasil dibuat. Tim support akan menindaklanjuti laporan Anda.${missing.length ? ` Lengkapi ${missing.join(', ')} dengan format Aplikasi:, Deskripsi:, dan Langkah:.` : ''}`,
    }, ticket.id);
    await NotificationService.broadcastToAll('NEW_UNASSIGNED_TICKET', { ticket_id: ticket.id, ticket_number: ticket.ticket_number }, `ticket:${ticket.id}:created`);
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
    if (params.entry_type === 'REPORTER_MESSAGE') {
      const { data: ticket } = await supabase.from('tickets').select('assigned_to,ticket_number').eq('id', params.ticket_id).single();
      if (ticket?.assigned_to) await NotificationService.notifyUser(ticket.assigned_to, 'NEW_MESSAGE_ON_MY_TICKET', { ticket_id: params.ticket_id, ticket_number: ticket.ticket_number });
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

    const { data, error: updateError } = await supabase.rpc('change_ticket_status_atomic', {
      p_ticket_id: params.ticket_id,
      p_new_status: params.new_status,
      p_actor_id: params.actor_id || null,
      p_actor_label: params.actor_label || null,
      p_reason: params.reason || null,
    });
    const updatedTicket = data?.[0];

    if (updateError || !updatedTicket) {
      throw new Error(`Gagal memperbarui status: ${updateError?.message}`);
    }

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

    const supabase = createAdminClient();
    const { data, error } = await supabase.rpc('resolve_ticket_atomic', {
      p_ticket_id: params.ticket_id,
      p_note: trimmedNote,
      p_actor_id: params.actor_id,
      p_actor_label: params.actor_label,
    });
    const updatedTicket = data?.[0];

    if (error || !updatedTicket) {
      throw new Error(`Gagal menyelesaikan tiket: ${error?.message}`);
    }
    const { data: resolvedContact } = await supabase.from('tickets').select('ticket_number,reporters(phone)').eq('id', params.ticket_id).single();
    const resolvedPhone = (resolvedContact as any)?.reporters?.phone;
    if (resolvedPhone) await enqueueWhatsAppReply(`ticket:${params.ticket_id}:resolved:${updatedTicket.resolved_at}`, {
      to: resolvedPhone,
      text: `Tiket ${updatedTicket.ticket_number} telah diselesaikan. ${trimmedNote}\nBalas YA jika masalah sudah selesai, atau BELUM SELESAI jika kendala masih terjadi.`,
    }, params.ticket_id);

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

    const { data, error: updateError } = await supabase.rpc('assign_ticket_atomic', {
      p_ticket_id: params.ticket_id,
      p_staff_id: params.staff_id,
      p_actor_id: params.assigned_by_id || null,
      p_actor_label: params.assigned_by_label || null,
      p_reason: params.reason || null,
    });
    const updatedTicket = data?.[0];

    if (updateError || !updatedTicket) {
      throw new Error(`Gagal menugaskan staff: ${updateError?.message}`);
    }
    await NotificationService.notifyUser(params.staff_id, 'TICKET_ASSIGNED_TO_ME', { ticket_id: params.ticket_id, ticket_number: updatedTicket.ticket_number }, `ticket:${params.ticket_id}:assigned:${updatedTicket.updated_at}`);
    const { data: assignmentContact } = await supabase.from('tickets').select('ticket_number,reporters(phone),users!assigned_to(full_name)').eq('id', params.ticket_id).single();
    const assignmentPhone = (assignmentContact as any)?.reporters?.phone;
    const assignedName = (assignmentContact as any)?.users?.full_name || 'Staff Support';
    if (assignmentPhone) await enqueueWhatsAppReply(`ticket:${params.ticket_id}:assigned:${params.staff_id}`, {
      to: assignmentPhone,
      text: `Tiket ${updatedTicket.ticket_number} sedang ditangani oleh ${assignedName}.`,
    }, params.ticket_id);

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
    if (!currentUser) throw new Error('Sesi tidak valid.');
    const supabase = createAdminClient();
    const page = filter.page || 1;
    const limit = filter.limit || 20;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const { data, error } = await supabase.rpc('search_tickets', {
      p_user_id: currentUser.id,
      p_role: currentUser.role,
      p_status: Array.isArray(filter.status) ? filter.status[0] : filter.status || null,
      p_app_name: filter.app_name || null,
      p_assigned_to: filter.assigned_to || null,
      p_date_from: filter.date_from || null,
      p_date_to: filter.date_to || null,
      p_search: filter.search?.trim() || null,
      p_limit: limit,
      p_offset: from,
    });
    if (error) throw new Error(`Gagal mengambil daftar tiket: ${error.message}`);
    const totalItems = Number(data?.[0]?.total_count || 0);
    return {
      data: (data || []).map(({ total_count, ...ticket }: any) => ticket),
      pagination: { page, limit, total_items: totalItems, total_pages: Math.ceil(totalItems / limit) || 1 },
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
