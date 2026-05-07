# Devplan — Bot type `servicios`

> Cuarto bot type para negocios de servicios (talleres, salones, mecánicos, veterinarias).
> Filosofía: WhatsApp nativo (List Messages + Reply Buttons) por default, IA solo donde
> aporta valor real (FAQ con RAG, parsing de problemas en texto libre).

---

## 1. Goals & non-goals

### Goals
- Cliente puede levantar una orden de servicio desde WhatsApp en **menos de 60 segundos**
- Cliente puede consultar el status de su orden por folio
- Operador (admin panel) puede ver, filtrar y cambiar el status de tickets manualmente
- Operador puede configurar el catálogo de servicios que ofrece su negocio
- Bot reusa RAG existente para FAQ (no se reinventa)
- Cero IA en pasos donde una lista o botón resuelve mejor

### Non-goals (Fase 1)
- Notificaciones outbound proactivas cuando cambia el status (Fase 2)
- Aprobación de cotizaciones via botones (Fase 2)
- Pickup / delivery a domicilio (Fase 3)
- Pagos integrados (Fase 3)
- Reviews post-servicio (Fase 3)
- Configuración de intake form per-cliente desde panel (Fase 2 — Fase 1 usa form default)

---

## 2. Architectural decisions

### A1 — Servicios viven en DB, no en RAG
Los servicios y precios son **datos estructurados**. Se guardan en `services` table.
RAG se queda para FAQ (información no estructurada del documento de la empresa).
Esto evita hallucinations en precios y permite renderizar listas de WhatsApp directamente desde DB.

### A2 — Folio corto y legible
Cada cliente tiene un `ticket_prefix` (3-5 caracteres, ej: `DTR`). Folio = `{PREFIX}-{N}` donde N es secuencial **por cliente**. Ej: `DTR-1`, `DTR-2`.
Permite que el cliente lea el folio en voz alta sin confusión y lo escriba fácilmente.

### A3 — Intake form default (Fase 1)
Para Fase 1 el form de intake es **fijo por código** y se aplica a todos los clientes con bot_type `servicios`. En Fase 2 se hace configurable por cliente.

Form default:
1. **Tipo de equipo** → list (Celular, Computadora, Laptop, Tablet, Otro)
2. **Marca** → list (Apple, Samsung, Huawei, Xiaomi, HP, Lenovo, Dell, Otra)
3. **Modelo** → text libre
4. **Descripción del problema** → text libre (opcionalmente IA parsea)
5. **Foto del equipo** → media opcional
6. **Nombre completo** → text
7. **Confirmación** → buttons (Sí, crear orden / Modificar)

### A4 — IA solo en 3 lugares
- FAQ pre-intake ("¿arreglan iPhones?") — RAG existente
- Parseo de problema (input libre del campo 4) — clasificar en categoría
- Detección de intención de hablar con humano

Todo lo demás: lists / buttons / regex.

### A5 — Status query por folio
Cliente escribe `DTR-1234` → bot detecta patrón regex → consulta DB → responde con status actual + última nota del operador. Sin IA.

### A6 — Reuso del session manager
La máquina de estados de intake usa `session.current_flow = 'intake'` y `session.flow_step` para tracking. `session.state` guarda los datos parciales. Igual que `appointment` actual.

---

## 3. Data model

### `services` (nuevo)
```sql
create table services (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  name text not null,
  description text,
  category text,                -- agrupador para listas (ej: "Reparación", "Mantenimiento")
  price_amount numeric(10,2),   -- opcional
  price_label text,             -- "desde $500", "según diagnóstico"
  estimated_duration text,      -- "2-3 días"
  is_active boolean default true,
  display_order int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index idx_services_client_active on services(client_id, is_active);
```

### `tickets` (nuevo)
```sql
create table tickets (
  id uuid primary key default gen_random_uuid(),
  folio text not null,                    -- ej: "DTR-1234"
  client_id uuid not null references clients(id) on delete cascade,
  customer_phone text not null,
  customer_name text,
  
  -- intake data (estructurado)
  device_type text,                       -- "Celular", "Laptop", etc.
  device_brand text,                      -- "Apple", "Samsung"
  device_model text,                      -- texto libre
  problem_description text,
  problem_category text,                  -- parseo IA: "pantalla", "bateria", "software", "otro"
  photos text[],                          -- URLs Supabase Storage
  
  -- workflow
  status text not null default 'recibido',  -- enum abajo
  status_history jsonb default '[]'::jsonb, -- [{status, at, by, note}]
  
  -- comercial
  quote_amount numeric(10,2),
  internal_notes text,                     -- solo operador ve
  
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create unique index idx_tickets_folio on tickets(client_id, folio);
create index idx_tickets_phone on tickets(client_id, customer_phone);
create index idx_tickets_status on tickets(client_id, status);
```

