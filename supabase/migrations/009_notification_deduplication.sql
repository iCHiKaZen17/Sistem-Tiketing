ALTER TABLE notifications ADD COLUMN dedupe_key varchar(250);
ALTER TABLE notifications ADD CONSTRAINT notifications_user_dedupe_unique UNIQUE (user_id, dedupe_key);
