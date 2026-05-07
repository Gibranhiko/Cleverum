# Cleverum — System Architecture

> Current as of: F5 + Auth multi-tenant + Bot servicios complete
> Last update: 2026-05-07

---

## System overview

```
┌─────────────────────────────────────────────────────────────────────┐
│           USERS                                                      │
│  • Cleverum operator (super_admin) — sees all clients                │
│  • Per-client users (role=user) — see only their own data,           │
│    pages controlled by allowed_pages                                 │
└──────────────────────────────┬──────────────────────────────────────┘
                               │ HTTPS
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    FRONTEND — Railway                               │
│              Vite + React SPA  (frontend/src/)                      │
│                                                                     │
│  Public:        /login   /reset-password   /no-access               │
│  Authenticated: /dashboard                                          │
│  Super_admin:   /clientes  /usuarios  /config                       │
│  Per-page ACL:  /tickets  /servicios  /pedidos  /productos          │
│                 /leads    /conversaciones  /reminders  /documentos  │
└──────────────────┬──────────────────────────────────────────────────┘
                   │ Supabase JS SDK (anon key + RLS multi_tenant_access)
                   │ + Bearer token to chatbot for /admin/*
                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         SUPABASE                                    │
│                                                                     │
│  PostgreSQL DB   │  Auth (email/pass)  │  Storage (4 buckets)       │
│  Realtime        │  pgvector (RAG)     │  Row Level Security        │
│                                                                     │
│  Helper SECURITY DEFINER functions used by all RLS policies:        │
│  • current_user_role()      — reads user_profiles by auth.uid()     │
│  • current_user_client_id() — reads user_profiles by auth.uid()     │
└────────┬─────────────────────────────────────────┬──────────────────┘
         │ service role (bypasses RLS)             │ anon key (RLS)
         ▼                                         ▼
┌─────────────────────────┐            ┌──────────────────────────────┐
│  CHATBOT — Railway      │            │   FRONTEND reads/writes      │
│  Express webhook handler│            │   tables via RLS policy      │
│  (chatbot/src/)         │            │   (filtered by client_id     │
│                         │            │    for non-super_admin)      │
│  POST /webhook ←─ Meta  │◄────────── └──────────────────────────────┘
│  GET  /webhook (verify) │            WhatsApp users (multiple
│  /bots/*  (legacy mgmt) │            clients, per-client numbers)
│  /documents/* (RAG)     │
│  /admin/users (CRUD)    │
└────────┬────────────────┘
         │
    ┌────┴──────────────────────┐
    │                           │
    ▼                           ▼
┌─────────┐             ┌──────────────┐
│ OpenAI  │             │ Google       │
│ gpt-4o  │             │ Calendar API │
│ embed   │             │ (per client) │
└─────────┘             └──────────────┘
```

---

## Database schema

### `user_profiles` (auth multi-tenant)
Maps `auth.users` to a role and (for non-super_admin) a `client_id` + page allowlist.

| Column | Type | Notes |
|---|---|---|
| id | uuid PK FK → auth.users | Cascade delete from auth.users |
| role | text | `super_admin` \| `user` |
| client_id | uuid FK → clients | Required for `user`, null for `super_admin` |
| allowed_pages | text[] | Page keys the user can see in the panel |
| full_name | text | |
| created_at | timestamptz | |

CHECK constraints enforce: super_admin has null client_id, user has non-null client_id.

### `clients`
Central table. Each row is one business client with its own WhatsApp number and bot.

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| company_name | text | |
| company_type | text | Restaurante, Clínica, etc. |
| company_email | text | |
| company_address | text | |
| admin_name | text | |
| whatsapp_phone | text | Display number |
| bot_type | text | `informativo` \| `catalogo` \| `leads` \| `servicios` |
| facebook_link | text | |
| instagram_link | text | |
| image_url | text | Supabase Storage URL |
| google_calendar_key_url | text | Path inside `calendar-keys` bucket |
| google_calendar_id | text | |
| **wa_phone_number_id** | text | Meta phone number ID — used to route incoming webhooks |
| **wa_access_token** | text | Meta access token for this client |
| **bot_active** | boolean | Global on/off switch for the bot |
| **ticket_prefix** | text | 2-5 chars A-Z, used in folios for `servicios` bot |
| **ticket_counter** | int | Legacy from sequential folios; unused since random folios introduced |
| is_active | boolean | Soft delete for the client account |
| created_at / updated_at | timestamptz | |

