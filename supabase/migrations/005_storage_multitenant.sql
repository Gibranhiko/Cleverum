-- ═══════════════════════════════════════════════════════════
-- CLEVERUM — Storage Multi-Tenant Policies (E-04)
-- Buckets privados (calendar-keys, documents, tickets) usan
-- el primer segmento del path como filtro de client_id.
-- Convención: `{client_id}/...rest`
-- Bucket `products` queda público (sin cambio).
-- ═══════════════════════════════════════════════════════════

begin;

-- ─── Crear bucket `tickets` si no existe (privado) ───────────
insert into storage.buckets (id, name, public)
values ('tickets', 'tickets', false)
on conflict (id) do nothing;

-- ─── Asegurar que `documents` y `calendar-keys` son privados ──
update storage.buckets set public = false
where id in ('documents', 'calendar-keys', 'tickets');

-- ─── Drop policies anteriores ────────────────────────────────
drop policy if exists "authenticated_calendar_keys_access" on storage.objects;
drop policy if exists multi_tenant_storage on storage.objects;
drop policy if exists multi_tenant_storage_select on storage.objects;
drop policy if exists multi_tenant_storage_write on storage.objects;

-- ─── Multi-tenant policy: SELECT ─────────────────────────────
create policy multi_tenant_storage_select on storage.objects
  for select
  to authenticated
  using (
    bucket_id in ('documents', 'calendar-keys', 'tickets')
    and (
      public.current_user_role() = 'super_admin'
      or (storage.foldername(name))[1] = public.current_user_client_id()::text
    )
  );

-- ─── Multi-tenant policy: INSERT/UPDATE/DELETE ───────────────
create policy multi_tenant_storage_write on storage.objects
  for all
  to authenticated
  using (
    bucket_id in ('documents', 'calendar-keys', 'tickets')
    and (
      public.current_user_role() = 'super_admin'
      or (storage.foldername(name))[1] = public.current_user_client_id()::text
    )
  )
  with check (
    bucket_id in ('documents', 'calendar-keys', 'tickets')
    and (
      public.current_user_role() = 'super_admin'
      or (storage.foldername(name))[1] = public.current_user_client_id()::text
    )
  );

commit;

-- ─── VERIFICACIÓN POST ───────────────────────────────────────
-- 1. Buckets configurados:
--    select id, public from storage.buckets;
--    Expected: products (public=true), documents/calendar-keys/tickets (public=false)
--
-- 2. Policies activas en storage.objects:
--    select policyname, cmd from pg_policies
--    where schemaname = 'storage' and tablename = 'objects';
--
-- 3. Test desde panel (como super_admin):
--    - Subir un service account JSON en ClienteModal → debe funcionar
--    - El chatbot (service role) sigue descargando sin problema
