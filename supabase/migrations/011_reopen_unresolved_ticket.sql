-- A Reporter can reject a proposed resolution and return the ticket to work.
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
          (v_old='RESOLVED' AND p_new_status IN ('IN_PROGRESS','CLOSED')) OR
          (v_old='CLOSED' AND p_new_status='IN_PROGRESS')) THEN
    RAISE EXCEPTION 'Transisi status tidak valid dari % ke %.', v_old, p_new_status;
  END IF;
  UPDATE tickets SET
    status=p_new_status,
    updated_at=v_now,
    closed_at=CASE WHEN p_new_status='CLOSED' THEN v_now WHEN p_new_status='IN_PROGRESS' THEN NULL ELSE closed_at END,
    resolution_note=CASE WHEN p_new_status='IN_PROGRESS' THEN NULL ELSE resolution_note END,
    resolved_at=CASE WHEN p_new_status='IN_PROGRESS' THEN NULL ELSE resolved_at END,
    resolved_confirmation_deadline=CASE WHEN p_new_status='IN_PROGRESS' THEN NULL ELSE resolved_confirmation_deadline END
    WHERE id=p_ticket_id RETURNING * INTO v_ticket;
  INSERT INTO ticket_history(ticket_id, entry_type, content, actor_id, actor_label, metadata)
  VALUES (p_ticket_id, 'STATUS_CHANGE', 'Status tiket diubah dari '||v_old||' menjadi '||p_new_status||'.', p_actor_id, p_actor_label,
    jsonb_build_object('previousStatus',v_old,'newStatus',p_new_status,'reason',p_reason));
  RETURN NEXT v_ticket;
END; $$;

REVOKE ALL ON FUNCTION change_ticket_status_atomic(uuid,ticket_status,uuid,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION change_ticket_status_atomic(uuid,ticket_status,uuid,text,text) TO service_role;