### `services` (bot servicios)
Catalog of services the business offers. Rendered as List Message in the bot when user
asks "Servicios y precios".

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| client_id | uuid FK | |
| name | text | |
| description | text | |
| category | text | Used to group in WA list sections |
| price_amount | numeric(10,2) | Optional |
| price_label | text | "Desde $500" / "Según diagnóstico" — overrides price_amount in display |
| estimated_duration | text | "2-3 días" |
| is_active | boolean | |
| display_order | int | |

### `tickets` (bot servicios)
Service orders (repair tickets, salon appointments, etc.).

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| folio | text | `{PREFIX}{6 random alphanumeric}` — unique per client |
| client_id | uuid FK | |
| customer_phone | text | |
| customer_name | text | |
| device_type / device_brand / device_model | text | Intake fields |
| problem_description | text | |
| problem_category | text | AI-classified: `pantalla` \| `bateria` \| `software` \| `carga` \| `agua` \| `otro` |
| photos | text[] | URLs to `tickets` storage bucket (Fase 2) |
| status | text | `recibido` → `diagnostico` → `cotizado` → `aprobado` → `en_reparacion` → `listo` → `entregado`, plus `rechazado` and `cancelado` |
| status_history | jsonb | `[{status, at, by, note}]` — append-only timeline |
| quote_amount | numeric(10,2) | |
| internal_notes | text | Operator-only |
| created_at / updated_at | timestamptz | |

UNIQUE (client_id, folio).

### `products`
Product catalog for `catalogo` bots.

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| client_id | uuid FK | |
| category | text | Used to build List Message sections |
| name | text | |
| description | text | |
| type | text | individual, familiar, etc. |
| options | jsonb | Price variants (future use) |
| includes | text | What's included |
| image_url | text | Supabase Storage `products` bucket |

### `orders`
Orders created by `catalogo` bot.

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| client_id | uuid FK | |
| customer_name | text | |
| customer_phone | text | |
| items | jsonb | `[{name, category}]` |
| delivery_type | text | `delivery` \| `pickup` |
| address | text | |
| payment_method | text | |
| client_payment | numeric | |
| total | numeric | |
| status | boolean | false=pending, true=completed |
| planned_date | timestamptz | |
| created_at | timestamptz | |

### `leads`
Captured by `leads` bot.

| Column | Type | Notes |
|---|---|---|
| id, client_id, customer_name, customer_phone | | |
| company, need, budget_range, timeline | text | |
| status | text | `new` \| `contacted` \| `qualified` \| `lost` \| `won` |
| notes | text | |
| raw_conversation | jsonb | History at time of capture |

### `conversation_sessions`
State machine for each active WhatsApp conversation.

| Column | Type | Notes |
|---|---|---|
| client_id, phone_number | text | UNIQUE together |
| current_flow | text | `intake` \| `status` \| `faq` \| `appointment` \| `catalog` \| `leads_qualification` \| null |
| flow_step | text | Step within current flow |
| state | jsonb | Arbitrary flow state |
| history | jsonb | Last 10 messages — context for AI |
| bot_disabled_for_user | boolean | Per-user `botoff` |
| human_takeover | boolean | Operator manually responding |

### `reminders`, `documents`, `document_chunks`, `bot_configs`
Pre-existing — see migration 001.

### `match_chunks()` SQL function
RAG retrieval. Updated default threshold: `0.4` (was 0.75).

```sql
match_chunks(query_embedding, client_id_filter, match_threshold = 0.4, match_count = 6)
→ table(id, content, similarity)
```

---

## RLS policy pattern

