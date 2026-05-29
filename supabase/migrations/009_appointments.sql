-- ═══════════════════════════════════════════════════════════
-- CLEVERUM — Citas con slots (bot informativo + agenda)
-- Devplan: docs/devplan-citas.md
-- ═══════════════════════════════════════════════════════════
-- Agrega:
--   - appointment_settings : config de agenda por cliente (1 fila)
--   - appointments         : citas (espejo del Google Calendar + panel)
-- Doble escritura: cada cita vive en Calendar Y aquí (decisión D2/A2).
-- Anti doble-reserva: unique index por (client_id, starts_at) (A3).
-- ═══════════════════════════════════════════════════════════

-- ─── APPOINTMENT_SETTINGS (1 fila por cliente) ───────────────
create table if not exists appointment_settings (
  client_id uuid primary key references clients(id) on delete cascade,
  enabled boolean not null default false,          -- master switch del flujo de slots
  timezone text not null default 'America/Mexico_City',

  -- Horario de atención: array de 7 (índice 0=domingo .. 6=sábado).
  -- null en una posición = cerrado ese día. Cada día:
  --   { "open":"09:00", "close":"14:00", "open2":"16:00", "close2":"19:00" }
  -- open2/close2 opcionales (horario partido).
  weekly_hours jsonb not null default '[]'::jsonb,

  slot_minutes int not null default 30,            -- duración de cada cita
  buffer_minutes int not null default 0,           -- colchón entre citas
  lead_time_minutes int not null default 120,      -- anticipación mínima
  horizon_days int not null default 30,            -- ventana a futuro
  max_slots_listed int not null default 8,         -- tope por mensaje (WA list máx 10)

  closed_dates jsonb not null default '[]'::jsonb, -- ['YYYY-MM-DD', ...] feriados/vacaciones

  service_label text not null default 'Servicio',  -- "Especialidad" para hospital
  use_services_catalog boolean not null default false, -- true = especialidades desde tabla services

  -- Campos extra de intake (genérico). Ej hospital:
  -- [{ "key":"seguro","label":"Seguro médico","type":"list",
  --    "options":["GNP","AXA","Particular"],"required":true }]
  intake_fields jsonb not null default '[]'::jsonb,

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ─── APPOINTMENTS ────────────────────────────────────────────
create table if not exists appointments (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,

  -- Paciente
  customer_phone text not null,
  customer_name text,

  -- Cita
  service text,                       -- especialidad/servicio
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  extra jsonb not null default '{}'::jsonb,  -- campos configurables (seguro, etc.)

  -- Workflow
  status text not null default 'nueva'
    check (status in ('nueva','confirmada','completada','cancelada','no_asistio')),
  status_history jsonb not null default '[]'::jsonb,
  origin text not null default 'whatsapp'
    check (origin in ('whatsapp','panel')),

  -- Sync con Google Calendar
  calendar_event_id text,
  calendar_synced boolean not null default false,

  internal_notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ─── ÍNDICES ─────────────────────────────────────────────────
-- Anti doble-reserva (A3): un solo appointment activo por slot-inicio del cliente.
-- Dos pacientes que confirman el mismo slot → uno gana, el otro recibe error.
create unique index if not exists uq_appointments_slot
  on appointments (client_id, starts_at)
  where status <> 'cancelada';

create index if not exists idx_appointments_client_start on appointments (client_id, starts_at);
create index if not exists idx_appointments_status on appointments (client_id, status);
create index if not exists idx_appointments_phone on appointments (client_id, customer_phone);

-- ─── RLS (patrón multi_tenant_access — ver migración 004) ────
alter table appointment_settings enable row level security;
alter table appointments enable row level security;

drop policy if exists multi_tenant_access on appointment_settings;
create policy multi_tenant_access on appointment_settings
  for all to authenticated
  using (public.current_user_role() = 'super_admin' or client_id = public.current_user_client_id())
  with check (public.current_user_role() = 'super_admin' or client_id = public.current_user_client_id());

drop policy if exists multi_tenant_access on appointments;
create policy multi_tenant_access on appointments
  for all to authenticated
  using (public.current_user_role() = 'super_admin' or client_id = public.current_user_client_id())
  with check (public.current_user_role() = 'super_admin' or client_id = public.current_user_client_id());

-- ─── REALTIME ────────────────────────────────────────────────
-- Habilitar realtime para `appointments` desde el Dashboard:
-- Database → Replication → Supabase Realtime → appointments
-- (igual que orders / leads / tickets)
