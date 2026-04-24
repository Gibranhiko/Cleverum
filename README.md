# Cleverum

Internal operator panel for managing WhatsApp chatbots for multiple business clients. Not a SaaS — single admin user, no public signup.

---

## What it does

Cleverum lets one operator configure and manage AI-powered WhatsApp bots for different business clients. Each client gets their own WhatsApp number and one of three bot types:

- **informativo** — answers questions about the business using a RAG knowledge base + books appointments via Google Calendar
- **catalogo** — product catalog via WhatsApp native UI (List Messages + Buttons), handles orders end-to-end
- **leads** — conversational AI that qualifies prospects and saves them to a CRM

The admin panel provides real-time visibility into orders, leads, active conversations, and lets agents take over any conversation from the bot.

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | Vite + React 18 + TypeScript + TailwindCSS v4 + shadcn/ui |
| Backend | Express + TypeScript |
| Database | Supabase (PostgreSQL + pgvector + Auth + Storage + Realtime) |
| AI | OpenAI gpt-4o (chat, intent, tools API) + text-embedding-3-small (RAG embeddings) |
| Messaging | WhatsApp Cloud API (Meta official) |
| Calendar | Google Calendar API (per-client service account) |
| Deploy | Railway (frontend + chatbot) |

No Docker. No WebSockets. No MongoDB.

---

## Monorepo structure

```
Cleverum/
├── frontend/        ← Vite + React SPA (admin panel)
│   └── src/
│       ├── pages/   ← Clientes, Productos, Pedidos, Leads, Conversaciones, Reminders, Documentos
│       ├── components/
│       └── lib/     ← Supabase client, helpers
├── chatbot/         ← Express webhook handler (WhatsApp Cloud API)
│   └── src/
│       ├── flows/   ← infoBot.ts, catalogBot.ts, leadsBot.ts
│       ├── services/  ← ai.ts, rag.ts, reminder.ts, googleCalendar.ts
│       ├── webhook/   ← handler.ts, verify.ts
│       ├── routes/    ← bots.ts, documents.ts
│       ├── lib/       ← supabase.ts, whatsapp.ts, session.ts
│       └── prompts/   ← .txt prompt files (copied to dist at build)
├── supabase/
│   └── migrations/  ← 001_initial_schema.sql
├── docs/
│   ├── architecture.md
│   ├── devplan.md
│   └── techdebt-whatsapp.md
├── CLAUDE.md        ← AI coding assistant briefing
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
ANTHROPIC_API_KEY=
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

WhatsApp credentials (`wa_phone_number_id`, `wa_access_token`) are stored **per client** in the `clients` table — not as env vars. This allows one backend to serve multiple WhatsApp numbers.

---

## Architecture overview

```
Operator browser
      │ HTTPS
      ▼
Frontend — Railway
  Vite SPA (frontend/src/)
  /clientes /productos /pedidos /leads /conversaciones /reminders /documentos
      │
      │ Supabase JS SDK (anon key + RLS)
      ▼
Supabase
  PostgreSQL │ Auth │ Storage (products, documents) │ Realtime │ pgvector
      ▲
      │ service role (bypasses RLS)
      │
Chatbot — Railway
  Express webhook handler (chatbot/src/)
  POST /webhook  ← WhatsApp Cloud API (Meta)
  GET  /webhook  (Meta verification)
  /bots/*        (management API, requires x-api-key)
  /documents/*   (RAG indexing, requires x-api-key)
      │
      ├── OpenAI (gpt-4o + text-embedding-3-small)
      └── Google Calendar API
```

---

## How incoming messages are routed

1. Meta sends `POST /webhook` with a `phone_number_id` in the payload
2. Handler looks up the client in `clients` table by `wa_phone_number_id` (5-min cache)
3. Checks `client.bot_active` and the session's `human_takeover` / `bot_disabled_for_user` flags
4. Routes to `infoBot`, `catalogBot`, or `leadsBot` based on `client.bot_type`

---

## Bot API endpoints

All `/bots/*` and `/documents/*` routes require header: `x-api-key: <ADMIN_API_KEY>`

| Method | Path | Description |
|---|---|---|
| GET | `/health` | Health check |
| GET | `/webhook` | Meta webhook verification |
| POST | `/webhook` | Incoming WhatsApp messages |
| GET | `/bots/status` | All clients + bot status |
| PUT | `/bots/:clientId/toggle` | Toggle bot on/off |
| POST | `/bots/:clientId/takeover` | Enable/disable human takeover for a session |
| POST | `/bots/:clientId/send` | Send message as agent (requires active 24h window) |
| PUT | `/bots/:clientId/credentials` | Update WhatsApp credentials |
| POST | `/documents/:clientId/index` | Index a document into pgvector (RAG) |

---

## Deployment

Both services run on Railway, deployed from the same GitHub repo.

| Service | Root dir | Build | Start |
|---|---|---|---|
| chatbot | `chatbot/` | `npm run build` (`tsc` + copy prompts) | `node dist/index.js` |
| frontend | repo root | `npm run build --workspace=frontend` | `npx serve frontend/dist -l $PORT` |

Each service has a `railway.json` at its root defining the build and start commands.

### Required Railway env vars

**Chatbot service:**
```
SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, OPENAI_API_KEY, ANTHROPIC_API_KEY,
WHATSAPP_WEBHOOK_SECRET, ADMIN_API_KEY, CORS_ORIGIN
```

**Frontend service:**
```
VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_CHATBOT_URL, VITE_ADMIN_API_KEY
```

### WhatsApp webhook setup (Meta)

1. Deploy chatbot to Railway — get the public URL
2. Meta Developer Console → your app → WhatsApp → Configuration
3. Set callback URL: `https://<chatbot-url>/webhook`
4. Set verify token: value of `WHATSAPP_WEBHOOK_SECRET`
5. Subscribe to the `messages` field
6. Add your phone number as a test recipient

---

## Database

Managed by Supabase. Migration at `supabase/migrations/001_initial_schema.sql`.

Key tables: `clients`, `products`, `orders`, `leads`, `conversation_sessions`, `reminders`, `documents`, `document_chunks`, `bot_configs`

RLS is enabled on all tables. The frontend uses the anon key (RLS enforced). The chatbot uses the service role key (bypasses RLS — intentional, bots need to write without auth context).

---

## License

Private — internal use only.
