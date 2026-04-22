# Cleverum — Project Briefing for Claude Code

This file is automatically loaded by Claude Code at every session start.
Read it fully before taking any action on this codebase.

---

## What this project is

Cleverum is an **internal operator panel** for managing WhatsApp chatbots for multiple
business clients. It is NOT a SaaS product — there is no public signup, no multi-tenant
auth, no landing page. The operator (a single admin user) configures bots for each client
and manages all credentials.

Three bot types are supported:
- **informativo** — AI answers about the business + book appointments via Google Calendar
- **catalogo** — Product catalog via WhatsApp native UI (List Messages + Buttons) + orders
- **leads** — Conversational lead qualification via AI, stores leads in CRM

---

## Monorepo structure

```
Cleverum/
├── frontend/        ← Vite + React SPA (admin panel)
├── chatbot/         ← Express webhook handler (WhatsApp Cloud API)
├── supabase/
│   └── migrations/  ← 001_initial_schema.sql (applied to Supabase)
├── CLAUDE.md        ← this file
├── REFACTOR.md      ← original refactor plan (historical reference)
├── docs/
│   ├── architecture.md  ← current system architecture
│   └── devplan.md       ← remaining tickets (F4, F5, F6)
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
| Auth | Supabase Auth (single admin user, signups disabled) |
| Storage | Supabase Storage (buckets: `products`, `documents`) |
| Realtime | Supabase Realtime (orders, leads, conversation_sessions) |
| AI | OpenAI gpt-4o (tools API, not deprecated functions API) |
| Vector DB | Supabase pgvector — text-embedding-3-small (1536 dims) |
| Messaging | WhatsApp Cloud API (Meta official, per-client credentials) |
| Calendar | Google Calendar API (per-client service account key) |
| Deploy | Cloudflare Pages (frontend) + Railway (chatbot) |

---

## Supabase project

- Project ID: `rbfxfnwgwzbvxwifzvad`
- URL: stored in `frontend/.env` and `chatbot/.env`
- Migration: `supabase/migrations/001_initial_schema.sql` (already applied)
- RLS: enabled on all tables, policy: `authenticated_full_access` (`auth.role() = 'authenticated'`)
- Realtime: enabled for `orders`, `leads`, `conversation_sessions`

---

## Key env vars

**frontend/.env**
```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

**chatbot/.env**
```
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o
WHATSAPP_WEBHOOK_SECRET=
PORT=4000
```

WhatsApp credentials (phone_number_id, access_token) are stored **per client** in the
`clients` table — NOT as global env vars. This allows managing multiple clients with
one backend instance.

---

## Architectural decisions (non-obvious)

**1. Hybrid AI + WhatsApp native UI**
AI is only used where it adds real value. WhatsApp List Messages and Reply Buttons are
used for menus, prices, and confirmations — they are instant, deterministic, and cannot
hallucinate. AI handles open-ended questions, intent classification, and data extraction.

**2. Single webhook, multiple clients**
One Express server handles all clients. Incoming messages are routed to the correct client
by matching `wa_phone_number_id` (from webhook metadata) to the `clients` table.

**3. Session state in Supabase, not memory**
`conversation_sessions` table stores the full state machine for each conversation
(current_flow, flow_step, state JSON, history). An in-memory cache with 5-minute TTL
sits in front to reduce DB reads. Sessions survive server restarts.

**4. OpenAI tools API, not functions API**
The `functions` + `function_call` params are deprecated. All AI function calls use:
```ts
tools: [{ type: 'function', function: {...} }]
tool_choice: { type: 'function', function: { name: 'fn' } }
```

**5. RAG is required, not optional**
Bot 1 (informativo) and Bot 3 (leads) use pgvector to retrieve relevant document chunks
before calling OpenAI. This prevents hallucinations and grounds responses in real client
data. Bot 2 (catalogo) does NOT use RAG — product data comes from the DB directly.

**6. No Docker**
Docker was eliminated entirely. Dev: tsx + Vite. Prod: Cloudflare Pages + Railway.

---

## Current refactor status

| Phase | Status | Notes |
|---|---|---|
| F1 — Supabase Foundation | ✅ Complete | Schema, auth, storage, realtime, RLS |
| F2 — Frontend (Vite) | ✅ Complete | All 7 pages, Next.js deleted |
| F3 — WhatsApp Cloud API | ✅ Complete | Webhook, 3 bots, session manager, reminders |
| F4 — RAG Integration | ⏳ Pending | See docs/devplan.md |
| F5 — Admin Panel v2 | ⏳ Pending | See docs/devplan.md |
| F6 — Cleanup & Deploy | ⏳ Pending | See docs/devplan.md |

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

---

## Things to NEVER do

- Do not add `type: "module"` to chatbot/package.json (it uses CommonJS)
- Do not use `functions` + `function_call` in OpenAI calls (deprecated) — use `tools`
- Do not write WhatsApp credentials to env vars — they live in the `clients` table
- Do not use Mongoose — Supabase client handles all DB operations
- Do not use socket.io — Supabase Realtime handles notifications
- Do not create Docker files or docker-compose services
- Do not add public registration or multi-user auth — single admin user only
