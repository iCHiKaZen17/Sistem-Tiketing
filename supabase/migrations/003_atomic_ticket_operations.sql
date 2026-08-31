-- Atomic ticket mutations. Validation, row update, and audit history commit together.
CREATE OR REPLACE FUNCTION next_ticket_number() RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_date text:=to_char(now(),'YYYYMMDD'); v_next integer;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('ticket-number-'||v_date));
  SELECT COALESCE(max(right(ticket_number,4)::integer),0)+1 INTO v_next FROM tickets WHERE ticket_number LIKE 'TKT-'||v_date||'-%';
  RETURN 'TKT-'||v_date||'-'||lpad(v_next::text,4,'0');
END; $$;

CREATE OR REPLACE FUNCTION create_ticket_atomic(
  p_ticket_number text, p_reporter_id uuid, p_app_name text, p_error_desc text,
  p_repro_steps text, p_wa_message_id text DEFAULT NULL
) RETURNS SETOF tickets LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_ticket tickets;
BEGIN
  INSERT INTO tickets(ticket_number, reporter_id, status, app_name, error_desc, repro_steps)
  VALUES (COALESCE(p_ticket_number,next_ticket_number()), p_reporter_id, 'OPEN', NULLIF(p_app_name, ''), NULLIF(p_error_desc, ''), NULLIF(p_repro_steps, ''))
  RETURNING * INTO v_ticket;
  INSERT INTO ticket_history(ticket_id, entry_type, content, wa_message_id)
  VALUES (v_ticket.id, 'REPORTER_MESSAGE', COALESCE(NULLIF(p_error_desc, ''), 'Laporan baru diterima.'), p_wa_message_id);
  RETURN NEXT v_ticket;
END; $$;

CREATE OR REPLACE FUNCTION assign_ticket_atomic(
  p_ticket_id uuid, p_staff_id uuid, p_actor_id uuid, p_actor_label text, p_reason text DEFAULT NULL
) RETURNS SETOF tickets LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_ticket tickets; v_staff users; v_old_status ticket_status; v_old_assignee uuid; v_reassign boolean; v_now timestamptz := now();
BEGIN
  SELECT * INTO v_staff FROM users WHERE id = p_staff_id AND role = 'STAFF' AND is_active FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Staff yang ditunjuk tidak ditemukan atau tidak aktif.'; END IF;
  SELECT * INTO v_ticket FROM tickets WHERE id = p_ticket_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Tiket tidak ditemukan.'; END IF;
  IF v_ticket.status IN ('RESOLVED','CLOSED') THEN RAISE EXCEPTION 'Tiket yang sudah selesai atau ditutup tidak dapat ditugaskan.'; END IF;
  v_reassign := v_ticket.assigned_to IS NOT NULL;
  v_old_assignee := v_ticket.assigned_to;
  IF v_reassign AND btrim(COALESCE(p_reason,'')) = '' THEN RAISE EXCEPTION 'Alasan wajib diisi saat pengalihan petugas.'; END IF;
  v_old_status := v_ticket.status;
  UPDATE tickets SET assigned_to = p_staff_id, status = 'IN_PROGRESS', updated_at = v_now,
    first_assigned_at = COALESCE(first_assigned_at, v_now) WHERE id = p_ticket_id RETURNING * INTO v_ticket;
  IF v_old_status = 'OPEN' THEN
    INSERT INTO ticket_history(ticket_id, entry_type, content, actor_id, actor_label, metadata)
    VALUES (p_ticket_id, 'STATUS_CHANGE', 'Status tiket diubah dari OPEN menjadi IN_PROGRESS.', p_actor_id, p_actor_label,
      jsonb_build_object('previousStatus','OPEN','newStatus','IN_PROGRESS'));
  END IF;
  INSERT INTO ticket_history(ticket_id, entry_type, content, actor_id, actor_label, metadata)
  VALUES (p_ticket_id, 'ASSIGNMENT_CHANGE',
    CASE WHEN v_reassign THEN 'Tiket dialihkan kepada ' || v_staff.full_name || '. Alasan: ' || p_reason
         ELSE 'Tiket ditugaskan kepada ' || v_staff.full_name || '.' END,
    p_actor_id, p_actor_label, jsonb_build_object('previousAssignedTo', v_old_assignee, 'newAssignedTo', p_staff_id, 'reason', p_reason));
  RETURN NEXT v_ticket;
END; $$;

