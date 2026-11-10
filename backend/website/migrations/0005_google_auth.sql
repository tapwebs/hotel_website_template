-- Google Authentication: store Google's stable 'sub' claim for customer accounts.
-- Nullable password_hash allows accounts registered exclusively via Google. Additive only.
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS google_sub text;
CREATE UNIQUE INDEX IF NOT EXISTS users_google_sub_key ON users (google_sub) WHERE google_sub IS NOT NULL;
