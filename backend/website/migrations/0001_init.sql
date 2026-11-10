CREATE TABLE users (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name             text NOT NULL,
  email            text NOT NULL UNIQUE CHECK (email = lower(email)),
  phone            text,
  password_hash    text NOT NULL,
  role             text NOT NULL DEFAULT 'guest'  CHECK (role IN ('guest','staff','admin')),
  status           text NOT NULL DEFAULT 'active' CHECK (status IN ('active','disabled')),
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  last_login_at    timestamptz,
  external_hms_id  text,
  external_pos_id  text
);
CREATE INDEX users_created_at_idx ON users (created_at DESC);
CREATE INDEX users_role_status_idx ON users (role, status);
CREATE UNIQUE INDEX users_external_hms_id_key ON users (external_hms_id) WHERE external_hms_id IS NOT NULL;
CREATE UNIQUE INDEX users_external_pos_id_key ON users (external_pos_id) WHERE external_pos_id IS NOT NULL;

CREATE TABLE sessions (
  token_hash  text PRIMARY KEY,
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz NOT NULL
);
CREATE INDEX sessions_user_id_idx ON sessions (user_id);
CREATE INDEX sessions_expires_at_idx ON sessions (expires_at);