CREATE OR REPLACE FUNCTION resolve_ticket_atomic(
  p_ticket_id uuid, p_note text, p_actor_id uuid, p_actor_label text
) RETURNS SETOF tickets LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_ticket tickets; v_note text := btrim(p_note); v_now timestamptz := now();
BEGIN
  IF char_length(v_note) NOT BETWEEN 10 AND 2000 THEN RAISE EXCEPTION 'Catatan resolusi harus terdiri dari 10 hingga 2000 karakter.'; END IF;
  SELECT * INTO v_ticket FROM tickets WHERE id = p_ticket_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Tiket tidak ditemukan.'; END IF;
  IF v_ticket.status <> 'IN_PROGRESS' THEN RAISE EXCEPTION 'Transisi status tidak valid dari % ke RESOLVED.', v_ticket.status; END IF;
  UPDATE tickets SET status='RESOLVED', resolution_note=v_note, resolved_at=v_now,
    resolved_confirmation_deadline=v_now + interval '24 hours', updated_at=v_now
    WHERE id=p_ticket_id RETURNING * INTO v_ticket;
  INSERT INTO ticket_history(ticket_id, entry_type, content, actor_id, actor_label, metadata)
  VALUES (p_ticket_id, 'STATUS_CHANGE', 'Status tiket diubah dari IN_PROGRESS menjadi RESOLVED.', p_actor_id, p_actor_label,
    jsonb_build_object('previousStatus','IN_PROGRESS','newStatus','RESOLVED'));
  INSERT INTO ticket_history(ticket_id, entry_type, content, actor_id, actor_label)
  VALUES (p_ticket_id, 'RESOLUTION_NOTE', v_note, p_actor_id, p_actor_label);
  RETURN NEXT v_ticket;
END; $$;

CREATE OR REPLACE FUNCTION change_ticket_status_atomic(
  p_ticket_id uuid, p_new_status ticket_status, p_actor_id uuid, p_actor_label text, p_reason text DEFAULT NULL
) RETURNS SETOF tickets LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_ticket tickets; v_old ticket_status; v_now timestamptz := now();
BEGIN
  SELECT * INTO v_ticket FROM tickets WHERE id=p_ticket_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Tiket tidak ditemukan.'; END IF;
  v_old := v_ticket.status;
  IF NOT ((v_old='OPEN' AND p_new_status IN ('IN_PROGRESS','CLOSED')) OR
          (v_old='IN_PROGRESS' AND p_new_status IN ('RESOLVED','CLOSED')) OR
          (v_old='RESOLVED' AND p_new_status='CLOSED') OR
          (v_old='CLOSED' AND p_new_status='IN_PROGRESS')) THEN
    RAISE EXCEPTION 'Transisi status tidak valid dari % ke %.', v_old, p_new_status;
  END IF;
  UPDATE tickets SET status=p_new_status, updated_at=v_now,
    closed_at=CASE WHEN p_new_status='CLOSED' THEN v_now WHEN p_new_status='IN_PROGRESS' THEN NULL ELSE closed_at END
    WHERE id=p_ticket_id RETURNING * INTO v_ticket;
  INSERT INTO ticket_history(ticket_id, entry_type, content, actor_id, actor_label, metadata)
  VALUES (p_ticket_id, 'STATUS_CHANGE', 'Status tiket diubah dari '||v_old||' menjadi '||p_new_status||'.', p_actor_id, p_actor_label,
    jsonb_build_object('previousStatus',v_old,'newStatus',p_new_status,'reason',p_reason));
  RETURN NEXT v_ticket;
END; $$;

REVOKE ALL ON FUNCTION create_ticket_atomic(text,uuid,text,text,text,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION next_ticket_number() FROM PUBLIC;
REVOKE ALL ON FUNCTION assign_ticket_atomic(uuid,uuid,uuid,text,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION resolve_ticket_atomic(uuid,text,uuid,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION change_ticket_status_atomic(uuid,ticket_status,uuid,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION create_ticket_atomic(text,uuid,text,text,text,text) TO service_role;
GRANT EXECUTE ON FUNCTION next_ticket_number() TO service_role;
GRANT EXECUTE ON FUNCTION assign_ticket_atomic(uuid,uuid,uuid,text,text) TO service_role;
GRANT EXECUTE ON FUNCTION resolve_ticket_atomic(uuid,text,uuid,text) TO service_role;
GRANT EXECUTE ON FUNCTION change_ticket_status_atomic(uuid,ticket_status,uuid,text,text) TO service_role;
