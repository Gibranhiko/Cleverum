-- ═══════════════════════════════════════════════════════════
-- CLEVERUM — Bot type `servicios` (taller / repair shop / service business)
-- ═══════════════════════════════════════════════════════════

-- ─── EXTENDER CLIENTS ────────────────────────────────────────
alter table clients drop constraint if exists clients_bot_type_check;
alter table clients add constraint clients_bot_type_check
  check (bot_type in ('informativo', 'catalogo', 'leads', 'servicios'));

alter table clients add column if not exists ticket_prefix text;
alter table clients add column if not exists ticket_counter int default 0;

-- ─── SERVICIOS (catálogo configurable por cliente) ───────────
create table services (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  name text not null,
  description text,
  category text,
  price_amount numeric(10, 2),
  price_label text,
  estimated_duration text,
  is_active boolean default true,
  display_order int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ─── TICKETS (órdenes de servicio) ───────────────────────────
create table tickets (
  id uuid primary key default gen_random_uuid(),
  folio text not null,
  client_id uuid not null references clients(id) on delete cascade,
  customer_phone text not null,
  customer_name text,

  -- Intake data
  device_type text,
  device_brand text,
  device_model text,
  problem_description text,
  problem_category text,
  photos text[] default '{}',

  -- Workflow
  status text not null default 'recibido'
    check (status in ('recibido', 'diagnostico', 'cotizado', 'aprobado', 'en_reparacion', 'listo', 'entregado', 'rechazado', 'cancelado')),
  status_history jsonb default '[]'::jsonb,

  -- Comercial
  quote_amount numeric(10, 2),
  internal_notes text,

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ─── ÍNDICES ─────────────────────────────────────────────────
create index idx_services_client_active on services(client_id, is_active);
create index idx_services_display_order on services(client_id, display_order);

create unique index idx_tickets_folio on tickets(client_id, folio);
create index idx_tickets_phone on tickets(client_id, customer_phone);
create index idx_tickets_status on tickets(client_id, status);
create index idx_tickets_created on tickets(client_id, created_at desc);

-- ─── RLS ─────────────────────────────────────────────────────
alter table services enable row level security;
alter table tickets enable row level security;

create policy authenticated_full_access on services
  for all to authenticated using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy authenticated_full_access on tickets
  for all to authenticated using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- ─── FUNCIÓN: incrementar ticket_counter atómicamente ────────
-- Usar para generar folios secuenciales sin race conditions.
-- Devuelve el nuevo valor después del incremento.
create or replace function next_ticket_number(p_client_id uuid)
returns int
language plpgsql as $$
declare
  v_next int;
begin
  update clients
    set ticket_counter = ticket_counter + 1,
        updated_at = now()
  where id = p_client_id
  returning ticket_counter into v_next;

  return v_next;
end;
$$;

-- ─── REALTIME ────────────────────────────────────────────────
-- Habilitar realtime para `tickets` desde el Dashboard:
-- Database → Replication → Supabase Realtime → tickets
