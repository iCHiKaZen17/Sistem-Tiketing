CREATE TABLE whatsapp_resolution_confirmations (
  event_id text PRIMARY KEY,
  ticket_id uuid NOT NULL REFERENCES tickets(id),
  reporter_id uuid NOT NULL REFERENCES reporters(id),
  confirmed boolean NOT NULL
);
ALTER TABLE whatsapp_resolution_confirmations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON whatsapp_resolution_confirmations FROM anon, authenticated;

CREATE FUNCTION confirm_reporter_resolution(p_ticket_id uuid, p_reporter_id uuid, p_confirmed boolean, p_event_id text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE t tickets; reporter_name text;
BEGIN
  SELECT * INTO t FROM tickets WHERE id=p_ticket_id AND reporter_id=p_reporter_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Tiket tidak ditemukan untuk Reporter.'; END IF;
  IF EXISTS (SELECT 1 FROM whatsapp_resolution_confirmations WHERE event_id=p_event_id AND ticket_id=p_ticket_id AND reporter_id=p_reporter_id AND confirmed=p_confirmed) THEN RETURN; END IF;
  IF t.status <> 'RESOLVED' THEN RAISE EXCEPTION 'Konfirmasi hanya berlaku untuk tiket RESOLVED.'; END IF;
  SELECT name INTO reporter_name FROM reporters WHERE id=p_reporter_id AND is_active;
  IF NOT FOUND THEN RAISE EXCEPTION 'Reporter tidak aktif.'; END IF;
  INSERT INTO whatsapp_resolution_confirmations VALUES (p_event_id,p_ticket_id,p_reporter_id,p_confirmed);
  PERFORM change_ticket_status_atomic(p_ticket_id, CASE WHEN p_confirmed THEN 'CLOSED'::ticket_status ELSE 'IN_PROGRESS'::ticket_status END, NULL, reporter_name,
    CASE WHEN p_confirmed THEN 'Dikonfirmasi melalui WhatsApp.' ELSE 'Reporter menyatakan BELUM SELESAI melalui WhatsApp.' END);
END; $$;
REVOKE ALL ON FUNCTION confirm_reporter_resolution(uuid,uuid,boolean,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION confirm_reporter_resolution(uuid,uuid,boolean,text) TO service_role;
