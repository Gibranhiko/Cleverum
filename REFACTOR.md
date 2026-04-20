# Cleverum — Refactor Master Plan

## Contexto

Cleverum es una plataforma multi-tenant de chatbots de WhatsApp. El objetivo de este refactor es:

1. Reemplazar WhatsApp no oficial (Baileys) con WhatsApp Cloud API (Meta oficial)
2. Eliminar auth/DB/storage propios → migrar a Supabase
3. Eliminar Docker y toda infraestructura auto-gestionada
4. Reemplazar Next.js con Vite + React SPA
5. Mejorar el admin panel con visibilidad y control real de los bots
6. Integrar RAG (Retrieval-Augmented Generation) con Supabase pgvector

**Stack actual:**
- Frontend: Next.js 15, React, TailwindCSS, GSAP, Three.js
- Backend chatbot: BuilderBot + Baileys (WhatsApp no oficial), OpenAI, Google Calendar
- Backend web: Next.js API routes, Mongoose, MongoDB
- Real-time: Socket.io (websocket-server separado)
- Storage: Digital Ocean Spaces (AWS SDK v2)
- Auth: JWT propio (jose + bcrypt)
- Infra: Docker Compose (4 servicios)

**Stack objetivo:**
- Frontend: Vite + React, TailwindCSS, Supabase client SDK
- Backend: Express webhook handler (WhatsApp Cloud API), OpenAI, Google Calendar
- DB + Auth + Storage + Realtime + Vectores: Supabase
- Infra: Cloudflare Pages (frontend) + Railway (backend) — cero Docker

**Modelo de operación:**
Este es un **panel interno de operador**, no un SaaS self-serve. El operador (tú) es el único administrador: configuras los bots de cada cliente, manejas las credenciales de Meta, y coordinas el onboarding. Los clientes no tienen acceso al panel — tú gestionas todo por ellos.

---

## Principios arquitectónicos del chatbot

### Enfoque híbrido: AI donde agrega valor, UI nativa donde es crítico

WhatsApp Cloud API ofrece componentes de UI nativos (List Messages, Reply Buttons) que son instantáneos, deterministas y no alucinan. La IA se usa solo donde la interacción natural agrega valor real.

```
Usuario escribe
      ↓
[AI] Clasificar intent (rápido, barato)
      ↓
┌─────────────────────────────────────────────────────┐
│ Menus, precios, confirmaciones  → List/Buttons      │ ← Instantáneo, sin alucinaciones
│ Preguntas abiertas sobre empresa → AI + RAG         │ ← Contexto real del cliente
│ Entender fechas en lenguaje libre → AI extractor    │ ← AI solo para parsear
│ Confirmar disponibilidad → Google Calendar + botones│ ← Determinista
│ Calificar leads → AI conversacional + RAG           │ ← AI con contexto de servicios
└─────────────────────────────────────────────────────┘
```

**IA sí:** Clasificación de intents, respuestas a preguntas abiertas (con RAG), extracción de datos de lenguaje natural (fechas, nombres), conversación de calificación de leads.

**IA no:** Precios (siempre de DB), disponibilidad de calendario (siempre de Google Calendar), menús de productos (List Messages), confirmaciones de pedido (botones).

### RAG: contexto real, no alucinaciones

Cada cliente sube sus documentos (FAQs, descripción de servicios, políticas, precios de paquetes). Esos documentos se indexan como embeddings en Supabase pgvector. Antes de cada llamada a OpenAI, se recuperan los chunks más relevantes y se inyectan en el prompt. Así el bot responde con información real del cliente, no inventada.

**RAG se usa en:** Bot Informativo (preguntas sobre empresa), Bot Leads (preguntas sobre servicios y precios de paquetes).
**RAG no se usa en:** Bot Catálogo (precios vienen de DB, no de documentos).

---

## Los tres tipos de bot

### Bot 1 — Informativo + Citas
**Casos de uso:** Clínicas, salones, consultores, despachos, coaches.
**Flujo:**
- Usuario pregunta sobre la empresa → AI + RAG responde con info real del cliente
- Usuario quiere agendar → AI extrae fecha en lenguaje natural → botones para confirmar horario disponible (Google Calendar) → crea evento
- Comandos de control: `botoff`, `boton`, `status`

**AI usa:** Clasificador de intent, respuestas a preguntas (RAG), extractor de fecha/nombre/servicio.
**UI nativa usa:** Botones de confirmación de horario, botones Sí/No.

### Bot 2 — Catálogo + Pedidos
**Casos de uso:** Restaurantes, tiendas locales, pastelerías, fondas.
**Flujo:**
- Usuario llega → List Message con categorías de productos
- Elige categoría → List Message con productos de esa categoría
- Elige producto → muestra detalle + precio (de DB) + botones de opciones
- Confirma pedido → botones: A domicilio / Para recoger
- Si a domicilio → pide dirección (texto libre) → AI extrae dirección
- Confirma → crea orden en Supabase → notificación real-time al admin

**AI usa:** Solo clasificador de intent inicial, extracción de dirección.
**UI nativa usa:** Todo el flujo de selección (List Messages + botones). Precios siempre de DB.

### Bot 3 — Ventas / Calificación de Leads
**Casos de uso:** Agencias, inmobiliarias, constructoras, empresas B2B, servicios a medida.
**Flujo:**
- Usuario expresa interés → AI inicia conversación de calificación
- AI hace preguntas clave (presupuesto, necesidad, timeline, empresa) — conversación natural
- Si usuario pregunta por precios/servicios → RAG recupera info de paquetes/casos de uso
- Al completar calificación → AI extrae ficha de lead (nombre, empresa, necesidad, presupuesto)
- Crea lead en Supabase → notificación al admin con resumen
- Bot responde con siguiente paso (llamada, propuesta, demo)

**AI usa:** Todo el flujo conversacional, RAG para responder preguntas de servicios/precios, extracción de datos del lead.
**UI nativa usa:** Botones de opciones de presupuesto (rangos), confirmación de datos.

---

## Estructura de fases

```
FASE 1 — Supabase Foundation         ~2-3 semanas
FASE 2 — Frontend: Next.js → Vite    ~2-3 semanas
FASE 3 — WhatsApp Cloud API          ~3-4 semanas
FASE 4 — RAG Integration             ~2 semanas
FASE 5 — Admin Panel v2              ~2-3 semanas
FASE 6 — Cleanup & Deploy            ~1 semana
```

---

## FASE 1 — Supabase Foundation

> Objetivo: Reemplazar MongoDB, auth propio, DO Spaces y Socket.io con Supabase.
> No hay migración de datos — arrancamos limpio.

---

### [F1-01] Setup del proyecto Supabase

**Descripción:** Crear y configurar el proyecto base en Supabase.