**Status enum:**
- `recibido` — orden creada, aún no diagnosticada
- `diagnostico` — operador revisando el equipo
- `cotizado` — cotización enviada al cliente
- `aprobado` — cliente aprobó cotización
- `en_reparacion` — trabajando en el equipo
- `listo` — listo para recoger
- `entregado` — cerrado
- `rechazado` — cliente no aprobó cotización
- `cancelado` — cancelado por cualquier razón

### `clients` — agregar columna
```sql
alter table clients add column ticket_prefix text;
alter table clients add column ticket_counter int default 0;
```

`ticket_counter` se incrementa atómicamente al crear ticket y forma parte del folio.

### Realtime
Habilitar Supabase Realtime en `tickets` (igual que `orders`).

### RLS
Misma policy que el resto: `authenticated_full_access`.

---

## 4. Bot flow

### Menú principal (al recibir cualquier mensaje sin contexto)

```
[List Message]
  Header: "{COMPANY_NAME}"
  Body: "Hola, ¿en qué te puedo ayudar?"
  Sections:
    Servicios:
      🔧 Levantar orden          (id: menu_intake)
      📦 Consultar mi orden      (id: menu_status)
      💰 Servicios y precios     (id: menu_services)
    Información:
      ❓ Preguntas frecuentes    (id: menu_faq)
      👤 Hablar con un asesor    (id: menu_human)
```

### Branch 1 — Levantar orden (intake)

```
Step 1: device_type
  [List] ¿Qué tipo de equipo?
    • Celular  • Computadora  • Laptop  • Tablet  • Otro
    
Step 2: device_brand
  [List] ¿Marca?
    • Apple  • Samsung  • Huawei  • Xiaomi  • HP  • Lenovo  • Dell  • Otra
    
Step 3: device_model
  [Text] ¿Modelo? (ej: iPhone 13, Galaxy S22)
    
Step 4: problem
  [Text] Cuéntame qué le pasa al equipo
    → IA clasifica en problem_category (pantalla|bateria|software|carga|otro)
    
Step 5: photo (opcional)
  [Buttons] ¿Quieres adjuntar foto?
    • Sí, adjunto  • No, continuar
    [si tap "Sí"] Espera mensaje tipo image. Si llega → Storage.
    
Step 6: customer_name
  [Text] ¿Cuál es tu nombre completo?
    
Step 7: confirm
  [Buttons] 📋 Resumen:
  • Equipo: {brand} {model}
  • Problema: {description}
  • Cliente: {name}
  
  • ✅ Crear orden  • ✏️ Modificar
```

Al confirmar: crear ticket → responder con folio.

### Branch 2 — Consultar mi orden

```
[Text] Escribe tu folio (ej: DTR-1234)
  
[regex match {PREFIX}-\d+]
  → query tickets where folio = X
  → si existe: responder con status + última nota
  → si no: "No encontré esa orden, verifica el folio"
```

Si el cliente envía un folio directamente sin pasar por el menú, el bot lo detecta también.

### Branch 3 — Servicios y precios

```
[List] DB query → services where client_id = X and is_active
  Agrupado por category
  Cada item: {name} — {price_label or price_amount}
```

Si servicios > 10, paginar (WhatsApp List soporta máx 10 items por sección).

### Branch 4 — FAQ

Reusa el `infoBot` flow actual (RAG + AI conversation). Solo se entra aquí cuando el usuario tap "Preguntas frecuentes" o cuando el intent classifier detecta `consultar_empresa` / `consultar_servicios` en input libre.

### Branch 5 — Hablar con asesor

```
[Send] Dejo a un asesor humano contigo. Estará pronto contigo.
[updateSession] human_takeover = true
```

A partir de ahí el bot deja de responder hasta que el operador desactive el takeover desde el panel.

---

## 5. Tickets

### Epic A — Database foundation

#### A-01 — Crear migration `002_servicios.sql`

