ALTER TABLE tickets ADD COLUMN IF NOT EXISTS info_reminder_sent_at timestamptz;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS assignment_reminder_sent_at timestamptz;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS stale_reminder_sent_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_tickets_automation ON tickets(status, updated_at);

INSERT INTO storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
VALUES ('ticket-attachments', 'ticket-attachments', false, 10485760,
  ARRAY['image/jpeg','image/png','image/gif','application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/msword'])
ON CONFLICT (id) DO UPDATE SET public=false, file_size_limit=10485760,
  allowed_mime_types=EXCLUDED.allowed_mime_types;

-- storage.objects is managed by Supabase. The private bucket is accessed only
-- by the server-side secret/service-role key, which bypasses Storage RLS.
