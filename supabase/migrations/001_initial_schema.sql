-- Initial Schema Migration for WhatsApp Ticketing System

-- 1. Enum Types
CREATE TYPE ticket_status AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED');
CREATE TYPE user_role AS ENUM ('STAFF', 'SUPERVISOR');
CREATE TYPE history_entry_type AS ENUM (
  'REPORTER_MESSAGE',
  'BOT_MESSAGE',
  'STATUS_CHANGE',
  'ASSIGNMENT_CHANGE',
  'RESOLUTION_NOTE',
  'SYSTEM_EVENT'
);
CREATE TYPE attachment_type AS ENUM ('IMAGE', 'DOCUMENT');

-- 2. Reporters Table
CREATE TABLE reporters (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone       VARCHAR(20) UNIQUE NOT NULL,  -- Format without +, e.g., "628123456789"
  name        VARCHAR(200) NOT NULL,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Users Table (Staff & Supervisor)
CREATE TABLE users (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username            VARCHAR(100) UNIQUE NOT NULL,
  password_hash       TEXT NOT NULL,
  full_name           VARCHAR(200) NOT NULL,
  role                user_role NOT NULL,
  is_active           BOOLEAN NOT NULL DEFAULT true,
  failed_login_count  INTEGER NOT NULL DEFAULT 0,
  locked_until        TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Tickets Table
CREATE TABLE tickets (
  id                              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_number                   VARCHAR(20) UNIQUE NOT NULL,  -- Format: TKT-YYYYMMDD-NNNN
  reporter_id                     UUID NOT NULL REFERENCES reporters(id),
  status                          ticket_status NOT NULL DEFAULT 'OPEN',
  app_name                        VARCHAR(200),
  error_desc                      TEXT,
  repro_steps                     TEXT,
  assigned_to                     UUID REFERENCES users(id),
  resolution_note                 TEXT,
  created_at                      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                      TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at                     TIMESTAMPTZ,
  closed_at                       TIMESTAMPTZ,
  first_assigned_at               TIMESTAMPTZ,
  resolved_confirmation_deadline TIMESTAMPTZ
);

CREATE INDEX idx_tickets_status ON tickets(status);
CREATE INDEX idx_tickets_reporter ON tickets(reporter_id);
CREATE INDEX idx_tickets_assigned_to ON tickets(assigned_to);
CREATE INDEX idx_tickets_created_at ON tickets(created_at);
CREATE INDEX idx_tickets_number ON tickets(ticket_number);
-- Full-text search index on error_desc
CREATE INDEX idx_tickets_fts ON tickets USING gin(to_tsvector('indonesian', coalesce(error_desc, '')));

-- 5. Ticket History Table (Immutable Audit Trail)
CREATE TABLE ticket_history (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id     UUID NOT NULL REFERENCES tickets(id),
  entry_type    history_entry_type NOT NULL,
  content       TEXT,
  actor_id      UUID REFERENCES users(id),
  actor_label   VARCHAR(200),
  metadata      JSONB,
  wa_message_id VARCHAR(100),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_history_ticket ON ticket_history(ticket_id, created_at);

-- Immutability Enforcement Trigger for ticket_history
CREATE OR REPLACE FUNCTION prevent_history_modification()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'ticket_history records are immutable and cannot be updated or deleted.';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER prevent_history_update
BEFORE UPDATE OR DELETE ON ticket_history
FOR EACH ROW EXECUTE FUNCTION prevent_history_modification();

-- 6. Ticket Attachments Table
CREATE TABLE ticket_attachments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id     UUID NOT NULL REFERENCES tickets(id),
  history_id    UUID REFERENCES ticket_history(id),
  file_type     attachment_type NOT NULL,
  filename      VARCHAR(500) NOT NULL,
  mime_type     VARCHAR(100) NOT NULL,
  file_size     INTEGER NOT NULL,             -- In bytes
  storage_path  VARCHAR(1000) NOT NULL,
  wa_media_id   VARCHAR(200),
  uploaded_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 7. Notifications Table
CREATE TABLE notifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id),
  event_type  VARCHAR(100) NOT NULL,
  payload     JSONB NOT NULL,
  is_read     BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_notif_user_unread ON notifications(user_id, is_read, created_at DESC);

-- 8. Notification Preferences Table
CREATE TABLE notification_preferences (
  user_id                  UUID PRIMARY KEY REFERENCES users(id),
  new_unassigned_ticket    BOOLEAN NOT NULL DEFAULT true,
  ticket_assigned_to_me    BOOLEAN NOT NULL DEFAULT true,
  new_message_on_my_ticket BOOLEAN NOT NULL DEFAULT true,
  stale_ticket_reminder    BOOLEAN NOT NULL DEFAULT true,
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);
