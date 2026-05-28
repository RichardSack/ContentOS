-- OAuth2 Multi-User-ready Migration
-- Admin accounts have user_id = NULL (current behavior)
-- Future: each user gets their own platform_accounts rows with user_id set

-- Defensive: ensure set_updated_at() exists in case this runs standalone
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

alter table platform_accounts
  add column if not exists user_id uuid,
  add column if not exists connected_at timestamptz not null default now();

create index if not exists idx_platform_accounts_user
on platform_accounts (user_id, platform_id, is_active);

-- OAuth state/pkce store for CSRF protection
create table if not exists oauth_states (
  id uuid primary key default gen_random_uuid(),
  platform_id text not null references platforms(id) on delete cascade,
  state text not null,
  pkce_code_verifier text,
  redirect_url text,
  expires_at timestamptz not null default (now() + interval '10 minutes'),
  created_at timestamptz not null default now()
);

create index if not exists idx_oauth_states_expires
on oauth_states (expires_at);

create index if not exists idx_oauth_states_lookup
on oauth_states (platform_id, state);
