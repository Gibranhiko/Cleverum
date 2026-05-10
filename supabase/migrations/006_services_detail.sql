-- ═══════════════════════════════════════════════════════════
-- CLEVERUM — Services detail: image_url + examples + bucket
-- ═══════════════════════════════════════════════════════════

-- ─── Nuevas columnas en services ─────────────────────────────
alter table services add column if not exists image_url text;
alter table services add column if not exists examples text;

-- ─── Bucket público `services` ───────────────────────────────
insert into storage.buckets (id, name, public)
values ('services', 'services', true)
on conflict (id) do nothing;

-- ─── Storage policies: agregar `services` al write multi-tenant
-- (read es libre porque el bucket es público)
drop policy if exists multi_tenant_storage_write on storage.objects;
create policy multi_tenant_storage_write on storage.objects
  for all
  to authenticated
  using (
    bucket_id in ('documents', 'calendar-keys', 'tickets', 'services')
    and (
      public.current_user_role() = 'super_admin'
      or (storage.foldername(name))[1] = public.current_user_client_id()::text
    )
  )
  with check (
    bucket_id in ('documents', 'calendar-keys', 'tickets', 'services')
    and (
      public.current_user_role() = 'super_admin'
      or (storage.foldername(name))[1] = public.current_user_client_id()::text
    )
  );