**Tareas:**
- [ ] Crear proyecto en supabase.com (región US East o la más cercana)
- [ ] Guardar: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- [ ] Habilitar extensión `pgvector` (Database → Extensions) — requerido para RAG en Fase 4
- [ ] Instalar Supabase CLI: `npm install -g supabase`
- [ ] Inicializar proyecto local: `supabase init` en raíz del repo
- [ ] Configurar `supabase/config.toml` con project reference
- [ ] Crear estructura de carpetas: `supabase/migrations/`

**Resultado esperado:** Proyecto Supabase funcional con pgvector habilitado y CLI configurado.

**Dependencias:** Ninguna.

---

### [F1-02] Schema de base de datos

**Descripción:** Crear todas las tablas necesarias para la aplicación y el RAG en una sola migration limpia.

**Tareas:**
- [ ] Crear `supabase/migrations/001_initial_schema.sql`:

```sql
-- ─── CLIENTES ────────────────────────────────────────────────
create table clients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  company_name text not null,
  company_type text,
  company_address text,
  company_email text,
  admin_name text,
  whatsapp_phone text,
  is_active boolean default true,
  bot_type text check (bot_type in ('informativo', 'catalogo', 'leads')) not null,
  use_ai boolean default true,
  facebook_link text,
  instagram_link text,
  image_url text,
  google_calendar_key_url text,
  google_calendar_id text,
  wa_phone_number_id text,
  wa_access_token text,
  bot_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ─── PRODUCTOS ───────────────────────────────────────────────
create table products (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references clients(id) on delete cascade,
  category text,
  name text not null,
  description text,
  type text,
  options jsonb default '[]',
  includes text,
  image_url text,
  created_at timestamptz default now()
);

-- ─── PEDIDOS ─────────────────────────────────────────────────
create table orders (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references clients(id) on delete cascade,
  customer_name text,
  customer_phone text,
  items jsonb default '[]',
  description text,
  date timestamptz default now(),
  planned_date timestamptz,
  delivery_type text,
  total numeric,
  status boolean default false,
  address text,
  location text,
  payment_method text,
  client_payment numeric,
  created_at timestamptz default now()
);

-- ─── LEADS (Bot 3) ───────────────────────────────────────────
create table leads (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references clients(id) on delete cascade,
  customer_name text,
  customer_phone text,
  company text,
  need text,
  budget_range text,
  timeline text,
  status text default 'new' check (status in ('new', 'contacted', 'qualified', 'lost', 'won')),
  notes text,
  raw_conversation jsonb default '[]',
  created_at timestamptz default now()
);

-- ─── REMINDERS ───────────────────────────────────────────────
create table reminders (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references clients(id) on delete cascade,
  message text not null,
  phone_numbers text[] default '{}',
  frequency text check (frequency in ('daily', 'weekly', 'monthly')),
  hour int check (hour between 8 and 21),
  minute int check (minute in (0, 30)),
  active boolean default true,
  last_sent timestamptz,
  created_at timestamptz default now()
);

-- ─── SESIONES DE CONVERSACIÓN ────────────────────────────────
-- Reemplaza el MemoryDB de BuilderBot
create table conversation_sessions (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references clients(id) on delete cascade,
  phone_number text not null,
  current_flow text,
  flow_step text,
  state jsonb default '{}',
  history jsonb default '[]',        -- últimos N mensajes para contexto AI
  bot_disabled_for_user boolean default false,
  human_takeover boolean default false,
  assigned_agent_id uuid references auth.users(id),
  last_message_at timestamptz default now(),
  created_at timestamptz default now(),
  unique(client_id, phone_number)
);

-- ─── RAG: DOCUMENTOS ─────────────────────────────────────────
create table documents (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references clients(id) on delete cascade,
  title text not null,
  content text not null,
  metadata jsonb default '{}',
  created_at timestamptz default now()
);

-- ─── RAG: CHUNKS CON EMBEDDINGS ──────────────────────────────
create table document_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid references documents(id) on delete cascade,
  client_id uuid references clients(id) on delete cascade,
  content text not null,
  embedding vector(1536),   -- OpenAI text-embedding-3-small
  created_at timestamptz default now()
);

-- ─── RAG: FUNCIÓN DE BÚSQUEDA SEMÁNTICA ──────────────────────
create function match_chunks(
  query_embedding vector(1536),
  client_id_filter uuid,
  match_threshold float default 0.75,
  match_count int default 4
)
returns table (id uuid, content text, similarity float)
language sql stable as $$
  select id, content, 1 - (embedding <=> query_embedding) as similarity
  from document_chunks
  where client_id = client_id_filter
    and 1 - (embedding <=> query_embedding) > match_threshold
  order by similarity desc
  limit match_count;
$$;
```

- [ ] Crear índices:
```sql
create index on products(client_id);
create index on orders(client_id);
create index on orders(created_at desc);
create index on leads(client_id);
create index on leads(status);
create index on conversation_sessions(client_id, phone_number);
create index on document_chunks using hnsw (embedding vector_cosine_ops);
```

- [ ] Crear RLS policies:
```sql
alter table clients enable row level security;
alter table products enable row level security;
alter table orders enable row level security;
alter table leads enable row level security;
alter table reminders enable row level security;
alter table documents enable row level security;
alter table document_chunks enable row level security;

-- Dueño ve solo sus datos
create policy "owner_access" on clients using (user_id = auth.uid());
create policy "owner_access" on products using (
  client_id in (select id from clients where user_id = auth.uid()));
create policy "owner_access" on orders using (
  client_id in (select id from clients where user_id = auth.uid()));
create policy "owner_access" on leads using (
  client_id in (select id from clients where user_id = auth.uid()));
create policy "owner_access" on reminders using (
  client_id in (select id from clients where user_id = auth.uid()));
create policy "owner_access" on documents using (
  client_id in (select id from clients where user_id = auth.uid()));
-- document_chunks: solo service role (el chatbot usa service key, bypasa RLS)
```

- [ ] Aplicar: `supabase db push`

**Resultado esperado:** Schema completo incluyendo tablas de RAG y leads, con RLS y índice vectorial.

**Dependencias:** F1-01

---

### [F1-03] Migración de Auth (JWT propio → Supabase Auth)

**Descripción:** Eliminar el sistema de auth custom y reemplazarlo con Supabase Auth.

**Archivos a eliminar:**
- `web/app/api/auth/login/route.ts`
- `web/app/api/auth/logout/route.ts`
- `web/app/api/auth/register/route.ts`
- `web/app/api/auth/validate-token/route.ts`
- `web/app/api/auth/models/User.ts`
- `web/middleware.ts`

**Dependencias npm a eliminar:** `jose`, `bcrypt`

