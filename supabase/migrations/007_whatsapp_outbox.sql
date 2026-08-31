CREATE TABLE whatsapp_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid REFERENCES tickets(id) ON DELETE SET NULL,
  dedupe_key varchar(250) UNIQUE NOT NULL,
  to_phone varchar(30) NOT NULL,
  payload jsonb NOT NULL,
  status varchar(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','PROCESSING','SENT','FAILED')),
  attempts integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);
CREATE INDEX idx_whatsapp_outbox_pending ON whatsapp_outbox(status, next_attempt_at);
CREATE INDEX idx_whatsapp_outbox_ticket ON whatsapp_outbox(ticket_id) WHERE ticket_id IS NOT NULL;
ALTER TABLE whatsapp_outbox ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON whatsapp_outbox FROM anon, authenticated;

CREATE OR REPLACE FUNCTION claim_whatsapp_outbox(p_limit integer DEFAULT 20)
RETURNS SETOF whatsapp_outbox LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  RETURN QUERY
  WITH claimed AS (
    SELECT id FROM whatsapp_outbox
    WHERE status IN ('PENDING','PROCESSING') AND next_attempt_at<=now()
    ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT LEAST(p_limit,100)
  )
  UPDATE whatsapp_outbox o SET
    status='PROCESSING',
    attempts=o.attempts+1,
    next_attempt_at=now()+interval '5 minutes'
  FROM claimed WHERE o.id=claimed.id RETURNING o.*;
END; $$;
REVOKE ALL ON FUNCTION claim_whatsapp_outbox(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION claim_whatsapp_outbox(integer) TO service_role;