All tables with `client_id` use this policy (created in migration 004):

```sql
create policy multi_tenant_access on <table>
  for all to authenticated
  using (
    public.current_user_role() = 'super_admin'
    or client_id = public.current_user_client_id()
  )
  with check (...same condition...);
```

`clients` is special — split into two policies:
- `super_admin_clients` — FOR ALL, allows full CRUD
- `user_read_own_client` — FOR SELECT, only `id = current_user_client_id()`

`user_profiles`:
- `self_read` — FOR SELECT, `id = auth.uid()`
- `super_admin_write` — FOR ALL, `current_user_role() = 'super_admin'`

The chatbot bypasses all of this via service role key.

---

## Frontend routes

### Public
| Route | Page | Notes |
|---|---|---|
| `/login` | Login.tsx | Supabase auth |
| `/reset-password` | ResetPassword.tsx | Triggered by `PASSWORD_RECOVERY` event |

### Authenticated (inside DashboardLayout, behind AuthGuard)
| Route | Page | Access |
|---|---|---|
| `/` | DefaultRedirect | Redirects based on profile |
| `/no-access` | NoAccess.tsx | Shown when user has empty `allowed_pages` |
| `/dashboard` | Dashboard.tsx | Per allowed_pages |
| `/clientes` | Clientes.tsx | super_admin only |
| `/usuarios` | Usuarios.tsx | super_admin only |
| `/config` | ConfigBot.tsx | Per allowed_pages |
| `/pedidos` | Pedidos.tsx | Per allowed_pages |
| `/productos` | Productos.tsx | Per allowed_pages |
| `/leads` | Leads.tsx | Per allowed_pages |
| `/conversaciones` | Conversaciones.tsx | Per allowed_pages |
| `/reminders` | Reminders.tsx | Per allowed_pages |
| `/documentos` | Documentos.tsx | Per allowed_pages |
| `/tickets` | Tickets.tsx | Per allowed_pages |
| `/servicios` | Servicios.tsx | Per allowed_pages |

Access enforced by `<PageGuard page="...">` wrapper. `Navbar` filters items via
`canSee()` from `lib/permissions.ts`.

**State management:** `AppContext` exposes:
- `session` — Supabase auth session
- `profile` — `user_profiles` row of current user
- `loading` — initial session+profile resolution
- `isPasswordRecovery` — true while in PASSWORD_RECOVERY flow
- `selectedClient` — used by realtime notifications subscription
- `notifications` — unread count
- `signOut` / `clearPasswordRecovery` — actions

The `onAuthStateChange` handler distinguishes:
- `PASSWORD_RECOVERY` → set flag, force redirect to `/reset-password`
- `TOKEN_REFRESHED` → only update session (no spinner / no profile re-fetch)
- All others (`INITIAL_SESSION`, `SIGNED_IN`, `SIGNED_OUT`, `USER_UPDATED`) → full re-resolve

---

## Backend API endpoints

Base: `http://localhost:4000` (dev) / Railway URL (prod)

### WhatsApp webhook
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/webhook` | Meta verify token | Webhook verification |
| POST | `/webhook` | none (Meta IP) | Incoming WhatsApp messages |

### Legacy management API (`x-api-key` header)
| Method | Path | Description |
|---|---|---|
| PUT | `/bots/:clientId/toggle` | Toggle `bot_active` |
| GET | `/bots/status` | All bot statuses |
| POST | `/bots/:clientId/takeover` | Set `human_takeover` flag |
| POST | `/bots/:clientId/send` | Send message as operator (within 24h window) |
| PUT | `/bots/:clientId/credentials` | Update WA credentials |
| POST | `/documents/:clientId/index` | RAG index a document |

### Admin API (Bearer token from super_admin session)
| Method | Path | Description |
|---|---|---|
| GET | `/admin/users` | List all `user_profiles` joined with auth.users emails |
| POST | `/admin/users` | Create user (auth.admin.createUser + insert profile) |
| PATCH | `/admin/users/:id` | Update profile (role, client_id, allowed_pages, full_name) |
| DELETE | `/admin/users/:id` | Delete user (cascade deletes profile via FK) |

CORS `allowedHeaders` MUST include `Authorization` for these to work.

### Health
| Method | Path | Description |
|---|---|---|
| GET | `/health` | Health check for Railway |

---

## Bot flow state machines

### Bot 1 — Informativo (infoBot.ts)
```
current_flow === 'appointment'? → continueAppointmentFlow()
       ↓ no
