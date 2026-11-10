-- Admin tools: activity log (who changed what) and editable nightly room rates. Additive only.
CREATE TABLE activity_log (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  at          timestamptz NOT NULL DEFAULT now(),
  actor_id    uuid REFERENCES users(id) ON DELETE SET NULL,
  actor_name  text NOT NULL,
  action      text NOT NULL,
  target      text NOT NULL DEFAULT '',
  detail      text NOT NULL DEFAULT ''
);
CREATE INDEX activity_log_at_idx ON activity_log (at DESC);
CREATE TABLE room_rates (
  room_id    text PRIMARY KEY,
  rate       integer NOT NULL CHECK (rate BETWEEN 100 AND 1000000),
  updated_at timestamptz NOT NULL DEFAULT now()
);
-- Rollback: DROP TABLE room_rates; DROP TABLE activity_log;
