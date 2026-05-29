# Devplan — Citas con slots (bot `informativo` + agenda)

> Evolución del bot `informativo` actual. **No es un bot type nuevo.** Toma el flujo de
> citas conversacional que ya existe ([infoBot.ts](../chatbot/src/flows/infoBot.ts)) y le
> agrega: (1) **listado de horarios disponibles por día** desde Google Calendar, (2)
> **selección de horario por List/Buttons nativos de WhatsApp**, (3) **panel de Citas** con
> estados, y (4) **doble escritura** (Google Calendar + tabla propia `appointments`).
>
> Referencia visual: infografía "Hospital Aurora — Agenda tu cita en WhatsApp en menos de
> 60 segundos" (6 pasos). El hospital es **un cliente más**; el flujo es **genérico** y
> configurable por cliente.

---

## 0. Decisiones de producto (confirmadas con el usuario)

| # | Decisión |
|---|---|
| D1 | La **disponibilidad sale de Google Calendar** (fuente de verdad de qué está libre). |
| D2 | Igual se quiere **panel propio** (tabla `appointments`) y la cita se agenda en **ambos lados** (Calendar + DB). |
| D3 | **No** es un bot type nuevo. Es genérico para `informativo` + citas. |
| D4 | Se deben **listar los horarios disponibles según el día**. |
| D5 | **Un solo calendario por cliente** (Fase 1). Multi-recurso/por-doctor queda para Fase 2. |
| D6 | Las especialidades/servicios salen del **catálogo configurable** (tabla `services`), mostradas como List determinista. |
| D7 | La configuración de citas vive en una **página nueva "Config Citas"** en el panel. |

---

## 1. Goals & non-goals

### Goals
- Paciente agenda una cita por WhatsApp en **< 60 s**, eligiendo de **horarios reales libres**.
- Los horarios se calculan en **tiempo real** desde Google Calendar (busy/free) cruzados con el horario de atención del cliente.
- La cita queda registrada en **dos lados a la vez**: evento en Google Calendar **y** fila en `appointments`.
- El operador ve las citas en un **panel "Citas"** con tabs por estado (Nuevas / Confirmadas / Completadas / Canceladas), filtros y cambio manual de estado.
- **Notificación realtime** al panel cuando entra una cita nueva (igual que `orders`/`leads`/`tickets`).
- Todo **genérico y configurable por cliente** (etiquetas, horarios, duración, campos de intake, especialidades, seguros). El hospital es solo una configuración.
- **Backward-compatible**: los clientes `informativo` que hoy usan el flujo viejo de citas no se rompen. La funcionalidad de slots es **opt-in**.

### Non-goals (Fase 1)
- Reprogramar / cancelar cita **desde WhatsApp** por el paciente (Fase 2 — requiere búsqueda por folio/identidad).
- Recordatorios outbound proactivos (depende de F6 templates — `docs/whatsapp-compliance.md`).
- Pagos / anticipos.
- Multi-recurso real (varios doctores con agendas separadas por especialidad) — Fase 2. En Fase 1: **un calendario por cliente**.
- Sincronización bidireccional avanzada (si alguien borra el evento en Calendar, no se refleja automático en el panel) — Fase 2.
- Pantalla de calendario visual en el panel (Fase 2). Fase 1 = tabla con tabs.

---

## 2. Decisiones de arquitectura

### A1 — Calendar es la fuente de verdad de disponibilidad; la DB es espejo + red de seguridad
La disponibilidad se calcula así:

```
slots_libres(día) = grid_horario_atención(día)
                    − (busy de Google Calendar)
                    − (appointments en DB ese día, no canceladas)
```

Calendar manda (D1), pero **también restamos las filas de `appointments`** por si una
escritura a Calendar falló y quedó solo en DB (evita ofrecer un slot que ya tomamos). Esto
hace el cálculo robusto ante fallas parciales sin introducir doble fuente de verdad: el
grid siempre se reconstruye en vivo, nunca se "cachea" disponibilidad.