**Tareas:**
- [ ] Habilitar Email/Password auth en Supabase Dashboard (Authentication → Providers)
- [ ] Deshabilitar registros públicos (Authentication → Settings → "Disable signups" = ON)
- [ ] Crear tu usuario administrador directamente en Supabase Dashboard — no hay registro público
- [ ] Instalar `@supabase/supabase-js` en web workspace
- [ ] Crear `web/lib/supabase.ts` con cliente configurado
- [ ] Actualizar `AppContext.tsx` para usar `supabase.auth.signInWithPassword()`
- [ ] Eliminar los 5 archivos de auth listados arriba
- [ ] Eliminar `jose` y `bcrypt` de `web/package.json`

**Resultado esperado:** Login/logout funcionando via Supabase Auth. Solo el operador puede acceder — sin registro público.

**Dependencias:** F1-01

---

### [F1-04] Migración de Storage (DO Spaces → Supabase Storage)

**Descripción:** Reemplazar AWS SDK + DO Spaces con Supabase Storage.

**Archivos a eliminar/reemplazar:**
- `web/app/api/upload/utils.ts`
- `web/app/api/upload/route.ts`
- `web/app/api/upload/[id]/route.ts`

**Dependencias npm a eliminar:** `aws-sdk`

**Tareas:**
- [ ] Crear buckets en Supabase Storage:
  - `logos` — público (logos de clientes)
  - `products` — público (imágenes de productos)
  - `calendar-keys` — privado (JSON keys Google Calendar)
  - `documents` — privado (documentos para RAG)
- [ ] Configurar políticas: `logos` y `products` lectura pública, `calendar-keys` y `documents` solo service role
- [ ] Reescribir `upload/route.ts` usando Supabase Storage SDK:
  ```ts
  const { data } = await supabase.storage
    .from('logos')
    .upload(`client-${clientId}.png`, file, { upsert: true });
  ```
- [ ] Actualizar `web/app/hooks/useFileUpload.ts`
- [ ] Actualizar `web/app/components/image-upload.tsx`
- [ ] Actualizar `chatbot/services/googleCalendar.service.ts` para leer keys de Supabase Storage
- [ ] Eliminar `aws-sdk` de `web/package.json`
- [ ] Eliminar variables `DO_*` de entorno

**Resultado esperado:** Todos los uploads funcionando via Supabase Storage. AWS SDK eliminado.

**Dependencias:** F1-01, F1-03

---

### [F1-05] Migración de API routes CRUD (Mongoose → Supabase)

**Descripción:** Reemplazar todas las API routes que usan Mongoose con Supabase client.

**Archivos a reemplazar:**
- `web/app/api/clients/route.ts` + `[id]/route.ts`
- `web/app/api/products/route.ts` + `[id]/route.ts`
- `web/app/api/orders/route.ts` + `[id]/route.ts`
- `web/app/api/reminders/route.ts` + `[id]/route.ts` + `import/route.ts`
- `web/app/api/utils/mongoose.ts`

**Dependencias npm a eliminar:** `mongoose`

**Tareas:**
- [ ] Reescribir `clients` routes con Supabase (incluir campo `bot_type` en create/update)
- [ ] Reescribir `products` routes
- [ ] Reescribir `orders` routes (Supabase Realtime dispara automáticamente al insertar)
- [ ] Reescribir `reminders` routes
- [ ] Agregar CRUD para `leads`:
  - `GET /api/leads?clientId=X`
  - `PUT /api/leads/[id]` (actualizar status, notas)
- [ ] Eliminar `mongoose` de todos los workspaces
- [ ] Eliminar `web/app/api/utils/mongoose.ts`
- [ ] Eliminar todos los modelos Mongoose

**Resultado esperado:** CRUD completo funcionando contra Supabase PostgreSQL.

**Dependencias:** F1-02, F1-03

---

### [F1-06] Migración de WebSocket → Supabase Realtime

**Descripción:** Eliminar el workspace `websocket-server` y reemplazar con Supabase Realtime.

**Archivos a eliminar:**
- Todo el workspace `websocket-server/`
- `chatbot/utils/socket-connect.ts`

**Tareas:**
- [ ] Habilitar Realtime en Supabase para tablas: `orders`, `leads`, `conversation_sessions`
- [ ] El POST de órdenes ya no emite socket event — Supabase Realtime lo hace al insertar
- [ ] Actualizar `web/app/context/AppContext.tsx`:
  ```ts
  // Reemplazar socket.io con:
  const channel = supabase
    .channel('orders')
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'orders',
      filter: `client_id=eq.${selectedClientId}`
    }, (payload) => {
      setNotifications(prev => [payload.new, ...prev]);
    })
    .subscribe();
  ```
- [ ] Suscripción adicional a `leads` para notificaciones de nuevos leads (Bot 3)
- [ ] Eliminar `socket.io-client` de `web/package.json` y `chatbot/package.json`
- [ ] Eliminar workspace `websocket-server` del repositorio
- [ ] Remover `websocket-server` de root `package.json` workspaces
- [ ] Eliminar servicio `websocket` de `docker-compose.yml`

**Resultado esperado:** Notificaciones real-time via Supabase. Workspace websocket-server eliminado.

**Dependencias:** F1-05

---

## FASE 2 — Frontend: Next.js → Vite + React

> Objetivo: Reemplazar Next.js con SPA estática conectada directamente a Supabase.

---

### [F2-01] Setup del proyecto Vite + React

**Descripción:** Crear el nuevo workspace frontend.

**Tareas:**
- [ ] Crear workspace `frontend/`:
  ```bash
  npm create vite@latest frontend -- --template react-ts
  ```
- [ ] Instalar dependencias:
  ```bash
  npm install @supabase/supabase-js react-router-dom
  npm install gsap three @types/three lucide-react react-hook-form
  npm install -D tailwindcss postcss autoprefixer
  ```
