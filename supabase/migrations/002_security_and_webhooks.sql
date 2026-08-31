-- Secure direct database access. The server-side service role bypasses RLS;
-- browser/anon/authenticated Supabase clients receive no table access.
ALTER TABLE reporters ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON reporters, users, tickets, ticket_history, ticket_attachments, notifications, notification_preferences FROM anon, authenticated;

-- Provider retries must never create the same ticket twice.
CREATE UNIQUE INDEX IF NOT EXISTS idx_history_wa_message_unique
  ON ticket_history(wa_message_id) WHERE wa_message_id IS NOT NULL;

CREATE TABLE webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider VARCHAR(50) NOT NULL,
  provider_event_id VARCHAR(200) NOT NULL,
  sender VARCHAR(30),
  event_type VARCHAR(50) NOT NULL,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(provider, provider_event_id)
);
ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON webhook_events FROM anon, authenticated;