determineIntent() → agendar_cita | consultar_empresa | consultar_servicios | hablar
   agendar_cita → startAppointmentFlow() → AI conversational intake → CITA_CONFIRMADA
   consultar_empresa | consultar_servicios → RAG + AI conversation
   hablar → AI conversation (no RAG)
```

### Bot 2 — Catálogo (catalogBot.ts)
List/Buttons-driven cart flow → checkout → INSERT orders. No AI for menu, AI only for
address parsing in delivery mode.

### Bot 3 — Leads (leadsBot.ts)
AI conversation with SYSTEM_PROMPT + RAG. When AI returns `LEAD_LISTO` token →
captureLead() → INSERT into leads.

### Bot 4 — Servicios (servicesBot.ts)
```
Folio detected (strict regex)? → handleStatusQuery()
Menu_ tap?          → routeMenuOption()
Active flow?        → handleIntakeStep | handleStatusQuery | runFAQ
Free text, no flow? → ai.getServicesIntent() →
                       levantar_orden → startIntake (List/Buttons state machine)
                       consultar_orden → promptForFolio
                       ver_servicios → sendServicesList
                       consultar_empresa → startFAQ (RAG)
                       hablar_humano → human_takeover=true
                       saludo → sendMainMenu
```

Intake is structured (List/Buttons) for: device_type → brand → model (text) →
problem (text → AI classifies category) → name (text) → confirm (buttons + free-text
words like "sí" / "no" accepted).

Folio generation: `crypto.randomBytes` over alphabet `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`
(no O/0/I/1), 6 chars suffix, format `{PREFIX}{SUFFIX}` (no dash). Retry up to 5 times
on collision.

---

## WhatsApp Cloud API integration

**Credential model:** Each client has its own `wa_phone_number_id` and `wa_access_token`
in `clients`. Webhook routes by matching incoming `phone_number_id` to the table.

**Client cache:** `getCachedClient(phoneNumberId)` caches client rows for 5 minutes.
Invalidated when credentials are updated via management API.

**Outbound message types implemented:**
- `sendText()` — plain text
- `sendList()` — scrollable list (max 10 items)
- `sendButtons()` — reply buttons (max 3)
- `sendImage()` — image with caption

**Incoming message types handled:**
- `text` — plain user message
- `interactive/button_reply` — button tap (id used as routing token)
- `interactive/list_reply` — list selection (id used as routing token)

Other types (`image`, `audio`, `video`, etc.) are currently ignored — a TODO for Fase 2 of
servicios is to forward `image` to the bot when in `awaiting_photo` step.

**24-hour window:** all responses to inbound messages are free. Proactive (outbound)
messages outside the window require an approved template — see `docs/whatsapp-compliance.md`.

---

## Supabase Realtime subscriptions

| Source | Table | Filter | Action |
|---|---|---|---|
| AppContext (notifications) | orders | client_id | Increment counter |
| AppContext (notifications) | leads | client_id | Increment counter |
| Conversaciones.tsx | conversation_sessions | client_id | Refresh list |
| Pedidos.tsx | orders | client_id | Refresh table |
| Leads.tsx | leads | client_id | Refresh table |
| Tickets.tsx | tickets | client_id | Refresh table |

Realtime respects RLS — a `user` only receives events for rows where their `client_id`
matches.

---

## Supabase Storage buckets

| Bucket | Visibility | Used for |
|---|---|---|
| `products` | Public | Product images |
| `documents` | Private | RAG source uploads (currently unused — content stored in `documents.content` column) |
| `calendar-keys` | Private | Per-client Google service account JSON. Path: `{client_id}/service-account.json` |
| `tickets` | Private | Photos of devices (Fase 2 of servicios). Path: `{client_id}/...` |

Storage RLS policies (migration 005) filter by first folder segment matching
`current_user_client_id()`. Super_admin bypasses.

The `products` bucket is public so the bot can serve `image_url` directly to WhatsApp
without auth.

---

## RAG architecture

```
Admin uploads document → INSERT into `documents` (content stored as text)
                       ↓