### A2 — Doble escritura con orden definido + idempotencia
Al confirmar (D2), el orden es:

1. **Re-check** del slot exacto contra Calendar (`checkAvailability`) — el slot pudo ocuparse entre que se listó y se confirmó.
2. **Insert** en `appointments` con `status='nueva'`, `calendar_event_id=null`. La fila nace primero para que **el panel siempre tenga registro** aunque Calendar falle.
3. **Create event** en Google Calendar.
4. **Update** de la fila con `calendar_event_id` y `calendar_synced=true`.

Si el paso 3 falla: la fila queda con `calendar_synced=false` (badge "⚠ sin sincronizar" en el panel) y **igual se confirma al paciente** (la cita existe en el panel; el operador la mete a mano a su calendario o se reintenta). Si el paso 2 falla: se aborta y se le pide reintentar al paciente (no se crea evento huérfano).

Se guarda `idempotency_key` (= `clientId + phone + slot_start`) con **unique index** para que dos taps rápidos del mismo usuario no creen dos citas.

### A3 — Anti-doble-reserva (TOCTOU)
Entre "listar slots" y "confirmar" hay una ventana donde otro paciente puede tomar el mismo horario. Mitigaciones combinadas:
- **Re-check contra Calendar** justo antes de crear (paso A2.1).
- **Unique partial index** en `appointments (client_id, starts_at)` `where status not in ('cancelada')` — si dos pacientes confirman el mismo slot, **uno gana** (el segundo recibe error de constraint → se le re-listan slots). Esto cubre el caso "dos usuarios de WhatsApp al mismo tiempo" de forma determinista, que el re-check de Calendar **no** garantiza por sí solo (el evento del primero puede no haberse propagado en freebusy todavía).
- Riesgo residual: evento creado **externamente** en Calendar en ese milisegundo — lo atrapa el re-check en la mayoría de casos; el resto es aceptable para Fase 1.

### A4 — El selector de horario es WhatsApp nativo, no IA
Coherente con la decisión de arquitectura #1 del proyecto (CLAUDE.md). La IA **recolecta datos** (nombre, especialidad, día preferido, campos extra) y **clasifica intención**, pero **no inventa horarios**. Los slots se mandan como **List Message** (hasta 10) o **Reply Buttons** (≤3). El paciente **tapea**; la IA nunca "adivina" disponibilidad.

### A5 — Genérico vía configuración, no hardcode
Nada de "hospital" en el código. Una tabla `appointment_settings` (1 fila por cliente) define:
- Etiqueta del "servicio" (`service_label`: "Servicio" por default, "Especialidad" para hospital).
- Horario de atención por día de la semana, duración de slot, buffer, lead-time, horizonte.
- Campos extra de intake (`intake_fields` JSON — ej. el hospital agrega "Seguro médico").
- Lista de seguros aceptados (opcional).
- Si las **especialidades/servicios** salen de la tabla `services` existente (List determinista) o de texto libre.

Si un cliente **no tiene** `appointment_settings` ni Calendar configurado → **fallback al flujo viejo** (texto libre + token `CITA_CONFIRMADA`). Esto es la garantía de backward-compat (A1 de non-goals).

### A6 — Reuso del session state machine
Igual que `servicios`: `session.current_flow='appointment'`, `session.flow_step` para el paso, `session.state` (JSON) guarda el parcial. Steps nuevos definidos en §5.

### A7 — Reuso de `services` para especialidades
La tabla `services` (ya existe, multi-tenant) sirve como catálogo de especialidades. Para el hospital, cada especialidad ("Cardiología", "Traumatología"…) es una fila en `services`. Si el cliente tiene `services` activos → se presentan como List; si no → texto libre parseado por IA. Esto reusa la página **Servicios** del panel para configurarlas (hay que habilitar esa página para clientes `informativo`, no solo `servicios`).

---

## 3. Modelo de datos

