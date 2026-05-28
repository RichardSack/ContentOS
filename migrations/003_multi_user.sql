-- Multi-User SaaS Migration
-- Adds user table, user-scoped RLS, and role-based access.
--
-- Roles:
--   admin   = full app control (all users, all content, all platform accounts)
--   creator = owns content_items, platform_posts, platform_accounts
--             can connect their own OAuth accounts, upload, search their content
--             (public visitors search cross-creator content via /)
--
-- Design note: user_id is nullable on legacy rows during transition.
-- New code always writes user_id. Old rows without user_id are treated as
-- unowned / admin-imported and only visible to admin.

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

-- ============================================================
-- 1. User profile table (extends Supabase Auth)
-- ============================================================

-- Ensure auth schema is accessible for foreign keys
-- (Supabase auto-creates trigger functions in auth schema)

create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  role text not null default 'creator' check (role in ('admin', 'creator')),
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_users_role on public.users(role);

create trigger set_users_updated_at
before update on public.users
for each row execute function set_updated_at();

-- Auto-create public.user row when auth.users is created via Supabase Auth
-- NOTE: requires `supabase_functions_admin` privileges or enabled via
-- Supabase Dashboard → Database → Auth Triggers.
-- For self-hosted / local, run this manually or use the API.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into public.users (id, email, role, display_name)
  values (new.id, new.email, 'creator', new.raw_user_meta_data->>'full_name');
  return new;
end;
$$;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- 2. Add user_id to content ownership tables
-- ============================================================

alter table content_items
  add column if not exists user_id uuid references public.users(id) on delete set null;

alter table oauth_states
  add column if not exists user_id uuid references public.users(id) on delete cascade;

-- platform_accounts.user_id exists from 001_oauth.sql, ensure FK
-- (it was created as plain uuid, not referencing. Fix if needed.)
do $$
begin
  -- Only add constraint if it doesn't exist
  if not exists (
    select 1 from pg_constraint where conname = 'platform_accounts_user_id_fkey'
  ) then
    alter table platform_accounts
      add constraint platform_accounts_user_id_fkey
      foreign key (user_id) references public.users(id) on delete set null;
  end if;
end
$$;

-- ============================================================
-- 3. RLS: platform_accounts (creator-scoped)
-- ============================================================

alter table platform_accounts enable row level security;

-- Drop old broad policies if they exist (from 002_rls.sql we didn't add policies
-- for platform_accounts, but let's be safe)
drop policy if exists "platform_accounts_user_select" on platform_accounts;
drop policy if exists "platform_accounts_user_insert" on platform_accounts;
drop policy if exists "platform_accounts_user_update" on platform_accounts;
drop policy if exists "platform_accounts_user_delete" on platform_accounts;

-- Creator sees their own; Admin sees all
create policy "platform_accounts_select_own"
  on platform_accounts for select
  to authenticated
  using (
    user_id = auth.uid()
    or (select role from public.users where id = auth.uid()) = 'admin'
  );

create policy "platform_accounts_insert_own"
  on platform_accounts for insert
  to authenticated
  with check (
    user_id = auth.uid()
    or (select role from public.users where id = auth.uid()) = 'admin'
  );

create policy "platform_accounts_update_own"
  on platform_accounts for update
  to authenticated
  using (
    user_id = auth.uid()
    or (select role from public.users where id = auth.uid()) = 'admin'
  );

-- ============================================================
-- 4. RLS: content_items (creator-scoped + public visibility)
-- ============================================================

-- Drop and recreate the public read policy to include user-aware checks
drop policy if exists "content_items_public_read" on content_items;
drop policy if exists "content_items_creator_select" on content_items;
drop policy if exists "content_items_creator_insert" on content_items;
drop policy if exists "content_items_creator_update" on content_items;

-- Public search: still only ready + public items
create policy "content_items_public_read"
  on content_items for select
  to anon, authenticated
  using (visibility = 'public' and processing_status = 'ready');

-- Creator sees all their own items (any status, any visibility)
create policy "content_items_creator_select"
  on content_items for select
  to authenticated
  using (
    user_id = auth.uid()
    or (select role from public.users where id = auth.uid()) = 'admin'
  );

-- Creator inserts their own
create policy "content_items_creator_insert"
  on content_items for insert
  to authenticated
  with check (
    user_id = auth.uid()
    or (select role from public.users where id = auth.uid()) = 'admin'
  );

-- Creator updates their own
create policy "content_items_creator_update"
  on content_items for update
  to authenticated
  using (
    user_id = auth.uid()
    or (select role from public.users where id = auth.uid()) = 'admin'
  );

-- ============================================================
-- 5. Helper: is_admin() for SECURITY DEFINER functions
-- ============================================================

create or replace function public.is_admin(user_uuid uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1 from public.users where id = user_uuid and role = 'admin'
  );
$$;