POST /documents/:clientId/index
  → split into ~400-token chunks with 50-token overlap
  → openai.embeddings.create(text-embedding-3-small) for each
  → INSERT into document_chunks (content, embedding)
                       ↓
Bot receives FAQ-like message (intent: consultar_empresa | consultar_servicios)
  → ragQuery = `${userMessage} ${client.company_name}`  (augmented with company name)
  → embed(ragQuery) → query_embedding
  → supabase.rpc('match_chunks', { query_embedding, client_id, threshold=0.4, count=6 })
  → inject top 6 chunks into system prompt (prompt-talker.txt)
  → call OpenAI with grounded context
```

Threshold 0.4 (was 0.75) and count 6 (was 4) are deliberate — short conversational
queries have lower cosine similarity, and the FAQ bot benefits from broader context.

---

## Auth flow specifics

**Login:**
1. `Login.tsx` → `supabase.auth.signInWithPassword`
2. `onAuthStateChange` fires with `SIGNED_IN`
3. `AppContext` resolves session + fetches `user_profiles` row
4. `AuthGuard` lets through; `DefaultRedirect` sends to `/dashboard` (super_admin) or
   first allowed page (user)

**Password recovery:**
1. Super_admin sends recovery email from Supabase Dashboard
2. User clicks link → Supabase verifies, creates session, redirects with hash
3. supabase-js parses hash, fires `PASSWORD_RECOVERY` event
4. AppContext sets `isPasswordRecovery=true`, does NOT load profile
5. AuthGuard redirects to `/reset-password`
6. ResetPassword form → `supabase.auth.updateUser({ password })` → clears flag → navigate
   to dashboard

**User without profile** (auth.users exists, no user_profiles row):
- AuthGuard shows "Cuenta sin configurar" with logout button.

**User with empty allowed_pages** (super_admin forgot to assign pages):
- Lands on `/no-access` page (route defined explicitly to break the redirect loop).

---

## Deployment targets

| Service | Platform | Build command | Notes |
|---|---|---|---|
| Frontend | Railway | `npm run build --workspace=frontend` | Output: `frontend/dist/`, served via `serve` |
| Chatbot | Railway | `npm run build` (in chatbot/) | Output: `chatbot/dist/`, run `node dist/index.js` |
| Database | Supabase | Managed | |

Each service has a `railway.json` defining build+start.

**No Docker.** All infrastructure is managed cloud services.

---

## Outbound notifications & WhatsApp templates (planned)

Currently the platform is REACTIVE only — bot replies to inbound, all free under the 24h
window. Fase 2 of `servicios` will introduce proactive notifications (status updates from
operator). These require:

- Approved templates in Meta Business Manager
- Enforcement layer in code (`sendTemplateMessage` validates template approved + opt-out
  + throttle + quality rating before sending)
- Cost tracking dashboard

Full plan in `docs/whatsapp-compliance.md` (Epic F).

Existing `reminders` feature already sends outbound but with hard-coded text — flagged as
debt to migrate to templates before scaling.

---

## Cleanup completed

- Docker eliminated (no Dockerfile, no docker-compose)
- Next.js eliminated (Vite-only frontend)
- BuilderBot eliminated (custom session manager + state machine)
- MongoDB eliminated (Supabase only)
- Mongoose, socket.io eliminated

## Open dead code

- `next_ticket_number()` SQL function — superseded by random folios but kept for backward
  compat with legacy `DTR-1` style tickets
- `ticket_counter` column on `clients` — same reason
- `documents` storage bucket exists but unused (content stored in `documents.content` text
  column instead)