**Files:**
- `supabase/migrations/002_servicios.sql` (nuevo)

**Acceptance:**
- Tablas `services` y `tickets` creadas con índices y RLS habilitado
- Policy `authenticated_full_access` en ambas
- `clients` extendido con `ticket_prefix` y `ticket_counter`
- Realtime habilitado en `tickets`
- SQL aplicado en Supabase project `rbfxfnwgwzbvxwifzvad`

**Effort:** 0.5d

---

### Epic B — Backend: bot servicios

#### B-01 — Nuevo bot type en routing

**Files:**
- `chatbot/src/types.ts` — agregar `'servicios'` al union de bot_type
- `chatbot/src/webhook/handler.ts` — agregar case `'servicios': return handleServicesBot(ctx)`
- `chatbot/src/flows/servicesBot.ts` (nuevo)

**Acceptance:**
- Mensajes a clientes con `bot_type='servicios'` se enrutan al nuevo handler
- Type-checks pasan

**Effort:** 0.5d

---

#### B-02 — Menú principal con List Message

**Files:**
- `chatbot/src/flows/servicesBot.ts`

**Acceptance:**
- Cualquier mensaje del cliente sin `current_flow` activo dispara el menú
- El menú muestra 5 opciones (intake, status, services, faq, human)
- Tap en cada opción setea `current_flow` correspondiente y avanza al primer step
- Si el cliente escribe algo que matchea folio (regex), salta menú y va directo a status query

**Effort:** 0.5d

---

#### B-03 — Intake flow (state machine)

**Files:**
- `chatbot/src/flows/servicesBot.ts`
- `chatbot/src/lib/intakeForm.ts` (nuevo) — definición del form default

**Acceptance:**
- 7 steps implementados (device_type, device_brand, device_model, problem, photo, name, confirm)
- Cada step setea `session.flow_step` y persiste data parcial en `session.state`
- Listas de marcas tienen "Otra" como opción que abre branch a text libre
- Step `photo` permite skip con botón "No, continuar"
- Si cliente manda imagen tipo `image`, se descarga del WA media API y se sube a Supabase Storage bucket `tickets`
- Step `confirm` muestra resumen y dos botones
- Tap "Modificar" reinicia desde step 1 manteniendo data previa rellenada
- Tap "Crear orden" llama a B-04

**Effort:** 2d

---

#### B-04 — Crear ticket con folio

**Files:**
- `chatbot/src/lib/tickets.ts` (nuevo)
- `chatbot/src/flows/servicesBot.ts`

**Acceptance:**
- Función `createTicket(clientId, intakeData)` que:
  - Hace transacción: incrementa `clients.ticket_counter` atómicamente y obtiene el N nuevo
  - Construye folio = `{ticket_prefix}-{N}`
  - Inserta row en `tickets` con `status='recibido'`
  - Inserta entrada en `status_history`: `{status: 'recibido', at: now, by: 'bot', note: null}`
  - Devuelve folio y ticket id
- Si `client.ticket_prefix` es null, usar primeras 3 letras de `company_name` en mayúsculas
- Bot responde al cliente: "✅ Orden {folio} creada. Te avisaremos en cuanto tengamos novedades. Puedes consultar tu orden escribiendo el folio en cualquier momento."
- `current_flow` se resetea, `flow_step` null

**Effort:** 1d

---

#### B-05 — Status query por folio

**Files:**
- `chatbot/src/flows/servicesBot.ts`
- `chatbot/src/lib/tickets.ts`

**Acceptance:**
- Regex global: `/^([A-Z]{2,5})-(\d+)$/` matchea folios
- Función `getTicketStatusMessage(folio, clientId)` retorna texto formateado:
  - Si existe: "📦 Orden {folio}\n• Equipo: {brand} {model}\n• Status: {label_amigable}\n• Última actualización: {date}\n{última nota si existe}"
  - Si no: "No encontré esa orden. Verifica el folio."
- Mapping de status a label amigable (ej: `en_reparacion` → "En reparación 🔧")
- Funciona desde menú principal y como input libre

**Effort:** 0.5d

---

#### B-06 — Listado de servicios

**Files:**
- `chatbot/src/flows/servicesBot.ts`