### `appointment_settings` (nuevo — 1 fila por cliente)
```sql
create table appointment_settings (
  client_id uuid primary key references clients(id) on delete cascade,
  enabled boolean not null default false,        -- master switch del flujo de slots
  timezone text not null default 'America/Mexico_City',

  -- Horario de atención: array de 7 (dom..sáb). null = cerrado ese día.
  -- Cada día: { "open": "09:00", "close": "14:00", "open2": "16:00", "close2": "19:00" }
  -- (open2/close2 opcionales para partir mañana/tarde)
  weekly_hours jsonb not null default '[]'::jsonb,

  slot_minutes int not null default 30,          -- duración de cada cita
  buffer_minutes int not null default 0,         -- colchón entre citas
  lead_time_minutes int not null default 120,    -- mínimo de anticipación (no agendar "ya mismo")
  horizon_days int not null default 30,          -- cuántos días al futuro se puede agendar
  max_slots_listed int not null default 8,       -- tope de slots por mensaje (WA list máx 10)

  -- Días cerrados (feriados, vacaciones): array de fechas 'YYYY-MM-DD'
  closed_dates jsonb not null default '[]'::jsonb,

  -- Genérico / labels
  service_label text not null default 'Servicio',   -- "Especialidad" para hospital
  use_services_catalog boolean not null default false, -- true = especialidades desde tabla services

  -- Campos extra de intake (genérico). Ej hospital:
  -- [{ "key":"seguro","label":"Seguro médico","type":"list","options":["GNP","AXA","Particular"],"required":true }]
  intake_fields jsonb not null default '[]'::jsonb,

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

### `appointments` (nuevo)
```sql
create table appointments (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,

  -- Paciente
  customer_phone text not null,
  customer_name text,

  -- Cita
  service text,                  -- "Cardiología" (especialidad/servicio)
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  extra jsonb not null default '{}'::jsonb,   -- campos configurables (seguro, etc.)

  -- Workflow
  status text not null default 'nueva'
    check (status in ('nueva','confirmada','completada','cancelada','no_asistio')),
  status_history jsonb not null default '[]'::jsonb,
  origin text not null default 'whatsapp'     -- 'whatsapp' | 'panel'
    check (origin in ('whatsapp','panel')),

  -- Sync con Google Calendar
  calendar_event_id text,
  calendar_synced boolean not null default false,

  internal_notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Anti doble-reserva (A3): un solo appointment activo por slot-inicio del cliente
create unique index uq_appointments_slot
  on appointments (client_id, starts_at)
  where status <> 'cancelada';

create index idx_appointments_client_start on appointments (client_id, starts_at);
create index idx_appointments_status on appointments (client_id, status);
create index idx_appointments_phone on appointments (client_id, customer_phone);
```

### RLS (obligatorio — patrón `multi_tenant_access` de [004](../supabase/migrations/004_rls_multitenant_cutover.sql))
```sql
alter table appointment_settings enable row level security;
alter table appointments enable row level security;

create policy multi_tenant_access on appointment_settings
  for all to authenticated
  using (public.current_user_role() = 'super_admin' or client_id = public.current_user_client_id())
  with check (public.current_user_role() = 'super_admin' or client_id = public.current_user_client_id());

create policy multi_tenant_access on appointments
  for all to authenticated
  using (public.current_user_role() = 'super_admin' or client_id = public.current_user_client_id())
  with check (public.current_user_role() = 'super_admin' or client_id = public.current_user_client_id());
```

### Realtime
Habilitar replicación realtime para `appointments` (Dashboard → Database → Replication), igual que `orders`/`leads`/`tickets`. La página engancha INSERT filtrado por `client_id`.

### Migración
`009_appointments.sql` con todo lo anterior + nueva página `citas` en `PAGE_KEYS`.

---

## 4. El motor de slots (lo más técnico — D4)

Nuevo método en [GoogleCalendarService](../chatbot/src/services/googleCalendar.ts):

```ts
async getAvailableSlots(
  day: Date,                 // día local (se normaliza a 00:00 tz)
  settings: AppointmentSettings,
  alreadyBookedInDb: {start: Date; end: Date}[]   // appointments DB de ese día
): Promise<Date[]>            // array de starts libres, ordenado
```

### Algoritmo
1. **Determinar tz y día**: normalizar `day` al inicio de día en `settings.timezone`. (México no tiene DST desde 2022 → offset fijo −06:00, pero se respeta `timezone` para futuro.)
2. **Cerrado?**: si el día está en `closed_dates` o `weekly_hours[weekday]` es null → retornar `[]`.
3. **Construir grid**: desde `open` hasta `close` (y `open2..close2` si hay), pasos de `slot_minutes + buffer_minutes`. Cada candidato = `[start, start + slot_minutes]`. El candidato debe **caber completo** antes de `close` (no slots que se pasen del cierre).
4. **Filtrar pasado**: descartar candidatos con `start < now + lead_time_minutes`.
5. **Filtrar horizonte**: descartar si `start > now + horizon_days`.
6. **Query Calendar freebusy** para `[dayStart, dayEnd]` → intervalos busy.
7. **Restar busy + DB**: quedarse con candidatos que **no se traslapan** con ningún busy de Calendar **ni** con `alreadyBookedInDb`. (Traslape = `start < busyEnd && end > busyStart`.)
8. **Cap**: retornar los primeros `max_slots_listed`.

### Helper de "próximos días con disponibilidad"
```ts
async getNextAvailableDays(fromDay, settings, n=5): Promise<Date[]>
```
Itera día por día (hasta `horizon_days`) y devuelve los primeros `n` días que tengan ≥1 slot. Usado cuando el día pedido está lleno/cerrado.

> ⚠️ **Costo**: `getNextAvailableDays` puede hacer hasta `horizon_days` queries freebusy. Mitigación: una sola query freebusy del rango completo `[from, from+horizon]` y partir los busy por día en memoria. Implementarlo así desde el inicio.

---

## 5. Flujo del bot (máquina de estados)

`current_flow = 'appointment'`. Steps:

| flow_step | Quién actúa | Qué hace |
|---|---|---|
| `collecting` | IA | Recolecta nombre, teléfono, servicio/especialidad, **día preferido**, + `intake_fields` extra. Cuando están todos → pasa a `picking_day` o `picking_slot`. |
| `picking_day` | Bot (nativo) | (Solo si el día preferido no sirve.) Manda List de próximos días disponibles. Tap → `picking_slot`. |
| `picking_slot` | Bot (nativo) | Calcula slots del día elegido. Manda List (ids tipo `slot_<ISO>`). Si 0 slots → va a `picking_day`. Tap → `confirming`. |
| `confirming` | Bot (nativo) | Muestra resumen (nombre, especialidad, fecha/hora, seguro…) + Buttons **Confirmar / Cambiar**. |
| (confirm) | Bot | Re-check + doble escritura (§A2) → mensaje de confirmación → cierra flow. |

### Diagrama
```
texto libre → IA intent="agendar_cita"
   → collecting (IA junta datos, 1 x 1)
        falta algo → sigue preguntando
        completo   → picking_slot (con día preferido)
   → picking_slot
        hay slots  → manda lista → awaiting tap
        0 slots    → picking_day (lista de días) → tap → picking_slot
   → confirming (resumen + Confirmar/Cambiar)
        Confirmar  → re-check → insert DB → create event → update → ✅ confirmación
        Cambiar    → picking_slot (re-lista mismo día) o picking_day
```

### Mapeo de campos genérico → hospital
| Campo genérico | Hospital (vía `appointment_settings`) |
|---|---|
| `customer_name` | Nombre completo |
| `service` | Especialidad (`service_label="Especialidad"`, catálogo desde `services`) |
| día/hora | slot elegido |
| `extra.seguro` | Seguro médico (`intake_fields`) |
| `customer_phone` | del `from` de WhatsApp (no se pregunta si ya se tiene) |

---

## 6. Edge cases (exhaustivo)

### Cálculo / listado de slots
1. **Día pedido en el pasado** → no listar; ofrecer próximos días.
2. **Hoy pero ya pasó la hora / dentro del lead-time** → filtrar esos slots; si quedan 0, ofrecer próximos días.
3. **Día cerrado** (weekend, feriado en `closed_dates`, día sin `weekly_hours`) → mensaje "ese día no atendemos" + próximos días.
4. **Día lleno** (todos los slots busy) → próximos días disponibles.
5. **> 10 slots libres** → WhatsApp List solo permite 10 rows. Cap a `max_slots_listed` (default 8) + opción "Ver otro día / más tarde".
6. **Exactamente 1–3 slots** → usar Reply Buttons (más rápido) en vez de List.
7. **Slot que cruza el cierre** (ej. cita de 30 min a las 13:45 con cierre 14:00) → no ofrecer (debe caber completo).
8. **Horario partido** (mañana + tarde) → soportado por `open2/close2`.
9. **Evento all-day en Calendar** (ej. "cerrado por feria") → freebusy lo marca busy todo el día → 0 slots → próximos días. ✅ se maneja solo.
10. **Eventos recurrentes** en Calendar → freebusy los incluye. ✅.
11. **Timezone / DST** → fijar `America/Mexico_City`; documentar que MX no usa DST desde 2022. Construir ISO con offset explícito, nunca `new Date(string)` ambiguo.
12. **Calendar API falla/timeout al listar** → **no fabricar slots**. Mensaje: "No pude consultar la disponibilidad ahora mismo, ¿intentamos en un momento?" + opción de dejar datos para que recepción contacte (fallback degradado). (Distinto del `checkAvailability` actual que asume libre — para **listar** eso sería peligroso.)
13. **Cliente sin Calendar configurado pero con `appointment_settings.enabled`** → no se puede calcular disponibilidad real → fallback a flujo viejo (texto libre) o avisar. Decidir: por ahora, `enabled` requiere Calendar; si falta, log + flujo viejo.

### Selección / confirmación
14. **Slot expira entre listar y tapear** (usuario tardó) → re-check al confirmar; si ocupado → "ese horario se acaba de ocupar" + re-listar.
15. **Doble tap rápido / doble confirm** → `idempotency_key` + unique index → segunda inserción no crea cita; responder con la cita ya creada.
16. **Dos pacientes, mismo slot** → unique index `uq_appointments_slot` → el segundo recibe error → re-listar (§A3).
17. **Usuario tapea una lista vieja** (de una conversación anterior) → el `slot_<ISO>` apunta a un horario pasado o ya inválido → validar (futuro + lead-time + sigue libre); si no, re-listar.
18. **Usuario escribe texto en vez de tapear** estando en `picking_slot` (ej "a las 10") → intentar mapear el texto a un slot listado; si coincide, proceder; si no, re-mandar la lista. Si escribe "otra fecha"/"otro día" → `picking_day`.
19. **Usuario tapea "Cambiar"** en confirming → volver a `picking_slot` (mismo día) con opción de cambiar día.
20. **Usuario abandona a media conversación** y vuelve días después → la sesión persiste (`conversation_sessions`); el día/slot guardado puede ya no ser válido → al retomar, re-validar y re-listar. Considerar **TTL del flow**: si `state` tiene > X horas, reiniciar `collecting`.

### Intake / datos
21. **Especialidad que el cliente no ofrece** (no está en `services`) → si `use_services_catalog`, presentar solo las válidas (List); si texto libre, la IA debe pedir aclaración.
22. **Seguro no aceptado** (no está en options) → permitir "Otro/Particular"; guardar el texto en `extra`.
23. **Nombre/teléfono faltante** → la IA los pide 1×1 (ya lo hace). El teléfono **default = `from`**; solo preguntar si se requiere otro.
24. **Campos `intake_fields` mal configurados** (JSON inválido) → degradar a intake mínimo + log; no romper el flujo.
25. **Mensaje multimedia** (audio/imagen) en medio del flujo → el webhook ya ignora no-texto/no-interactive ([handler.ts:133](../chatbot/src/webhook/handler.ts#L133)); considerar responder "por ahora solo texto" en vez de silencio.

### Doble escritura / sync
26. **DB ok, Calendar falla** → cita confirmada en panel con `calendar_synced=false` (badge ⚠) → operador la sincroniza; opción "Reintentar sync" en el panel.
27. **DB falla** (constraint/red) → abortar, **no** crear evento; pedir reintentar al paciente.
28. **Calendar ok, update de event_id falla** → fila queda `nueva` sin `event_id`; job/acción de reconciliación por `starts_at+phone`. Log con el `event_id` para no perderlo.
29. **Operador borra el evento en Calendar a mano** → Fase 1 no lo detecta (non-goal). Documentar.
30. **Operador cancela la cita en el panel** → marcar `status='cancelada'` y **borrar el evento de Calendar** (best-effort). El slot vuelve a quedar libre (el unique index lo permite por el `where status<>'cancelada'`).

### Multi-tenant / seguridad
31. **`user` de otro cliente** → RLS bloquea; el panel filtra por `client_id`. El bot (service role) escribe con `client_id` explícito.
32. **Página `citas` no permitida para un `user`** → respeta `allowed_pages` (igual que tickets). `citas` **sí** puede otorgarse a `user` (no es super_admin-only).

### WhatsApp / plataforma
33. **Límites de List**: ≤10 rows totales, title ≤24, description ≤72, sectionTitle ≤24, button ≤20. Validar al construir; truncar etiquetas largas de especialidad.
34. **`slot_<ISO>` id** ≤ 200 chars (sobra). Formato: `slot_2026-06-15T10:00`.
35. **Ventana de 24h de WhatsApp**: el flujo es **reactivo** (el paciente escribió primero) → siempre dentro de ventana. La **confirmación** también. Sin templates (eso es F6, para outbound proactivo). ✅ sin riesgo.
36. **Reenvío del mismo webhook** (Meta reintenta si no recibe 200 a tiempo) → el handler ya responde 200 inmediato; aun así, `idempotency_key` cubre duplicados de booking.

---

## 7. Epics & tickets

### Epic A — DB & config (Supabase)
- **A1** Migración `009_appointments.sql`: tablas `appointment_settings` + `appointments`, índices, unique slot index, RLS `multi_tenant_access`.
- **A2** Habilitar realtime para `appointments`.
- **A3** Seed/config inicial de Wabbi-hospital (horarios, especialidades en `services`, `intake_fields` con seguro).

### Epic B — Backend: motor de slots + booking
- **B1** Tipos `AppointmentSettings`, `AppointmentRow` en `chatbot/src/types`.
- **B2** `GoogleCalendarService.getAvailableSlots()` + `getNextAvailableDays()` (1 sola query freebusy del rango).
- **B3** `lib/appointments.ts`: `bookAppointment()` (re-check → insert DB → create event → update; maneja §A2/§A3), `cancelAppointment()`.
- **B4** `services/ai.ts`: ajustar `determineAppointment` para extraer **día preferido** (no hora exacta) + campos `intake_fields` dinámicos. Nuevo tool o parámetros opcionales.
- **B5** Loader de `appointment_settings` con cache (igual que `getCachedBotConfig`).

### Epic C — Backend: rewire del flujo del bot
- **C1** Reescribir `infoBot.ts` flujo appointment a la máquina de estados §5 (collecting → picking_slot → picking_day → confirming → book).
- **C2** Construcción de List/Buttons de slots y días (`sendList`/`sendButtons` ya existen).
- **C3** Router de `interactive` (list_reply/button_reply) hacia los steps (`slot_*`, `day_*`, `confirm_*`, `change_*`).
- **C4** Prompt nuevo `prompt-appointment-slots.txt` (recolecta datos + día, **no** hora, **no** confirma con token; el bot toma el control para slots).
- **C5** Fallback al flujo viejo si `!settings.enabled || !calendar`.
- **C6** Manejo de edge cases del §6 (12, 14, 17, 18, 20, 25).

### Epic D — Frontend: panel de Citas
- **D1** Página `Citas.tsx` (copiar patrón de `Tickets`): tabla con Paciente, Servicio/Especialidad, Fecha, Hora, Estado, Origen; tabs Nuevas/Confirmadas/Completadas/Canceladas; contadores.
- **D2** Cambio de estado (nueva→confirmada→completada / cancelada / no_asistió) con `status_history`.
- **D3** Badge `calendar_synced` (⚠ sin sincronizar) + acción "Reintentar sync".
- **D4** Crear cita manual desde el panel (`origin='panel'`) — opcional Fase 1.5.
- **D5** Realtime: notificación al entrar cita nueva (engancha INSERT por `client_id`, suma a `notifications`).
- **D6** Registrar página en `lib/permissions.ts` `PAGE_KEYS` (`citas`, otorgable a `user`).
- **D7** Link en `Navbar.tsx` (icono calendario).
- **D8** Página nueva **"Config Citas"** (D7): horarios por día, slot/buffer/lead-time/horizonte, `intake_fields`, seguros aceptados, `enabled`. Registrar en `PAGE_KEYS` + Navbar.
- **D9** Habilitar página **Servicios** para `informativo` (para configurar especialidades, D6) — revisar gating actual.

### Epic E — Test & deploy
- **E1** Tests del motor de slots (unit): grid, pasado, cerrado, lleno, horario partido, traslapes, cap, DST/tz.
- **E2** Test de `bookAppointment`: doble escritura, re-check, idempotencia, unique constraint, fallas parciales (mock Calendar).
- **E3** Test E2E manual con número real (ver §8).
- **E4** Aplicar migración 009 en prod + habilitar realtime + configurar Wabbi.
- **E5** Actualizar `docs/architecture.md` y CLAUDE.md (status F + nueva tabla/página).

---

## 8. Plan de pruebas (E2E manual)

1. Configurar `appointment_settings` de Wabbi (`enabled=true`, horarios L-V 9-14, slot 30 min, lead 2h, especialidades en `services`, seguro en `intake_fields`) + Calendar conectado.
2. Resetear sesión (borrar fila en `conversation_sessions` + reiniciar bot — ver flujo de prueba del mascot).
3. WhatsApp: "Hola, quiero una cita" → IA pide nombre → especialidad (List si catálogo) → seguro → día.
4. Verificar **lista de slots reales** del día (cruzados con un evento de prueba metido a mano en Calendar → ese horario **no** debe aparecer).
5. Tapear slot → resumen → Confirmar.
6. Verificar: ✅ confirmación en WhatsApp, ✅ evento en Google Calendar, ✅ fila en `appointments` (`status='nueva'`, `calendar_synced=true`), ✅ notificación realtime en el panel.
7. Edge: dos teléfonos confirmando el mismo slot (uno debe fallar y re-listar). Día lleno → próximos días. Tapear lista vieja → re-valida.

---

## 9. Orden de implementación sugerido
`A1 → B1 → B2 (+E1) → A2 → B3 (+E2) → B5 → B4 → C4 → C1 → C2/C3 → C5/C6 → D1/D5/D6/D7 → D2/D3 → D8/D9 → E3 → E4 → E5`

Entrega incremental: con A+B+C+D1/D5 ya hay flujo funcional end-to-end; D2/D3/D8 pulen operación.

---

## 10. Riesgos / preguntas abiertas
- ~~**R1 — Un calendario por cliente vs por especialidad/doctor.**~~ ✅ **Resuelto (D5):** uno por cliente en Fase 1. Multi-recurso = Fase 2.
- ~~**R2 — ¿Dónde vive la config de citas en el panel?**~~ ✅ **Resuelto (D7):** página nueva "Config Citas".
- ~~**R3 — Especialidades: catálogo o texto libre?**~~ ✅ **Resuelto (D6):** catálogo (`services`), List determinista. Requiere habilitar Servicios para `informativo` (D9).
- **R4 — Costo de freebusy** en `getNextAvailableDays` (mitigado con query única de rango, B2).
- **R5 — Reprogramar/cancelar desde WhatsApp**: confirmado Fase 2.