- [ ] Configurar TailwindCSS
- [ ] Crear `frontend/src/lib/supabase.ts`
- [ ] Agregar `frontend` a workspaces en root `package.json`
- [ ] Variables de entorno: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`

**Resultado esperado:** App Vite corriendo con Supabase conectado.

**Dependencias:** F1-01, F1-03

---

### [F2-02] Auth guard y routing

**Descripción:** Protección de rutas con Supabase Auth en React Router.

**Tareas:**
- [ ] Crear `frontend/src/components/AuthGuard.tsx`
- [ ] Crear `frontend/src/pages/Login.tsx` (migrar de `web/app/login/page.tsx`)
- [ ] Configurar rutas en `App.tsx`:
  ```
  /login → Login (única ruta pública)
  /clientes → Clientes
  /pedidos → Pedidos
  /productos → Productos
  /leads → Leads (Bot 3)
  /chatbot → Configuración de bots
  /conversaciones → Historial de conversaciones
  /reminders → Reminders
  /documentos → Base de conocimiento RAG
  ```
  > Sin landing page pública ni ruta de registro — es un panel interno.
- [ ] `AppContext.tsx` con Supabase Auth + Realtime (migrado de Next.js)
- [ ] Auto-refresh de sesión con `supabase.auth.onAuthStateChange()`

**Resultado esperado:** Routing con auth guard funcionando.

**Dependencias:** F2-01, F1-03

---

### [F2-03] Migración de componentes UI

**Descripción:** Portar todos los componentes de `web/app/components/` a Vite.

**Archivos a migrar:**
- `navbar.tsx`, `notification-bell.tsx`, `client-form-modal.tsx`
- `data-table.tsx`, `drop-down.tsx`, `image-upload.tsx`
- `inline-loader.tsx`, `modal.tsx`, `module.tsx`, `toast.tsx`
- `add-products-form.tsx`, `public-navbar.tsx`

**Tareas:**
- [ ] Copiar y adaptar componentes a `frontend/src/components/`
- [ ] Reemplazar imports de Next.js: `next/image` → `<img>`, `next/link` → React Router `<Link>`, `useRouter()` → `useNavigate()`
- [ ] Adaptar `image-upload.tsx` para Supabase Storage
- [ ] Adaptar `notification-bell.tsx` para Supabase Realtime (órdenes + leads)
- [ ] Adaptar `client-form-modal.tsx` para incluir campo `bot_type` (selector de tipo de bot)

**Resultado esperado:** Todos los componentes funcionando en Vite.

**Dependencias:** F2-01, F2-02

---

### [F2-04] Migración de páginas del admin panel

**Descripción:** Portar las páginas principales con llamadas directas a Supabase.

**Tareas:**
- [ ] `Clientes.tsx` — reemplazar `fetch('/api/clients')` con `supabase.from('clients').select()`, agregar selector de `bot_type`
- [ ] `Pedidos.tsx` — Supabase query + Realtime subscription para nuevos pedidos
- [ ] `Productos.tsx` — Supabase query + Supabase Storage para imágenes
- [ ] `Leads.tsx` — nueva página para Bot 3: lista de leads con status, notas, filtros por status
- [ ] `Chatbot.tsx` — adaptada para nueva API del chatbot (Fase 3)
- [ ] `Reminders.tsx` — Supabase query, CSV import igual
- [ ] Migrar utils: `web/app/utils/constants.ts`, `format-data.ts`, `form.ts`

**Resultado esperado:** Admin panel completo funcionando en Vite.

**Dependencias:** F2-03, F1-05, F1-06

---

### [F2-05] ~~Migración de landing page~~ — DESCARTADO

La landing page (`web/app/page.tsx`, `hero3D.tsx`, GSAP, Three.js) no se migra. El frontend es un panel interno — no tiene página pública. Si en el futuro se necesita un sitio de marketing, se hace como proyecto separado.

**Archivos a eliminar sin migrar:**
- `web/app/page.tsx`
- `web/app/components/hero3D.tsx`
- `web/app/components/public-navbar.tsx`
- `web/app/registro/page.tsx`

---

### [F2-06] Eliminar workspace Next.js

**Descripción:** Eliminar todo el workspace `web/` una vez Vite está validado en producción.

**Tareas:**
- [ ] Validar que todas las funcionalidades están en `frontend/`
- [ ] Eliminar workspace `web/` del repositorio
- [ ] Remover `web` de workspaces en root `package.json`
- [ ] Eliminar servicio `web` de `docker-compose.yml`

**Resultado esperado:** Workspace Next.js eliminado del repo.

**Dependencias:** F2-01 al F2-05 completos y validados.

---

## FASE 3 — WhatsApp Cloud API

> Objetivo: Reemplazar Baileys/BuilderBot con WhatsApp Cloud API de Meta.
> Se implementan los 3 tipos de bot con el enfoque híbrido (AI + UI nativa de WhatsApp).

---

### [F3-01] Setup de Meta Business y WhatsApp Cloud API

**Descripción:** Configuración externa en Meta antes de escribir código.

**Modelo de operación con Meta:**
Una sola Meta Business App bajo tu cuenta. Cada cliente tiene su propio WABA (WhatsApp Business Account) y número registrado, pero tú los administras todos. El webhook es uno solo — enruta mensajes por `phone_number_id` al bot correcto.

**Tareas (en Meta Business Manager — tú lo haces, no el cliente):**
- [ ] Crear/verificar tu Meta Business Account en business.facebook.com
- [ ] Crear una app en developers.facebook.com → tipo "Business"
- [ ] Agregar producto "WhatsApp" a la app
- [ ] Registrar número de prueba para desarrollo (Meta provee uno gratis)
- [ ] Obtener y guardar credenciales globales de la app:
  - `WHATSAPP_WEBHOOK_SECRET` (para verificar webhooks)
  - App ID + App Secret
- [ ] Para cada nuevo cliente, el proceso que TÚ haces:
  1. El cliente consigue un número de teléfono dedicado (línea nueva)
  2. Tú creas un WABA para ese cliente bajo tu Business Account
  3. Registras el número en ese WABA
  4. Obtienes el `WHATSAPP_PHONE_NUMBER_ID` y el token de acceso
  5. Los ingresas manualmente en el admin panel del cliente
- [ ] No hay embedded signup ni OAuth — todo manual por el operador

**Resultado esperado:** App Meta configurada, número de prueba activo, proceso de onboarding documentado para replicar por cada cliente.

**Dependencias:** Ninguna (proceso externo).

---

### [F3-02] Nuevo backend: webhook handler base

**Descripción:** Reescribir el workspace `chatbot/` como webhook handler Express. Reemplaza toda la arquitectura BuilderBot.

**Archivos a crear:**
- `chatbot/src/index.ts` — servidor Express
- `chatbot/src/webhook/handler.ts` — router de mensajes entrantes
- `chatbot/src/webhook/verify.ts` — verificación de webhook Meta
- `chatbot/src/lib/whatsapp.ts` — cliente HTTP para WhatsApp Cloud API
- `chatbot/src/lib/supabase.ts` — cliente Supabase (service role)

**Tareas:**
- [ ] Instalar: `express`, `dotenv`, `@supabase/supabase-js`, `openai`, `axios`
- [ ] Eliminar: `@builderbot/bot`, `@builderbot/provider-baileys`
- [ ] Crear servidor Express:
  ```ts
  // GET /webhook — verificación Meta
  app.get('/webhook', verifyWebhook);
  // POST /webhook — mensajes entrantes
  app.post('/webhook', webhookHandler);
  // GET /health — health check para Railway
  app.get('/health', (_, res) => res.json({ status: 'ok' }));
  ```
- [ ] Crear `lib/whatsapp.ts` con:
  ```ts
  // Mensaje de texto simple
  sendText(phoneNumberId, to, text)
  // List Message (menú scrollable, hasta 10 items)
  sendList(phoneNumberId, to, header, body, buttonText, sections)
  // Reply Buttons (hasta 3 botones)
  sendButtons(phoneNumberId, to, body, buttons)
  // Imagen con caption
  sendImage(phoneNumberId, to, imageUrl, caption)
  ```
- [ ] Configurar webhook URL en Meta apuntando a Railway

**Resultado esperado:** Backend recibe y responde mensajes de WhatsApp via API oficial.

**Dependencias:** F3-01, F1-02

---

### [F3-03] Sistema de estado de conversación en DB

**Descripción:** Reemplazar `MemoryDB` de BuilderBot con persistencia en `conversation_sessions`.

**Tareas:**
- [ ] Crear `chatbot/src/lib/sessionManager.ts`:
  ```ts
  getSession(clientId, phoneNumber): Promise<Session>
  updateSession(sessionId, updates): Promise<void>
  appendToHistory(sessionId, role, content): Promise<void>
  resetFlow(sessionId): Promise<void>
  ```
- [ ] Cache en memoria con TTL 5 min para reducir queries (igual que el state de BuilderBot)
- [ ] Definir tipo `Session` mapeado a `conversation_sessions`
- [ ] `botDisabled` global → columna `clients.bot_active`
- [ ] `adminDisabledUsers` → columna `conversation_sessions.bot_disabled_for_user`
- [ ] `history` en sesión: mantener últimos 10 mensajes para contexto AI (ventana deslizante)

**Resultado esperado:** Estado persistente de conversación que sobrevive reinicios.

**Dependencias:** F3-02, F1-02

---

### [F3-04] Router de mensajes y comandos de control

**Descripción:** Reemplazar `welcome.flow.ts` con router central de mensajes.

**Lógica de `welcome.flow.ts` a replicar:** detectar comandos, verificar estado del bot, cachear client config, rutear a flujo correcto según `bot_type` y `use_ai`.

**Tareas:**
- [ ] Crear `chatbot/src/webhook/handler.ts`:
  ```ts
  const COMMANDS = new Set(['botoff', 'status', 'boton']);

  async function handleMessage(message, phoneNumberId) {
    const session = await getSession(clientId, message.from);
    const client = await getCachedClient(clientId);

    // Comandos de control (igual que toggle.flow.ts)
    if (COMMANDS.has(text)) return handleToggleCommand(...);

    // Bot deshabilitado
    if (!client.bot_active || session.botDisabledForUser) return;

    // Human takeover activo
    if (session.humanTakeover) return; // agente humano está respondiendo

    // Rutear según tipo de bot
    switch(client.bot_type) {
      case 'informativo': return handleInfoBot(message, client, session);
      case 'catalogo':    return handleCatalogBot(message, client, session);
      case 'leads':       return handleLeadsBot(message, client, session);
    }
  }
  ```
- [ ] `handleToggleCommand()` — reemplaza `toggle.flow.ts`
- [ ] `getCachedClient()` — cache en memoria 5 min, reemplaza `fetchClient()` con cache de state

**Resultado esperado:** Router central funcionando, equivalente a `welcome.flow.ts`.

**Dependencias:** F3-02, F3-03

---

### [F3-05] Bot 1 — Informativo + Citas

**Descripción:** Implementar el bot informativo con respuestas AI + RAG y agendado de citas.

**Flujos actuales a migrar:** `ai.flow.ts`, `ia/talker.flow.ts`, `ia/appointment.flow.ts`, `services/googleCalendar.service.ts`

**Tareas:**
- [ ] Crear `chatbot/src/flows/infoBot.ts`:
  ```ts
  async function handleInfoBot(message, client, session) {
    // 1. Clasificar intent
    const { intent } = await ai.determineIntent(session.history);

    switch(intent) {
      case 'agendar_cita':       return startAppointmentFlow(message, client, session);
      case 'consultar_empresa':  return answerWithRAG(message, client, session);
      case 'hablar':             return talkWithAI(message, client, session);
    }
  }
  ```
- [ ] `answerWithRAG()` — recupera chunks relevantes de Supabase + responde con OpenAI (ver Fase 4 para el pipeline completo de RAG, esta función se conecta al servicio RAG)
- [ ] `talkWithAI()` — conversación general con historial de sesión como contexto
- [ ] `startAppointmentFlow()` — state machine:
  - Step 1: AI extrae nombre, servicio, fecha preferida del mensaje (`determineAppointmentFn`)
  - Step 2: Consulta Google Calendar (`checkAvailability`)
  - Step 3: `sendButtons()` con horarios disponibles
  - Step 4: Confirma → `createEvent()` en Google Calendar → confirmación de texto
- [ ] Migrar `chatbot/services/googleCalendar.service.ts` → `chatbot/src/services/googleCalendar.ts` (actualizar descarga de key a Supabase Storage)
- [ ] Actualizar `AIClass` en `chatbot/src/services/ai.ts` para usar `tools` API en lugar de `functions` (deprecado en OpenAI):
  ```ts
  // Antes (deprecated)
  functions: [...], function_call: { name: 'fn' }
  // Después
  tools: [{ type: 'function', function: {...} }],
  tool_choice: { type: 'function', function: { name: 'fn' } }
  ```
- [ ] Copiar prompts a `chatbot/src/prompts/` (se reusan)

**Resultado esperado:** Bot informativo con citas funcionando end-to-end.

**Dependencias:** F3-03, F3-04

---

### [F3-06] Bot 2 — Catálogo + Pedidos

**Descripción:** Implementar el bot de catálogo usando List Messages y botones nativos de WhatsApp. Sin AI en el flujo principal.

**Flujos actuales a migrar:** `fixed/fixed.flow.ts`, `selection.flow.ts`, `confirmation.flow.ts`, `confirm.flow.ts`, `seller.flow.ts`

**Tareas:**
- [ ] Crear `chatbot/src/flows/catalogBot.ts` como state machine:
  ```
  idle → category_menu → product_list → product_detail → delivery_type → address? → confirmed
  ```
- [ ] `category_menu`: `sendList()` con categorías de productos (de DB, agrupadas)
- [ ] `product_list`: `sendList()` con productos de la categoría seleccionada (nombre + precio)
- [ ] `product_detail`: `sendButtons()` — Agregar al carrito / Ver otro / Finalizar
- [ ] `delivery_type`: `sendButtons()` — A domicilio / Para recoger
- [ ] Si domicilio: texto libre → AI extrae dirección (único uso de AI en este bot)
- [ ] `confirmed`: crea orden en Supabase → mensaje de confirmación con resumen
- [ ] Carrito (items seleccionados) guardado en `session.state` (JSON en DB)
- [ ] Migrar lógica de `chatbot/utils/order.ts` → adaptada a Supabase insert

**Resultado esperado:** Flujo de catálogo completo con UI nativa de WhatsApp, sin alucinaciones en precios.

**Dependencias:** F3-03, F3-04

---

### [F3-07] Bot 3 — Ventas / Calificación de Leads

**Descripción:** Implementar el bot de ventas que califica leads mediante conversación AI.

**Flujo actual más cercano:** `ia/project.flow.ts`, `determineOrderFn()`

**Tareas:**
- [ ] Crear `chatbot/src/flows/leadsBot.ts`:
  ```ts
  async function handleLeadsBot(message, client, session) {
    // Si es primer mensaje, iniciar calificación
    if (session.flowStep === 'idle') return startQualification(message, client, session);

    // Si estamos en conversación de calificación
    if (session.currentFlow === 'qualifying') return continueQualification(message, client, session);

    // Si ya tenemos suficiente info, extraer y crear lead
    if (readyToCapture(session)) return captureLead(message, client, session);
  }
  ```
- [ ] `startQualification()` — saludo + primera pregunta, AI con RAG para describir servicios
- [ ] `continueQualification()` — AI conversacional, historial completo como contexto, RAG cuando pregunta por servicios/precios
- [ ] `readyToCapture()` — detecta cuando AI tiene: nombre, teléfono, necesidad, presupuesto
- [ ] `captureLead()` — `determineOrderFn()` adaptado para extraer ficha de lead (nombre, empresa, necesidad, presupuesto, timeline) → insert en tabla `leads` → notificación Realtime al admin
- [ ] Botones para rangos de presupuesto (ej: "Menos de $10k / $10k-$50k / Más de $50k")
- [ ] Mensaje de cierre con siguiente paso (llamada, propuesta, demo)
- [ ] Crear prompts específicos para calificación de leads en `chatbot/src/prompts/`

**Resultado esperado:** Bot que califica leads conversacionalmente y crea fichas en Supabase.

**Dependencias:** F3-03, F3-04

---

### [F3-08] Servicio de reminders

**Descripción:** Migrar cron de reminders de BuilderBot a WhatsApp Cloud API.

**Archivo actual:** `chatbot/services/reminder.service.ts`

**Tareas:**
- [ ] Crear `chatbot/src/services/reminder.ts`
- [ ] Leer reminders activos desde Supabase con join a client credentials:
  ```ts
  const { data } = await supabase
    .from('reminders')
    .select('*, clients(wa_phone_number_id, wa_access_token)')
    .eq('active', true);
  ```
- [ ] Reemplazar envío via Baileys con `sendText()` de WhatsApp Cloud API
- [ ] Conservar lógica de frecuencias (daily/weekly/monthly) y timezone Mexico City
- [ ] Actualizar `last_sent` en Supabase tras envío exitoso
- [ ] Respetar `conversation_sessions.bot_disabled_for_user`

**Resultado esperado:** Reminders automáticos funcionando via API oficial.

**Dependencias:** F3-02, F1-02

---

### [F3-09] Bot management API simplificada

**Descripción:** Reemplazar la API de gestión de bots (puertos, procesos, QR) con una API simple de flags en DB.

**Archivos actuales a eliminar:** `chatbot/routes/botRoutes.ts`, `chatbot/services/botService.ts`, `chatbot/provider/index.ts`

**Tareas:**
- [ ] Crear `chatbot/src/routes/bots.ts`:
  ```ts
  PUT  /bots/:clientId/toggle      // activa/desactiva bot (bot_active en DB)
  GET  /bots/status                // estado de todos los bots desde DB
  POST /bots/:clientId/takeover    // activa human takeover para una sesión
  PUT  /bots/:clientId/credentials // actualiza wa_phone_number_id y wa_access_token (solo operador)
  ```
- [ ] `toggle`: actualiza `clients.bot_active` en Supabase
- [ ] `status`: lee `clients` + `conversation_sessions.last_message_at` agrupado
- [ ] `credentials`: endpoint protegido para que el operador ingrese las credenciales de Meta de cada cliente desde el admin panel — no hay flujo OAuth ni self-serve
- [ ] Eliminar toda lógica de: port management, process spawning, session files, QR codes
- [ ] Eliminar `chatbot/provider/index.ts` (BaileysProvider)

**Resultado esperado:** Gestión de bots via flags en DB, sin estado efímero.

**Dependencias:** F3-02, F1-02

---

### [F3-10] Eliminar BuilderBot y Baileys

**Descripción:** Limpieza final de dependencias y archivos de BuilderBot.

**Tareas:**
- [ ] Eliminar de `chatbot/package.json`: `@builderbot/bot`, `@builderbot/provider-baileys`, `eslint-plugin-builderbot`
- [ ] Eliminar directorio `chatbot/flows/` (todos los .flow.ts)
- [ ] Eliminar directorio `chatbot/layers/`
- [ ] Eliminar `chatbot/chatbotServer.ts`
- [ ] Eliminar `chatbot/utils/globalState.ts`, `socket-connect.ts`, `handleHistory.ts`
- [ ] Eliminar `chatbot/models/Reminder.ts`
- [ ] Verificar build limpio: `npm run build` en chatbot workspace

**Resultado esperado:** Chatbot workspace limpio, solo nueva arquitectura.

**Dependencias:** F3-05, F3-06, F3-07, F3-08, F3-09

---

## FASE 4 — RAG Integration

> Objetivo: Conectar un pipeline de RAG a los bots que lo necesitan (Bot 1 y Bot 3).
> La infraestructura (pgvector, tablas) ya está lista desde F1-02.

---

### [F4-01] Servicio de embeddings e ingesta

**Descripción:** Pipeline para procesar documentos del cliente y generar embeddings en Supabase pgvector.

**Tareas:**
- [ ] Crear `chatbot/src/services/rag.ts`:
  ```ts
  // Generar embedding de un texto
  async function embed(text: string): Promise<number[]> {
    const res = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: text
    });
    return res.data[0].embedding;
  }

  // Recuperar chunks relevantes para una query
  async function retrieve(query: string, clientId: string): Promise<string[]> {
    const embedding = await embed(query);
    const { data } = await supabase.rpc('match_chunks', {
      query_embedding: embedding,
      client_id_filter: clientId,
      match_threshold: 0.75,
      match_count: 4
    });
    return data.map(chunk => chunk.content);
  }

  // Indexar un documento (chunking + embeddings)
  async function indexDocument(documentId: string, content: string, clientId: string): Promise<void> {
    const chunks = splitIntoChunks(content, 400, 50); // 400 tokens, overlap 50
    for (const chunk of chunks) {
      const embedding = await embed(chunk);
      await supabase.from('document_chunks').insert({
        document_id: documentId,
        client_id: clientId,
        content: chunk,
        embedding
      });
    }
  }

  // Chunking simple por tokens aproximados
  function splitIntoChunks(text: string, size: number, overlap: number): string[]
  ```
- [ ] Crear endpoint en backend: `POST /documents/:clientId/index`
  - Recibe texto o extrae texto de PDF (usar `pdf-parse`)
  - Llama a `indexDocument()`
- [ ] Instalar dependencias: `pdf-parse`

**Resultado esperado:** Pipeline de ingesta y retrieval funcionando contra Supabase pgvector.

**Dependencias:** F1-02, F3-02

---

### [F4-02] Integración de RAG en Bot 1 (Informativo)

**Descripción:** Conectar el retrieval de RAG a las respuestas del bot informativo.

**Tareas:**
- [ ] Actualizar `answerWithRAG()` en `infoBot.ts`:
  ```ts
  async function answerWithRAG(message, client, session) {
    // 1. Recuperar chunks relevantes
    const chunks = await retrieve(message.text, client.id);

    // 2. Construir prompt con contexto
    const contextText = chunks.length > 0
      ? `Información relevante de la empresa:\n${chunks.join('\n\n')}`
      : 'No encontré información específica, responde con lo que sabes.';

    // 3. Llamar a OpenAI con contexto
    const response = await ai.createChat([
      { role: 'system', content: `${systemPrompt}\n\n${contextText}` },
      ...session.history,
      { role: 'user', content: message.text }
    ]);

    await sendText(client.waPhoneNumberId, message.from, response);
    await appendToHistory(session.id, 'user', message.text);
    await appendToHistory(session.id, 'assistant', response);
  }
  ```
- [ ] Si no hay documentos indexados para el cliente, el bot responde con info genérica (no rompe)
- [ ] Prompt de sistema configurable por cliente (de `bot_flows` table — ver F5-04)

**Resultado esperado:** Bot informativo responde con información real del cliente obtenida via RAG.

**Dependencias:** F4-01, F3-05

---

### [F4-03] Integración de RAG en Bot 3 (Leads)

**Descripción:** Conectar RAG al bot de ventas para que responda preguntas de servicios y precios con información real.

**Tareas:**
- [ ] Actualizar `continueQualification()` en `leadsBot.ts`:
  - Detectar si el mensaje es una pregunta sobre servicios/precios
  - Si sí → `retrieve()` + respuesta con contexto
  - Si no → continuar calificación conversacional sin RAG
- [ ] Tipos de documentos útiles para Bot 3: descripción de servicios, paquetes de precios, casos de éxito, proceso de trabajo
- [ ] La ficha de lead que se extrae al final incluye qué servicios preguntó el usuario (del historial) → más contexto para el equipo de ventas

**Resultado esperado:** Bot de leads responde preguntas de servicios/precios con información real y sin alucinaciones.

**Dependencias:** F4-01, F3-07

---

### [F4-04] UI de gestión de documentos en admin panel

**Descripción:** Interfaz para que cada cliente suba y gestione los documentos que el bot usa como contexto.

**Tareas:**
- [ ] Crear `frontend/src/pages/Documentos.tsx`
- [ ] Lista de documentos indexados por cliente (de tabla `documents`)
- [ ] Upload de documento: texto libre o PDF
  - Si PDF: enviar a backend → extraer texto → indexar
  - Si texto: directo al backend para indexar
- [ ] Indicador de estado: indexando / listo / error
- [ ] Botón de eliminar documento (elimina document + chunks en cascada)
- [ ] Botón de re-indexar (útil si se actualizó el documento)
- [ ] Preview del contenido del documento
- [ ] Solo disponible para clientes con Bot tipo `informativo` o `leads`
- [ ] Agregar ruta `/app/documentos` en React Router

**Resultado esperado:** Clientes pueden gestionar su base de conocimiento desde el admin panel.

**Dependencias:** F4-01, F2-04

---

## FASE 5 — Admin Panel v2

> Objetivo: Mejorar el panel de administración con visibilidad y control real sobre los bots.

---

### [F5-01] Dashboard de estado de bots

**Descripción:** Pantalla central con estado real de cada bot.

**Tareas:**
- [ ] Crear `frontend/src/pages/BotDashboard.tsx`
- [ ] Por cada cliente mostrar:
  - Tipo de bot (informativo / catálogo / leads)
  - Estado activo/inactivo (toggle — llama a `PUT /bots/:clientId/toggle`)
  - Número de WhatsApp asociado
  - Último mensaje recibido (`conversation_sessions.last_message_at`)
  - Conversaciones activas hoy
  - Órdenes generadas hoy (Bot 2) / Leads capturados hoy (Bot 3)
- [ ] Actualización en tiempo real via Supabase Realtime (suscripción a `clients`)
- [ ] Alerta visual si bot no ha recibido mensajes en +24h

**Resultado esperado:** Vista central del estado de todos los bots.

**Dependencias:** F3-09, F2-04

---

### [F5-02] Historial de conversaciones y takeover

**Descripción:** Ver historial de conversaciones en tiempo real y permitir que agentes humanos tomen el control.

**Tareas:**
- [ ] Crear `frontend/src/pages/Conversaciones.tsx`
- [ ] Listar conversaciones activas (de `conversation_sessions`, ordenadas por `last_message_at`)
- [ ] Al seleccionar conversación: mostrar historial de mensajes (de `session.history`)
- [ ] Realtime: nuevos mensajes aparecen al instante
- [ ] Mostrar: flujo actual, step actual, estado del carrito (Bot 2) o datos del lead (Bot 3)
- [ ] Botón "Tomar conversación" → `POST /bots/:clientId/takeover` → `human_takeover = true`
- [ ] Campo de texto para responder manualmente → `sendText()` via backend
- [ ] Botón "Devolver al bot" → `human_takeover = false`

**Resultado esperado:** Agentes pueden monitorear y tomar el control de conversaciones.

**Dependencias:** F3-09, F2-04

---

### [F5-03] Vista de Leads (Bot 3)

**Descripción:** CRM básico para gestionar los leads capturados por el Bot 3.

**Tareas:**
- [ ] Crear `frontend/src/pages/Leads.tsx` (ya agregado en ruta F2-02)
- [ ] Tabla de leads con columnas: nombre, empresa, necesidad, presupuesto, status, fecha
- [ ] Filtros por status: new / contacted / qualified / lost / won
- [ ] Al hacer click en un lead: ver conversación completa (`raw_conversation`)
- [ ] Editar status y agregar notas directamente en la tabla
- [ ] Notificación Realtime cuando llega nuevo lead
- [ ] Exportar leads a CSV

**Resultado esperado:** CRM básico funcional para leads del Bot 3.

**Dependencias:** F2-04, F1-06

---

### [F5-04] Configuración de flujos por cliente (Flow Config)

**Descripción:** Hacer configurable desde el admin panel los mensajes y comportamiento de cada bot, sin redeploy.

**Tareas:**
- [ ] Crear tabla en Supabase:
  ```sql
  create table bot_configs (
    id uuid primary key default gen_random_uuid(),
    client_id uuid references clients(id) on delete cascade unique,
    welcome_message text,
    system_prompt text,           -- prompt base del AI para este cliente
    intents_enabled text[] default '{}',  -- intents habilitados para bot informativo
    qualification_questions jsonb default '[]', -- preguntas para bot de leads
    closing_message text,
    created_at timestamptz default now(),
    updated_at timestamptz default now()
  );
  ```
- [ ] Migration: `supabase/migrations/004_bot_configs.sql`
- [ ] Actualizar webhook handler para leer config desde DB (con cache 5 min)
- [ ] Crear página `frontend/src/pages/ConfigBot.tsx`:
  - Editor de mensaje de bienvenida
  - Editor de system prompt (con preview)
  - Toggle de intents habilitados (Bot 1)
  - Editor de preguntas de calificación (Bot 3)
  - Mensaje de cierre

**Resultado esperado:** Configuración de bots editable desde UI sin tocar código.

**Dependencias:** F3-05, F3-06, F3-07

---

### [F5-05] Analytics básico

**Descripción:** Métricas de uso por bot/cliente.

**Tareas:**
- [ ] Crear vista SQL en Supabase:
  ```sql
  create view bot_analytics as
  select
    c.id as client_id,
    c.company_name,
    c.bot_type,
    count(distinct cs.phone_number) as unique_users,
    count(o.id) as total_orders,
    count(l.id) as total_leads,
    count(o.id) filter (
      where o.created_at > now() - interval '7 days'
    ) as orders_last_7_days,
    count(l.id) filter (
      where l.created_at > now() - interval '7 days'
    ) as leads_last_7_days
  from clients c
  left join conversation_sessions cs on cs.client_id = c.id
  left join orders o on o.client_id = c.id
  left join leads l on l.client_id = c.id
  group by c.id, c.company_name, c.bot_type;
  ```
- [ ] Crear migration: `supabase/migrations/005_analytics_view.sql`
- [ ] Componente `frontend/src/components/AnalyticsCard.tsx`
- [ ] Mostrar en BotDashboard: usuarios únicos, órdenes/leads última semana

**Resultado esperado:** Métricas básicas visibles en el panel.

**Dependencias:** F5-01

---

## FASE 6 — Cleanup & Deploy

> Objetivo: Eliminar toda la infraestructura Docker y desplegar en producción.

---

### [F6-01] Cleanup de Docker y consolidación de env vars

**Tareas:**
- [ ] Eliminar `docker-compose.yml`
- [ ] Eliminar `chatbot/Dockerfile`, `web/Dockerfile`, `websocket-server/Dockerfile`
- [ ] Eliminar directorio `bot_sessions/`
- [ ] Variables de entorno finales:
  ```bash
  # frontend/.env
  VITE_SUPABASE_URL=
  VITE_SUPABASE_ANON_KEY=

  # chatbot/.env
  SUPABASE_URL=
  SUPABASE_SERVICE_ROLE_KEY=
  OPENAI_API_KEY=
  WHATSAPP_TOKEN=
  WHATSAPP_PHONE_NUMBER_ID=
  WHATSAPP_WABA_ID=
  WHATSAPP_WEBHOOK_SECRET=
  PHONE_ADMIN=
  PORT=4000
  ```
- [ ] Crear `.env.example` para cada workspace
- [ ] Actualizar README con instrucciones de setup sin Docker

**Resultado esperado:** Cero Docker. Variables de entorno de ~20 a 9.

**Dependencias:** Fases 1-5 completas.

---

### [F6-02] Deploy del frontend en Cloudflare Pages

**Tareas:**
- [ ] Crear proyecto en Cloudflare Pages
- [ ] Conectar repositorio GitHub
- [ ] Configurar build: framework Vite, build command `npm run build:frontend`, output `frontend/dist`
- [ ] Agregar variables `VITE_*` en Cloudflare dashboard
- [ ] Configurar dominio custom
- [ ] Verificar deploy automático en cada push a `main`

**Dependencias:** F2-06, F6-01

---

### [F6-03] Deploy del backend en Railway

**Tareas:**
- [ ] Crear proyecto en Railway
- [ ] Conectar repositorio, root directory: `chatbot/`
- [ ] Start command: `npm start`
- [ ] Agregar variables de entorno del backend
- [ ] Configurar dominio (ej: `api.cleverum.app`)
- [ ] Actualizar webhook URL en Meta Business Manager con URL de Railway
- [ ] Verificar health check: `GET /health` responde 200
- [ ] Verificar que webhook de WhatsApp recibe mensajes correctamente

**Dependencias:** F3-10, F6-01

---

### [F6-04] Eliminar workspaces obsoletos

**Tareas:**
- [ ] Confirmar que `websocket-server/` fue eliminado en F1-06
- [ ] Confirmar que `web/` fue eliminado en F2-06
- [ ] Root `package.json` workspaces queda: `["frontend", "chatbot"]`
- [ ] Verificar que no hay referencias cruzadas rotas

**Dependencias:** F1-06, F2-06

---

## Resumen de eliminaciones

Al finalizar todas las fases:

| Eliminar | Reemplazado por |
|---|---|
| `websocket-server/` workspace completo | Supabase Realtime |
| `web/` workspace Next.js completo | `frontend/` Vite |
| `chatbot/flows/` + `chatbot/layers/` | `chatbot/src/flows/` |
| `chatbot/chatbotServer.ts` | `chatbot/src/index.ts` |
| `chatbot/provider/index.ts` | WhatsApp Cloud API HTTP |
| `docker-compose.yml` + Dockerfiles | CF Pages + Railway |
| `bot_sessions/` volume | Nada (sin sesiones en disco) |
| `@builderbot/bot` + `@builderbot/provider-baileys` | WhatsApp Cloud API |
| `mongoose` | Supabase JS client |
| `jose` + `bcrypt` | Supabase Auth |
| `aws-sdk` | Supabase Storage |
| `socket.io` + `socket.io-client` | Supabase Realtime |
| ~20 variables de entorno | 9 variables de entorno |
| 4 servicios Docker | 0 servidores propios |

## Dónde se usa IA vs UI nativa — resumen

| Acción | Bot 1 | Bot 2 | Bot 3 |
|---|---|---|---|
| Clasificar intent | AI | AI (mínimo) | AI |
| Menú de categorías | — | List Message | — |
| Lista de productos | — | List Message | — |
| Precios | — | DB (no AI) | — |
| Confirmar pedido | — | Buttons | — |
| Responder preguntas de empresa | AI + RAG | — | AI + RAG |
| Entender fecha en texto libre | AI | — | — |
| Confirmar horarios | Buttons | — | — |
| Calificación de lead | — | — | AI conversacional |
| Preguntas de servicios/precios | AI + RAG | — | AI + RAG |
| Extracción de datos de lead | — | — | AI (function calling) |
| Entender dirección | — | AI (simple) | — |