**Acceptance:**
- Query a `services` donde `client_id` y `is_active=true`, ordenado por `display_order`
- Agrupar por `category` (categorías sin nombre van a "Otros")
- Renderizar como List Message — máximo 10 items por sección, paginar en mensajes adicionales si excede
- Cada item: `{name}` como title, `{price_label or "$" + price_amount}` como description
- Si no hay servicios activos: mensaje "Aún no tenemos servicios cargados. Pregunta directo a un asesor."

**Effort:** 0.5d

---

#### B-07 — FAQ via existing RAG

**Files:**
- `chatbot/src/flows/servicesBot.ts`

**Acceptance:**
- Tap en "Preguntas frecuentes" entra a flow `faq`
- Mensaje: "¿Qué quieres saber? Puedes preguntar libremente."
- Próximos mensajes del usuario se procesan con el mismo handler de `infoBot.ts` (RAG + AI conversation)
- Comando `menu` (texto) cierra el flow y vuelve al menú principal

**Effort:** 0.5d (es reuso, principalmente cableado)

---

#### B-08 — Hablar con humano

**Files:**
- `chatbot/src/flows/servicesBot.ts`

**Acceptance:**
- Tap en "Hablar con asesor" envía mensaje "Te conecto con un asesor humano. En breve te responde."
- `updateSession({ human_takeover: true, current_flow: null, flow_step: null })`
- Bot deja de responder a este número hasta que operador toggle desde panel

**Effort:** 0.25d

---

#### B-09 — Detección de intent en input libre

**Files:**
- `chatbot/src/flows/servicesBot.ts`
- `chatbot/src/services/ai.ts` — agregar tool `fn_get_services_intent`

**Acceptance:**
- Cuando llega texto libre sin flow activo y sin matchear folio, llamar al intent classifier:
  - intents: `levantar_orden`, `consultar_orden`, `ver_servicios`, `consultar_empresa`, `hablar_humano`, `saludo`
- Routing:
  - `levantar_orden` → empezar intake (B-03 step 1)
  - `consultar_orden` → "Escribe tu folio"
  - `ver_servicios` → B-06
  - `consultar_empresa` → B-07 (FAQ)
  - `hablar_humano` → B-08
  - `saludo` → menú principal (B-02)

**Effort:** 0.5d

---

#### B-10 — Parser de problema con IA

**Files:**
- `chatbot/src/services/ai.ts` — agregar tool `fn_classify_problem`

**Acceptance:**
- Tool con enum `problem_category`: `pantalla | bateria | software | carga | agua | otro`
- Input: descripción libre del cliente
- Output: categoría + descripción limpia
- Se llama en step 4 del intake. Resultado se guarda en `tickets.problem_category` y `problem_description`

**Effort:** 0.5d

---

### Epic C — Frontend admin

#### C-01 — Página Servicios (CRUD)

**Files:**
- `frontend/src/pages/Servicios.tsx` (nuevo)
- `frontend/src/components/ServicioModal.tsx` (nuevo)
- `frontend/src/App.tsx` — agregar ruta
- `frontend/src/layouts/DashboardLayout.tsx` — agregar item de nav

**Acceptance:**
- Tabla lista todos los servicios del cliente seleccionado
- Filtro por categoría
- Toggle de `is_active`
- Botones crear / editar / eliminar
- Modal con campos: name, description, category, price_amount, price_label, estimated_duration, display_order
- Solo visible cuando hay un cliente seleccionado con `bot_type='servicios'`

**Effort:** 1.5d

---

#### C-02 — Página Tickets

**Files:**
- `frontend/src/pages/Tickets.tsx` (nuevo)
- `frontend/src/components/TicketDetailModal.tsx` (nuevo)
- `frontend/src/App.tsx`, `DashboardLayout.tsx`

**Acceptance:**
- Tabla de tickets ordenados por `created_at` desc
- Columnas: folio, cliente (name + phone), equipo (brand+model), problema (truncado), status (badge), creado
- Filtros: status (multi-select), búsqueda por folio o teléfono
- Click abre modal detalle con:
  - Toda la data del ticket
  - Fotos (si existen) renderizadas
  - Status history como timeline
  - Selector de status (cambia → agrega entrada en status_history con `by='operator'`)
  - Campo de nota del operador (se agrega a status_history)
  - Campo de cotización (`quote_amount`)
  - Botón guardar cambios
- Realtime: cuando se crea ticket nuevo desde bot, aparece en lista sin refrescar

**Effort:** 2d

---

#### C-03 — ConfigBot extensiones para servicios

