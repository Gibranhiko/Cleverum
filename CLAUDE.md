# Cleverum — Project Briefing for Claude Code

This file is automatically loaded by Claude Code at every session start.
Read it fully before taking any action on this codebase.

---

## What this project is

Cleverum is a **multi-tenant WhatsApp chatbot management platform**. One Cleverum operator
(`super_admin`) configures bots for multiple business clients. Each business client can
optionally have their own login (`user` role) with access scoped to their own data and a
configurable subset of pages (e.g., DTR's user only sees Tickets and Conversaciones).

Public signup is disabled — users are always created by the super_admin via the panel.

Four bot types are supported:
- **informativo** — AI answers about the business + book appointments via Google Calendar
- **catalogo** — Product catalog via WhatsApp native UI (List Messages + Buttons) + orders
- **leads** — Conversational lead qualification via AI, stores leads in CRM
- **servicios** — FAQ + structured intake (List/Buttons) → tickets with folio + status query
  by folio. For repair shops, salons, mechanics, vets — anywhere the customer drops off
  something and waits for it.

---

## Auth model (multi-tenant)

| Role | Scope | Pages |
|---|---|---|
| `super_admin` | Sees and edits everything across all clients | All pages |
| `user` | Sees only their own client's data (filtered by RLS via `client_id`). Pages controlled by `allowed_pages` array | Subset configurable per user |

Two pages are super_admin-only and cannot be granted to a `user`: `clientes`, `usuarios`.

The frontend `lib/permissions.ts` exposes `canSee(page, profile)` and `landingPath(profile)`
used by `<PageGuard>` and `<DefaultRedirect>`. The actual data isolation is enforced by
**RLS at the DB level** — frontend page restrictions are UX, not security.

The chatbot backend uses the service role key and bypasses RLS — it does NOT respect the
multi-tenant filters because bots need to write across clients without auth context.

---

## Monorepo structure

```
Cleverum/
├── frontend/        ← Vite + React SPA (admin panel)
├── chatbot/         ← Express webhook handler (WhatsApp Cloud API + admin endpoints)
├── supabase/
│   └── migrations/  ← 001_initial_schema.sql, 002_servicios.sql,
│                      003_auth_multitenant.sql, 004_rls_multitenant_cutover.sql,
│                      005_storage_multitenant.sql
├── CLAUDE.md        ← this file
├── docs/
│   ├── architecture.md          ← current system architecture
│   ├── devplan-servicios.md     ← bot servicios devplan
│   ├── devplan-auth-multitenant.md  ← auth refactor devplan
│   ├── techdebt-bot-auth.md     ← post-implementation review findings
│   ├── techdebt-supabase.md     ← supabase / backend perf debt
│   ├── techdebt-whatsapp.md     ← whatsapp policy debt
│   └── whatsapp-compliance.md   ← outbound templates + compliance plan
└── package.json     ← workspaces: [frontend, chatbot]
```

---

## How to run

```bash
# Frontend dev server (port 5173)
npm run dev:frontend

# Chatbot dev server (port 4000)
npm run dev:bot

# Both in parallel
npm run dev
```

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | Vite + React 18 + TypeScript + TailwindCSS v4 + shadcn/ui |
| Backend | Express + TypeScript (CommonJS) |
| Database | Supabase (PostgreSQL) |
| Auth | Supabase Auth — public signup disabled. Super_admin creates users via panel. |
| Storage | Supabase Storage (buckets: `products`, `documents`, `calendar-keys`, `tickets`) |
| Realtime | Supabase Realtime (orders, leads, tickets, conversation_sessions) |
| AI | OpenAI gpt-4o (tools API, not deprecated functions API) |
| Vector DB | Supabase pgvector — text-embedding-3-small (1536 dims) |
| Messaging | WhatsApp Cloud API (Meta official, per-client credentials) |
| Calendar | Google Calendar API (per-client service account key) |
| Deploy | Railway (frontend + chatbot) |

---

## Supabase project

- Project ID: `rbfxfnwgwzbvxwifzvad`
- URL: stored in `frontend/.env` and `chatbot/.env`
- Migrations: 001 → 008 applied to prod. **009_appointments.sql (citas con slots) PENDIENTE de aplicar** — ver `docs/devplan-citas.md`
- RLS: enabled on all tables. Policy `multi_tenant_access`:
  ```sql
  using (
    public.current_user_role() = 'super_admin'
    or client_id = public.current_user_client_id()
  )
  ```
  `clients` table has split policies (super_admin full, user read-only of own row).
- Helper functions: `current_user_role()`, `current_user_client_id()` (SECURITY DEFINER, read from `user_profiles` by `auth.uid()`).
- Realtime: enabled for `orders`, `leads`, `tickets`, `conversation_sessions`. **`appointments` requiere habilitarse al aplicar 009.**

---

## Key env vars

**frontend/.env**
```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_CHATBOT_URL=
VITE_ADMIN_API_KEY=
```

**chatbot/.env**
```
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o
WHATSAPP_WEBHOOK_SECRET=
ADMIN_API_KEY=
CORS_ORIGIN=http://localhost:5173,<prod_frontend_url>
PORT=4000
```

WhatsApp credentials (`wa_phone_number_id`, `wa_access_token`) are stored **per client**
in the `clients` table — NOT as global env vars. One backend instance serves multiple
clients with their own WhatsApp numbers.

CORS allowed headers MUST include `Authorization` (Bearer token from session is used by
`/admin/*` endpoints) and `x-api-key` (legacy `/bots`, `/documents` endpoints).

---

## Architectural decisions (non-obvious)

**1. Hybrid AI + WhatsApp native UI**
AI is only used where it adds real value. WhatsApp List Messages and Reply Buttons are
used for menus, prices, intake fields, and confirmations — they are instant, deterministic,
and cannot hallucinate. AI handles open-ended questions, intent classification, and data
extraction.

**2. Single webhook, multiple clients**
One Express server handles all clients. Incoming messages are routed to the correct client
by matching `wa_phone_number_id` (from webhook metadata) to the `clients` table.

**3. Session state in Supabase, not memory**
`conversation_sessions` table stores the full state machine for each conversation
(`current_flow`, `flow_step`, `state` JSON, `history`). An in-memory cache with 5-minute
TTL sits in front to reduce DB reads. Sessions survive server restarts.

**4. OpenAI tools API, not functions API**
The `functions` + `function_call` params are deprecated. All AI function calls use:
```ts
tools: [{ type: 'function', function: {...} }]
tool_choice: { type: 'function', function: { name: 'fn' } }
```

**5. RAG is required, not optional (for FAQ)**
Bots `informativo`, `leads`, and `servicios` (FAQ branch) use pgvector to retrieve
relevant document chunks before calling OpenAI. This grounds responses in real client
data. Bot `catalogo` does NOT use RAG — product data comes from the DB directly.

**6. Tickets have random alphanumeric folios**
Format: `{PREFIX}{6 chars}` from alphabet `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` (no O/0/I/1).
Example: `DTRX7K9P2`. Generated via `crypto.randomBytes` with collision retry. Sequential
folios were rejected for security reasons (enumeration + leaking volume of business).

**7. Page-level access for `user`**
`user_profiles.allowed_pages text[]` lists page keys the user can see in the panel. RLS
filters by `client_id` (real security), `allowed_pages` controls UI visibility (UX layer).
A motivated `user` could query data they're allowed to see by `client_id` even on pages
they can't access — this is intentional and documented.

**8. No Docker**
Docker was eliminated entirely. Dev: tsx + Vite. Prod: Railway buildpacks for both services.

---

## Current status

| Phase | Status | Notes |
|---|---|---|
| F1 — Supabase Foundation | ✅ Complete | |
| F2 — Frontend (Vite) | ✅ Complete | |
| F3 — WhatsApp Cloud API | ✅ Complete | 4 bot types working |
| F4 — RAG Integration | ✅ Complete | text-embedding-3-small + match_chunks SQL function |
| F5 — Admin Panel v2 | ✅ Complete | Tickets + Servicios + Usuarios pages |
| Auth multi-tenant | ✅ Complete | 2 roles, page-based access, user CRUD |
| Bot servicios | ✅ Complete | Intake + tickets + status query + FAQ |
| Citas con slots (informativo) | 🚧 Código listo, falta deploy | Motor de slots + doble escritura Calendar/DB + panel Citas + Config Citas. Aplicar migración 009 + habilitar realtime + configurar cliente. Ver `docs/devplan-citas.md` |
| F6 — Outbound templates | ⏳ Pending | See `docs/whatsapp-compliance.md` |
| F7 — Outbound notifications (Fase 2 servicios) | ⏳ Pending | Depends on F6 |

---

## Coding conventions

- TypeScript everywhere (strict: false, skipLibCheck: true)
- Frontend: functional components, no class components
- Frontend: imports via `@/` alias (maps to `frontend/src/`)
- Backend: CommonJS output (tsc), ESM source syntax
- No comments unless explaining a non-obvious constraint
- No unused imports, no dead code
- shadcn/ui components only (no custom UI primitives)
- Supabase client in frontend uses anon key (RLS enforces access)
- Supabase client in chatbot uses service role key (bypasses RLS — intentional)
- All DB writes from chatbot go through service role (bots need to write without auth)
- New page added? Update `frontend/src/lib/permissions.ts` `PAGE_KEYS` array
- New table added? Add `multi_tenant_access` RLS policy in the migration
- Outbound WhatsApp messages (proactive) MUST go through the templates layer (when F6
  ships). Don't hard-code outbound text.

---

## Things to NEVER do

- Do not add `type: "module"` to `chatbot/package.json` (it uses CommonJS)
- Do not use `functions` + `function_call` in OpenAI calls (deprecated) — use `tools`
- Do not write WhatsApp credentials to env vars — they live in the `clients` table
- Do not use Mongoose — Supabase client handles all DB operations
- Do not use socket.io — Supabase Realtime handles notifications
- Do not create Docker files or docker-compose services
- Do not enable public signup — users are always created by super_admin via the panel
- Do not bypass RLS in the frontend (do not pass service role key, no admin-style queries)
- Do not add a new table without an RLS policy — RLS enabled on all tables
- Do not hard-code outbound WhatsApp message text — must go through approved templates
  (see `docs/whatsapp-compliance.md`)
- Do not use sequential ticket folios — random alphanumeric only
