CREATE OR REPLACE FUNCTION claim_ticket_atomic(p_ticket_id uuid, p_staff_id uuid, p_actor_label text)
RETURNS SETOF tickets LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_ticket tickets; v_now timestamptz:=now();
BEGIN
  IF NOT EXISTS(SELECT 1 FROM users WHERE id=p_staff_id AND role='STAFF' AND is_active) THEN RAISE EXCEPTION 'Staff tidak aktif.'; END IF;
  UPDATE tickets SET assigned_to=p_staff_id, status='IN_PROGRESS', first_assigned_at=COALESCE(first_assigned_at,v_now), updated_at=v_now
    WHERE id=p_ticket_id AND status='OPEN' AND assigned_to IS NULL RETURNING * INTO v_ticket;
  IF NOT FOUND THEN RAISE EXCEPTION 'Tiket sudah diklaim atau tidak lagi OPEN.'; END IF;
  INSERT INTO ticket_history(ticket_id,entry_type,content,actor_id,actor_label,metadata)
  VALUES(p_ticket_id,'STATUS_CHANGE','Status tiket diubah dari OPEN menjadi IN_PROGRESS.',p_staff_id,p_actor_label,jsonb_build_object('previousStatus','OPEN','newStatus','IN_PROGRESS'));
  INSERT INTO ticket_history(ticket_id,entry_type,content,actor_id,actor_label,metadata)
  VALUES(p_ticket_id,'ASSIGNMENT_CHANGE','Tiket diklaim oleh '||p_actor_label||'.',p_staff_id,p_actor_label,jsonb_build_object('previousAssignedTo',NULL,'newAssignedTo',p_staff_id));
  RETURN NEXT v_ticket;
END; $$;
REVOKE ALL ON FUNCTION claim_ticket_atomic(uuid,uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION claim_ticket_atomic(uuid,uuid,text) TO service_role;
