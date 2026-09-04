-- Ordered outbound delivery and durable inbound media processing.
ALTER TABLE whatsapp_outbox
  ADD COLUMN delivery_id uuid,
  ADD COLUMN sequence_no integer,
  ADD COLUMN message_type varchar(20) NOT NULL DEFAULT 'TEXT',
  ADD COLUMN attachment_id uuid REFERENCES ticket_attachments(id) ON DELETE SET NULL;

UPDATE whatsapp_outbox SET delivery_id = id, sequence_no = 1;
ALTER TABLE whatsapp_outbox ALTER COLUMN delivery_id SET NOT NULL;
ALTER TABLE whatsapp_outbox ALTER COLUMN delivery_id SET DEFAULT gen_random_uuid();
ALTER TABLE whatsapp_outbox ALTER COLUMN sequence_no SET NOT NULL;
ALTER TABLE whatsapp_outbox ALTER COLUMN sequence_no SET DEFAULT 1;
ALTER TABLE whatsapp_outbox
  ADD CONSTRAINT whatsapp_outbox_message_type_check CHECK (message_type IN ('TEXT','ATTACHMENT')),
  ADD CONSTRAINT whatsapp_outbox_sequence_check CHECK (sequence_no > 0),
  ADD CONSTRAINT whatsapp_outbox_attachment_check CHECK (
    (message_type = 'TEXT' AND attachment_id IS NULL)
    OR (message_type = 'ATTACHMENT' AND attachment_id IS NOT NULL)
  ),
  ADD CONSTRAINT whatsapp_outbox_delivery_sequence_unique UNIQUE (delivery_id, sequence_no);
CREATE INDEX idx_whatsapp_outbox_delivery ON whatsapp_outbox(delivery_id, sequence_no);

CREATE OR REPLACE FUNCTION claim_whatsapp_outbox(p_limit integer DEFAULT 20)
RETURNS SETOF whatsapp_outbox LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  RETURN QUERY
  WITH claimed AS (
    SELECT o.id
    FROM whatsapp_outbox o
    WHERE o.status IN ('PENDING','PROCESSING')
      AND o.next_attempt_at <= now()
      AND NOT EXISTS (
        SELECT 1 FROM whatsapp_outbox previous
        WHERE previous.delivery_id = o.delivery_id
          AND previous.sequence_no < o.sequence_no
          AND previous.status <> 'SENT'
      )
    ORDER BY o.created_at, o.sequence_no
    FOR UPDATE SKIP LOCKED
    LIMIT LEAST(p_limit,100)
  )
  UPDATE whatsapp_outbox o SET
    status='PROCESSING',
    attempts=o.attempts+1,
    next_attempt_at=now()+interval '5 minutes'
  FROM claimed WHERE o.id=claimed.id RETURNING o.*;
END; $$;

CREATE TABLE whatsapp_media_inbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider varchar(50) NOT NULL,
  provider_event_id varchar(200) NOT NULL,
  media_id varchar(250) NOT NULL,
  ticket_id uuid NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  filename varchar(255),
  mime_type varchar(150),
  status varchar(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','PROCESSING','SAVED','FAILED')),
  attempts integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  UNIQUE(provider, media_id)
);
CREATE INDEX idx_whatsapp_media_inbox_pending ON whatsapp_media_inbox(status, next_attempt_at);
ALTER TABLE whatsapp_media_inbox ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON whatsapp_media_inbox FROM anon, authenticated;

CREATE OR REPLACE FUNCTION claim_whatsapp_media_inbox(p_limit integer DEFAULT 10)
RETURNS SETOF whatsapp_media_inbox LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  RETURN QUERY
  WITH claimed AS (
    SELECT id FROM whatsapp_media_inbox
    WHERE status IN ('PENDING','PROCESSING') AND next_attempt_at <= now()
    ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT LEAST(p_limit,50)
  )
  UPDATE whatsapp_media_inbox m SET
    status='PROCESSING',
    attempts=m.attempts+1,
    next_attempt_at=now()+interval '5 minutes'
  FROM claimed WHERE m.id=claimed.id RETURNING m.*;
END; $$;
REVOKE ALL ON FUNCTION claim_whatsapp_media_inbox(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION claim_whatsapp_media_inbox(integer) TO service_role;

CREATE UNIQUE INDEX idx_ticket_attachments_wa_media_unique
  ON ticket_attachments(wa_media_id) WHERE wa_media_id IS NOT NULL;

ALTER TABLE webhook_events
  ADD COLUMN status varchar(20) NOT NULL DEFAULT 'PROCESSED' CHECK (status IN ('PROCESSING','PROCESSED','FAILED')),
  ADD COLUMN last_error text,
  ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE webhook_events ALTER COLUMN processed_at DROP NOT NULL;
