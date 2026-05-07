-- ═══════════════════════════════════════════════════════════
-- CLEVERUM — Auth Multi-Tenant: user_profiles + helper functions
-- Esta migration NO modifica las RLS de las otras tablas.
-- El cutover de RLS de tablas existentes va en una migration
-- separada (004_rls_multitenant_cutover.sql, ticket E-03).
-- ═══════════════════════════════════════════════════════════

-- ─── USER PROFILES ───────────────────────────────────────────
create table user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('super_admin', 'user')),
  client_id uuid references clients(id) on delete cascade,
  allowed_pages text[] default '{}',
  full_name text,
  created_at timestamptz default now(),

  constraint user_has_client check (
    role = 'super_admin' or client_id is not null
  ),
  constraint super_admin_no_client check (
    role = 'user' or client_id is null
  )
);

create index idx_user_profiles_client on user_profiles(client_id);

-- ─── HELPER FUNCTIONS (SECURITY DEFINER) ─────────────────────
-- Llamables desde RLS policies sin recursión.
-- SECURITY DEFINER → corren con privilegios del owner (postgres),
-- bypaseando RLS sobre user_profiles cuando se llaman desde policies.

create or replace function public.current_user_role()
returns text
language sql stable security definer
set search_path = public, auth
as $$
  select role from user_profiles where id = auth.uid()
$$;

create or replace function public.current_user_client_id()
returns uuid
language sql stable security definer
set search_path = public, auth
as $$
  select client_id from user_profiles where id = auth.uid()
$$;

-- ─── RLS user_profiles ───────────────────────────────────────
alter table user_profiles enable row level security;

-- Cualquier usuario autenticado puede leer SU PROPIO profile
create policy self_read on user_profiles
  for select
  to authenticated
  using (id = auth.uid());

-- Solo super_admin puede crear/editar/eliminar profiles.
-- Nota: cuando la tabla está vacía, esta policy bloquea inserts via auth session.
-- El primer super_admin DEBE insertarse via SQL Editor (postgres user, bypasea RLS).
create policy super_admin_write on user_profiles
  for all
  to authenticated
  using (public.current_user_role() = 'super_admin')
  with check (public.current_user_role() = 'super_admin');