**Files:**
- `frontend/src/pages/ConfigBot.tsx`

**Acceptance:**
- Cuando `bot_type='servicios'` mostrar:
  - Campo `ticket_prefix` (validación: 2-5 caracteres, A-Z, único por cliente)
  - Mensaje de saludo personalizable (default: "Hola, ¿en qué te puedo ayudar?")
- Validar prefix antes de guardar — si choca con otro cliente, error

**Effort:** 0.5d

---

### Epic D — Testing & deploy

#### D-01 — End-to-end test manual

**Files:**
- N/A (manual)

**Acceptance:**
- Crear cliente nuevo con `bot_type='servicios'` y `ticket_prefix='TST'`
- Cargar 5 servicios via panel
- Indexar un doc FAQ
- Desde WhatsApp:
  - Saludar → menú aparece
  - Tap "Levantar orden" → completar 7 steps → orden creada con folio TST-1
  - Escribir "TST-1" → status mostrado correctamente
  - Tap "Servicios y precios" → lista renderiza
  - Tap "Preguntas frecuentes" → preguntar algo del FAQ → responde con RAG
  - Tap "Hablar con asesor" → bot deja de responder
- Desde panel:
  - Ticket aparece en lista (realtime)
  - Cambiar status a "diagnostico" → status_history actualiza
  - Toggle human_takeover off en sesión → bot vuelve a responder

**Effort:** 0.5d

---

#### D-02 — Deploy

**Files:**
- N/A

**Acceptance:**
- Migration aplicada en Supabase prod
- Chatbot deployed a Railway con código actualizado
- Frontend deployed a Cloudflare con código actualizado
- DTR migrado de `informativo` a `servicios` (cambiar `bot_type` y setear `ticket_prefix='DTR'`)
- Smoke test desde número real

**Effort:** 0.5d

---

## 6. Resumen de esfuerzo

| Epic | Tickets | Effort total |
|---|---|---|
| A — DB | 1 | 0.5d |
| B — Backend bot | 10 | 6.75d |
| C — Frontend admin | 3 | 4.0d |
| D — Testing & deploy | 2 | 1.0d |
| **Total** | **16** | **12.25d** ≈ **2.5 semanas** |

---

## 7. Orden recomendado

1. A-01 (DB)
2. B-01, B-02 (routing + menú) — punto de control: el menú se ve en WhatsApp
3. B-04 (crear ticket helper) — necesario para B-03
4. B-03 (intake flow) — el corazón del bot
5. B-05 (status query) — complementa intake
6. C-01 (servicios CRUD) — necesario para B-06
7. B-06 (listado servicios)
8. B-07, B-08 (FAQ + humano)
9. B-09, B-10 (IA en input libre + parser problema)
10. C-02 (tickets page)
11. C-03 (config bot)
12. D-01, D-02 (test + deploy)

---

## 8. Riesgos & mitigaciones

| Riesgo | Mitigación |
|---|---|
| WhatsApp List máximo 10 items → categorías con muchos servicios | Paginar en mensajes adicionales o agrupar por categoría con dropdown |
| Cliente envía folio mal escrito | Regex permisiva + sugerir formato si no matchea |
| Intake interrumpido a mitad (cliente escribe algo random) | En cada step, si input no es válido para el step → re-mostrar la pregunta. Comando "menu" cancela flow |
| Foto > 16MB (límite WhatsApp) | Catch error de descarga, decir "no pude bajar la foto, sigamos sin ella" |
| Conflicto de `ticket_prefix` entre clientes | Validar unicidad en C-03, fallback a primeras 3 letras de company_name si null |
| Cliente nuevo no tiene servicios cargados aún | B-06 muestra mensaje de fallback, no rompe |

---

## 9. Out of scope (Fases siguientes)

### Fase 2 (1-2 semanas)
- Outbound notifications cuando operador cambia status (templates de WhatsApp aprobados)
- Aprobación de cotización via Reply Buttons (cliente recibe cotización + 2 botones)
- Configuración del intake form per-cliente desde panel
- Subida de múltiples fotos en un ticket

### Fase 3 (después)
- Pickup / delivery flow (modalidad sucursal vs domicilio)
- Recordatorio de retiro si pasa N días desde "listo"
- Pagos integrados
- Encuestas de satisfacción post-entrega
- Reportes / analytics de tickets por status, tiempo promedio, etc.
