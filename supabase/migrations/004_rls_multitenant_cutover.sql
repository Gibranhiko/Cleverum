-- ═══════════════════════════════════════════════════════════
-- CLEVERUM — RLS Multi-Tenant Cutover (E-03)
-- Reemplaza la policy `authenticated_full_access` por
-- `multi_tenant_access` (super_admin OR client_id matching) en
-- todas las tablas con `client_id`.
-- La tabla `clients` tiene dos policies separadas porque para
-- `user` es solo SELECT (no puede tocar config crítica).
--
-- ⚠️ PRE-REQUISITO: tu super_admin profile debe existir en
-- user_profiles ANTES de aplicar esta migration. Verifica:
--   select * from user_profiles where role = 'super_admin';
-- Debe retornar al menos 1 row.
-- ═══════════════════════════════════════════════════════════

begin;

-- ─── Sanity check: verificar que existe al menos un super_admin
do $$
declare
  v_count int;
begin
  select count(*) into v_count from user_profiles where role = 'super_admin';
  if v_count = 0 then
    raise exception 'No super_admin profile found. Aplica E-02 antes de este cutover.';
  end if;
end $$;

-- ─── CLIENTS (especial: user solo SELECT de su row) ──────────
alter table clients enable row level security;
drop policy if exists authenticated_full_access on clients;
drop policy if exists super_admin_clients on clients;
drop policy if exists user_read_own_client on clients;

create policy super_admin_clients on clients
  for all to authenticated
  using (public.current_user_role() = 'super_admin')
  with check (public.current_user_role() = 'super_admin');

create policy user_read_own_client on clients
  for select to authenticated
  using (
    public.current_user_role() = 'user'
    and id = public.current_user_client_id()
  );

-- ─── PRODUCTS ────────────────────────────────────────────────
alter table products enable row level security;
drop policy if exists authenticated_full_access on products;
drop policy if exists multi_tenant_access on products;
create policy multi_tenant_access on products
  for all to authenticated
  using (
    public.current_user_role() = 'super_admin'
    or client_id = public.current_user_client_id()
  )
  with check (
    public.current_user_role() = 'super_admin'
    or client_id = public.current_user_client_id()
  );

-- ─── ORDERS ──────────────────────────────────────────────────
alter table orders enable row level security;
drop policy if exists authenticated_full_access on orders;
drop policy if exists multi_tenant_access on orders;
create policy multi_tenant_access on orders
  for all to authenticated
  using (
    public.current_user_role() = 'super_admin'
    or client_id = public.current_user_client_id()
  )
  with check (
    public.current_user_role() = 'super_admin'
    or client_id = public.current_user_client_id()
  );

-- ─── LEADS ───────────────────────────────────────────────────
alter table leads enable row level security;
drop policy if exists authenticated_full_access on leads;
drop policy if exists multi_tenant_access on leads;
create policy multi_tenant_access on leads
  for all to authenticated
  using (
    public.current_user_role() = 'super_admin'
    or client_id = public.current_user_client_id()
  )
  with check (
    public.current_user_role() = 'super_admin'
    or client_id = public.current_user_client_id()
  );

-- ─── REMINDERS ───────────────────────────────────────────────
alter table reminders enable row level security;
drop policy if exists authenticated_full_access on reminders;
drop policy if exists multi_tenant_access on reminders;
create policy multi_tenant_access on reminders
  for all to authenticated
  using (
    public.current_user_role() = 'super_admin'
    or client_id = public.current_user_client_id()
  )
  with check (
    public.current_user_role() = 'super_admin'
    or client_id = public.current_user_client_id()
  );

-- ─── CONVERSATION_SESSIONS ───────────────────────────────────
alter table conversation_sessions enable row level security;
drop policy if exists authenticated_full_access on conversation_sessions;
drop policy if exists multi_tenant_access on conversation_sessions;
create policy multi_tenant_access on conversation_sessions
  for all to authenticated
  using (
    public.current_user_role() = 'super_admin'
    or client_id = public.current_user_client_id()
  )
  with check (
    public.current_user_role() = 'super_admin'
    or client_id = public.current_user_client_id()
  );

-- ─── BOT_CONFIGS ─────────────────────────────────────────────
alter table bot_configs enable row level security;
drop policy if exists authenticated_full_access on bot_configs;
drop policy if exists multi_tenant_access on bot_configs;
create policy multi_tenant_access on bot_configs
  for all to authenticated
  using (
    public.current_user_role() = 'super_admin'
    or client_id = public.current_user_client_id()
  )
  with check (
    public.current_user_role() = 'super_admin'
    or client_id = public.current_user_client_id()
  );

-- ─── DOCUMENTS ───────────────────────────────────────────────
alter table documents enable row level security;
drop policy if exists authenticated_full_access on documents;
drop policy if exists multi_tenant_access on documents;
create policy multi_tenant_access on documents
  for all to authenticated
  using (
    public.current_user_role() = 'super_admin'
    or client_id = public.current_user_client_id()
  )
  with check (
    public.current_user_role() = 'super_admin'
    or client_id = public.current_user_client_id()
  );

-- ─── DOCUMENT_CHUNKS ─────────────────────────────────────────
alter table document_chunks enable row level security;
drop policy if exists authenticated_full_access on document_chunks;
drop policy if exists multi_tenant_access on document_chunks;
create policy multi_tenant_access on document_chunks
  for all to authenticated
  using (
    public.current_user_role() = 'super_admin'
    or client_id = public.current_user_client_id()
  )
  with check (
    public.current_user_role() = 'super_admin'
    or client_id = public.current_user_client_id()
  );

-- ─── SERVICES ────────────────────────────────────────────────
alter table services enable row level security;
drop policy if exists authenticated_full_access on services;
drop policy if exists multi_tenant_access on services;
create policy multi_tenant_access on services
  for all to authenticated
  using (
    public.current_user_role() = 'super_admin'
    or client_id = public.current_user_client_id()
  )
  with check (
    public.current_user_role() = 'super_admin'
    or client_id = public.current_user_client_id()
  );

-- ─── TICKETS ─────────────────────────────────────────────────
alter table tickets enable row level security;
drop policy if exists authenticated_full_access on tickets;
drop policy if exists multi_tenant_access on tickets;
create policy multi_tenant_access on tickets
  for all to authenticated
  using (
    public.current_user_role() = 'super_admin'
    or client_id = public.current_user_client_id()
  )
  with check (
    public.current_user_role() = 'super_admin'
    or client_id = public.current_user_client_id()
  );

commit;

-- ─── VERIFICACIÓN POST-CUTOVER ───────────────────────────────
-- Run estos selects manualmente después del COMMIT para confirmar:
--
-- 1. Lista de policies activas:
--    select schemaname, tablename, policyname, cmd
--    from pg_policies
--    where schemaname = 'public'
--    order by tablename, policyname;
--
-- 2. Tu sesión sigue funcionando — refrescar el panel y verificar
--    que ves todos los clientes / tickets / etc.
--
-- 3. Si algo se rompió: revisa que tu profile en user_profiles
--    tiene role = 'super_admin'.
