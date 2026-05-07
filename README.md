# Cleverum

Multi-tenant WhatsApp chatbot management platform. One operator (`super_admin`) configures bots for multiple business clients, and each client can optionally have their own login (`user` role) with access scoped to their data and a configurable subset of pages.

Public signup is disabled — users are always created by the super_admin.

---

## What it does

Cleverum lets one operator configure and run AI-powered WhatsApp bots for different business clients. Each client gets their own WhatsApp number and one of four bot types:

- **informativo** — answers questions about the business using a RAG knowledge base + books appointments via Google Calendar
- **catalogo** — product catalog via WhatsApp native UI (Lists + Buttons), handles orders end-to-end
- **leads** — conversational AI that qualifies prospects and saves them to a CRM
- **servicios** — FAQ + structured intake (Lists/Buttons) → tickets with random folio + status query. For repair shops, salons, mechanics, vets — anywhere the customer drops off something and waits for it.

The admin panel provides real-time visibility into orders, leads, tickets, and active conversations. Operators can take over any conversation. Super_admin can invite client users with page-level access (e.g., DTR's user only sees Tickets and Conversaciones).

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | Vite + React 18 + TypeScript + TailwindCSS v4 + shadcn/ui |
| Backend | Express + TypeScript (CommonJS) |
| Database | Supabase (PostgreSQL + pgvector + Auth + Storage + Realtime) |
| AI | OpenAI gpt-4o (chat, intent, tools API) + text-embedding-3-small (RAG) |
| Messaging | WhatsApp Cloud API (Meta official, per-client credentials) |
| Calendar | Google Calendar API (per-client service account) |
| Deploy | Railway (frontend + chatbot) |

No Docker. No WebSockets. No MongoDB.

---

## Auth model

| Role | Scope | Pages |
|---|---|---|
| `super_admin` | Sees and edits all clients | All |
| `user` | Tied to one `client_id`. Sees only that client's data via RLS | Subset configurable per user |

Two pages are super_admin-only and cannot be granted to a `user`: `clientes`, `usuarios`.

Data isolation is enforced by RLS at the DB level. The `allowed_pages` array on each user's profile only controls UI visibility.

---

## Monorepo structure

```
Cleverum/
├── frontend/        ← Vite + React SPA
│   └── src/
│       ├── pages/        ← Dashboard, Clientes, Usuarios, Tickets, Servicios, etc.
│       ├── components/   ← Modals, PageGuard, AuthGuard, Navbar, etc.
│       ├── context/      ← AppContext (session + profile + notifications)
│       └── lib/          ← supabase, permissions, config
├── chatbot/         ← Express webhook handler + admin endpoints
│   └── src/
│       ├── flows/        ← infoBot, catalogBot, leadsBot, servicesBot
│       ├── services/     ← ai, rag, reminder, googleCalendar, metaTemplates (planned)
│       ├── webhook/      ← handler, verify
│       ├── routes/       ← bots, documents, admin
│       ├── middleware/   ← auth (api key), requireSuperAdmin (Bearer token)
│       ├── lib/          ← supabase, whatsapp, session, tickets
│       └── prompts/      ← .txt prompt files (copied to dist on build)
├── supabase/
│   └── migrations/  ← 001 → 005 (foundation, servicios, auth, RLS, storage)
├── docs/
│   ├── architecture.md
│   ├── devplan-servicios.md
│   ├── devplan-auth-multitenant.md
│   ├── techdebt-bot-auth.md
│   ├── techdebt-supabase.md
│   ├── techdebt-whatsapp.md
│   └── whatsapp-compliance.md
├── CLAUDE.md
└── package.json     ← workspaces: [frontend, chatbot]
```

---

## Running locally

```bash
# Install all dependencies (root + workspaces)
npm install

# Start both frontend (port 5173) and chatbot (port 4000) in parallel
npm run dev

# Or individually
npm run dev:frontend
npm run dev:bot
```

### Required env files

**`chatbot/.env`**
```
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o
WHATSAPP_WEBHOOK_SECRET=
ADMIN_API_KEY=
PORT=4000
CORS_ORIGIN=http://localhost:5173
```

**`frontend/.env`**
```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_CHATBOT_URL=http://localhost:4000
VITE_ADMIN_API_KEY=
```

WhatsApp credentials (`wa_phone_number_id`, `wa_access_token`) are stored **per client** in the `clients` table — not as env vars. One backend instance serves multiple clients with their own WhatsApp numbers.

---

## Architecture overview

```
Users (super_admin + per-client users)
      │ HTTPS
      ▼
Frontend — Railway
  Vite SPA, RLS via Supabase JS SDK + Bearer token to chatbot for /admin/*
      │
      ▼
Supabase
  PostgreSQL │ Auth │ Storage (products, documents, calendar-keys, tickets)
  Realtime │ pgvector │ RLS multi_tenant_access
      ▲
      │ service role (bypasses RLS)
      │
Chatbot — Railway
  Express webhook handler + /admin (Bearer token, super_admin only)
  POST /webhook  ← WhatsApp Cloud API (Meta)
  GET  /webhook  (Meta verification)
  /bots/*        (legacy management, x-api-key)
  /documents/*   (RAG indexing, x-api-key)
  /admin/users   (Bearer token from super_admin session)
      │
      ├── OpenAI (gpt-4o + text-embedding-3-small)
      └── Google Calendar API
```

---

## How incoming WhatsApp messages are routed

1. Meta sends `POST /webhook` with a `phone_number_id` in the payload
2. Handler looks up the client in `clients` table by `wa_phone_number_id` (5-min cache)
3. Checks `client.bot_active` and the session's `human_takeover` / `bot_disabled_for_user` flags
4. Routes to `infoBot`, `catalogBot`, `leadsBot`, or `servicesBot` based on `client.bot_type`

---

## Admin & bot API endpoints

### Webhook (no auth — Meta IP)
| Method | Path | Description |
|---|---|---|
| GET | `/webhook` | Meta verification |
| POST | `/webhook` | Incoming WhatsApp messages |

### Legacy management (`x-api-key` header)
| Method | Path | Description |
|---|---|---|
| GET | `/bots/status` | All clients + bot status |
| PUT | `/bots/:clientId/toggle` | Toggle bot on/off |
| POST | `/bots/:clientId/takeover` | Enable/disable human takeover |
| POST | `/bots/:clientId/send` | Send message as agent (within 24h window) |
| PUT | `/bots/:clientId/credentials` | Update WhatsApp credentials |
| POST | `/documents/:clientId/index` | RAG index a document |

### Admin (Bearer token from super_admin session)
| Method | Path | Description |
|---|---|---|
| GET | `/admin/users` | List user profiles + emails |
| POST | `/admin/users` | Create user (auth + profile) |
| PATCH | `/admin/users/:id` | Update profile (role, client_id, allowed_pages) |
| DELETE | `/admin/users/:id` | Delete user (cascade) |

CORS `allowedHeaders` includes both `x-api-key` and `Authorization`.

---

## Deployment

Both services run on Railway, deployed from the same GitHub repo.

| Service | Root dir | Build | Start |
|---|---|---|---|
| chatbot | `chatbot/` | `npm run build` (`tsc` + copy prompts) | `node dist/index.js` |
| frontend | repo root | `npm run build --workspace=frontend` | `npx serve frontend/dist -l $PORT` |

Each service has a `railway.json` defining build+start commands.

### Required Railway env vars

**Chatbot service**
```
SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
OPENAI_API_KEY, OPENAI_MODEL,
WHATSAPP_WEBHOOK_SECRET, ADMIN_API_KEY,
CORS_ORIGIN, PORT
```

**Frontend service**
```
VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY,
VITE_CHATBOT_URL, VITE_ADMIN_API_KEY
```

### WhatsApp webhook setup (Meta)

1. Deploy chatbot to Railway → get the public URL
2. Meta Developer Console → your app → WhatsApp → Configuration
3. Set callback URL: `https://<chatbot-url>/webhook`
4. Set verify token: value of `WHATSAPP_WEBHOOK_SECRET`
5. Subscribe to the `messages` field
6. Add your phone number as a test recipient (until you publish the app to Live mode)

### Supabase Auth setup

1. Authentication → URL Configuration:
   - Site URL: production frontend URL
   - Redirect URLs: `<prod_frontend_url>/**` and `http://localhost:5173/**`
2. (Recommended for prod) Configure custom SMTP under Authentication → SMTP Settings — bypasses the default 4 emails/hour limit on password recovery, magic links, etc.

---

## Database

Managed by Supabase. Migrations under `supabase/migrations/`:

| Migration | Adds |
|---|---|
| 001 | clients, products, orders, leads, reminders, conversation_sessions, bot_configs, documents, document_chunks, match_chunks() |
| 002 | services, tickets, next_ticket_number() (legacy), bot_type='servicios' |
| 003 | user_profiles, current_user_role(), current_user_client_id() |
| 004 | RLS cutover — multi_tenant_access policy on every table |
| 005 | Storage policies — calendar-keys, documents, tickets buckets filtered by client_id |

RLS is enabled on all tables. The frontend uses the anon key (RLS enforced). The chatbot uses the service role key (bypasses RLS — intentional, bots write across clients without auth context).

---

## Onboarding a new business client

1. Login as super_admin → **Clientes** → "Nuevo cliente"
2. Fill company info, select bot type (`informativo` / `catalogo` / `leads` / `servicios`)
3. Add WhatsApp credentials (phone_number_id + access_token from Meta Business Manager)
4. For `informativo`: upload Google Calendar service account JSON if appointments are needed
5. For `servicios`: set `ticket_prefix` (2-5 letters)
6. (Optional) Index a FAQ document under **Documentos**
7. (Optional) Create services catalog under **Servicios**
8. (Optional) Create a `user` profile under **Usuarios**, assign their client_id and allowed_pages, share the credentials

---

## License

Private — internal use only.
