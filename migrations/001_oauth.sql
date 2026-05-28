-- OAuth state store for CSRF protection and callback validation
CREATE TABLE IF NOT EXISTS oauth_states (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform_id text NOT NULL,
  state text NOT NULL,
  pkce_code_verifier text,
  redirect_url text,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '10 minutes'),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_oauth_states_expires
ON oauth_states(expires_at);

CREATE INDEX IF NOT EXISTS idx_oauth_states_lookup
ON oauth_states(platform_id, state);

-- Prune expired states (optional cleanup trigger)
CREATE OR REPLACE FUNCTION prune_expired_oauth_states()
RETURNS void
LANGUAGE sql
AS $$
  DELETE FROM oauth_states WHERE expires_at < now();
$$;

-- Add multi-user future-proofing columns to platform_accounts
ALTER TABLE platform_accounts
  ADD COLUMN IF NOT EXISTS user_id uuid,
  ADD COLUMN IF NOT EXISTS connected_at timestamptz DEFAULT now();

-- Note: when adding multi-user later, also add:
-- ALTER TABLE platform_accounts ADD CONSTRAINT unique_account_per_user
-- UNIQUE (platform_id, user_id, account_name);
-- And RLS policies for user_id = auth.uid()
