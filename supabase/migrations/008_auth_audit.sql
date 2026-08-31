CREATE TABLE auth_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  username varchar(100) NOT NULL,
  event_type varchar(30) NOT NULL CHECK (event_type IN ('LOGIN_SUCCEEDED','LOGIN_FAILED','LOGIN_LOCKED','LOGOUT')),
  ip_address varchar(100),
  user_agent varchar(500),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_auth_audit_user_time ON auth_audit_logs(user_id, created_at DESC);
CREATE INDEX idx_auth_audit_event_time ON auth_audit_logs(event_type, created_at DESC);
ALTER TABLE auth_audit_logs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON auth_audit_logs FROM anon, authenticated;
