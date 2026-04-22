# Cleverum — System Architecture

> Current as of: F3 complete (WhatsApp Cloud API backend rewritten)

---

## System overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         OPERATOR BROWSER                            │
│                    (single admin user, no public)                   │
└──────────────────────────────┬──────────────────────────────────────┘
                               │ HTTPS
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    FRONTEND — Cloudflare Pages                      │
│              Vite + React SPA  (frontend/src/)                      │
│                                                                     │
│  /clientes    /productos   /pedidos    /leads                       │
│  /conversaciones  /reminders  /documentos                           │
└──────────────────┬──────────────────────────────────────────────────┘
                   │ Supabase JS SDK (anon key + RLS)
                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         SUPABASE                                    │
│                                                                     │
│  PostgreSQL DB   │  Auth (email/pass)  │  Storage (products, docs)  │
│  Realtime        │  pgvector (RAG)     │  Row Level Security        │
└────────┬─────────────────────────────────────────┬──────────────────┘
         │ service role (bypasses RLS)             │ anon key (RLS)
         ▼                                         ▼
┌─────────────────────────┐            ┌──────────────────────────────┐
│  CHATBOT — Railway      │            │   FRONTEND reads/writes      │
│  Express webhook handler│            │   all tables via RLS policy  │
│  (chatbot/src/)         │            └──────────────────────────────┘
│                         │
│  POST /webhook ←── Meta │◄────── WhatsApp users (multiple clients)
│  GET  /webhook (verify) │
│  /bots/* (management)   │
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
| bot_type | text | `informativo` \| `catalogo` \| `leads` |
| use_ai | boolean | Legacy flag, kept for compatibility |
| facebook_link | text | |
| instagram_link | text | |
| image_url | text | Supabase Storage URL |
| google_calendar_key_url | text | URL to service account JSON in Supabase Storage |
| google_calendar_id | text | Calendar ID |
| **wa_phone_number_id** | text | Meta phone number ID — used to route incoming webhooks |
| **wa_access_token** | text | Meta access token for this client |
| **bot_active** | boolean | Global on/off switch for the bot |
| is_active | boolean | Soft delete for the client account |
| created_at / updated_at | timestamptz | |

### `products`
Product catalog for `catalogo` bots.

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| client_id | uuid FK → clients | |
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
| customer_phone | text | WhatsApp phone (from) |
| items | jsonb | `[{name, category}]` |
| delivery_type | text | `delivery` \| `pickup` |
| address | text | Only for delivery |
| payment_method | text | |
| client_payment | numeric | Amount customer will pay with |
| total | numeric | |
| status | boolean | false = pending, true = completed |
| planned_date | timestamptz | |
| created_at | timestamptz | |

### `leads`
Leads captured by `leads` bot.

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| client_id | uuid FK | |
| customer_name | text | |
| customer_phone | text | |
| company | text | |
| need | text | Main problem/need |
| budget_range | text | |
| timeline | text | |
| status | text | `new` \| `contacted` \| `qualified` \| `lost` \| `won` |
| notes | text | Operator notes |
| raw_conversation | jsonb | Full history at time of capture |
| created_at | timestamptz | |

### `conversation_sessions`
State machine for each active WhatsApp conversation. Replaces BuilderBot MemoryDB.

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| client_id | uuid FK | |
| phone_number | text | WhatsApp `from` field |
| current_flow | text | `appointment` \| `catalog` \| `leads_qualification` \| null |
| flow_step | text | Step within current flow |
| state | jsonb | Arbitrary flow state (cart, pending product, etc.) |
| history | jsonb | Last 10 messages `[{role, content}]` — context for AI |
| bot_disabled_for_user | boolean | `botoff` command per user |
| human_takeover | boolean | Agent manually responding |
| assigned_agent_id | uuid | Future: which agent took over |
| last_message_at | timestamptz | |
| UNIQUE | (client_id, phone_number) | One session per user per client |

### `reminders`
Scheduled WhatsApp messages.

| Column | Type | Notes |
|---|---|---|
| client_id | uuid FK | |
| message | text | |
| phone_numbers | text[] | Recipients (empty = all active contacts) |
| frequency | text | `daily` \| `weekly` \| `monthly` |
| hour | int | 8–21 |
| minute | int | 0 or 30 |
| active | boolean | |
| last_sent | timestamptz | Updated after each send |

### `documents` + `document_chunks`
RAG knowledge base. Used by `informativo` and `leads` bots.

```
documents
  id, client_id, title, content (full text), metadata, created_at

document_chunks
  id, document_id, client_id, content (chunk text), embedding vector(1536), created_at
  INDEX: HNSW on embedding using vector_cosine_ops
```

### `bot_configs`
Per-client bot configuration (welcome message, system prompt, etc.).

### `match_chunks()` SQL function
```sql
match_chunks(query_embedding, client_id_filter, match_threshold, match_count)
→ table(id, content, similarity)
```
Used by RAG retrieval. Finds most similar chunks via cosine similarity.

---

## Frontend routes

| Route | Page | Description |
|---|---|---|
| `/login` | Login.tsx | Supabase auth, only public route |
| `/clientes` | Clientes.tsx | Full CRUD for client accounts |
| `/productos` | Productos.tsx | Product catalog per client, image upload |
| `/pedidos` | Pedidos.tsx | Orders table + detail modal, Realtime |
| `/leads` | Leads.tsx | CRM table + status management, Realtime |
| `/conversaciones` | Conversaciones.tsx | Live sessions, chat history, takeover |
| `/reminders` | Reminders.tsx | Scheduled messages CRUD |
| `/documentos` | Documentos.tsx | RAG document management |

All routes under `/` are protected by `AuthGuard` which redirects to `/login` if no
Supabase session exists.

**State management:** `AppContext` (React Context) holds:
- `session` — Supabase auth session
- `selectedClient` — client currently in focus (for Realtime subscriptions)
- `notifications` — unread count (new orders + leads)

---

## Backend API endpoints

Base: `http://localhost:4000` (dev) / Railway URL (prod)

| Method | Path | Description |
|---|---|---|
| GET | `/webhook` | Meta webhook verification (hub.verify_token check) |
| POST | `/webhook` | Incoming WhatsApp messages — routed by phone_number_id |
| GET | `/health` | Health check for Railway |
| PUT | `/bots/:clientId/toggle` | Toggle bot_active on/off |
| GET | `/bots/status` | All bots status from DB |
| POST | `/bots/:clientId/takeover` | Set human_takeover flag on a session |
| PUT | `/bots/:clientId/credentials` | Update wa_phone_number_id + wa_access_token |

---

## Bot flow state machines

### Bot 1 — Informativo (infoBot.ts)

```
Message arrives
       ↓
current_flow === 'appointment'? → continueAppointmentFlow()
       ↓ no
determineIntent()
       ↓
   agendar_cita → startAppointmentFlow()
                    flow_step: 'collecting'
                    AI collects name/phone/service/date (conversational)
                    when AI returns CITA_CONFIRMADA token → finishAppointment()
                      → checkAvailability() → createEvent() → confirm msg
   consultar_empresa → createChat() with talker prompt + RAG context (F4)
   hablar → createChat() with talker prompt (general conversation)
```

### Bot 2 — Catálogo (catalogBot.ts)

```
flow_step = null/idle → showCategoryMenu() [List Message]
flow_step = category_selected → handleCategorySelection()
  text starts with 'cat:X' → fetch products → [List Message]
flow_step = product_selected → handleProductAction()
  text = 'add_to_cart' → push to cart → buttons
  text = 'checkout' → startCheckout()
  text = 'view_more' → back to category
  text starts with 'prod:X' → fetch product → image + buttons
flow_step = checkout → handleDeliveryType()
  'delivery' → ask address → flow_step = 'address'
  'pickup' → showOrderSummary() → flow_step = 'confirming'
flow_step = address → AI extracts address → showOrderSummary()
flow_step = confirming → handleConfirmation()
  'confirm_order' → INSERT orders → success msg → reset flow
  'cancel_order' → cancel msg → reset flow
```

### Bot 3 — Leads (leadsBot.ts)

```
flow_step = 'captured' → already captured, polite redirect

history.length >= 6 → isLeadReady()
  ready = true → captureLead()
    determineLead() → INSERT leads → closing msg → flow_step = 'captured'
  ready = false → continue conversation

continue → AI conversation with SYSTEM_PROMPT
  (RAG context injected here in F4)
  flow_step = 'qualifying'
```

---

## WhatsApp Cloud API integration

**Credential model:** Each client has its own `wa_phone_number_id` and `wa_access_token`
stored in the `clients` table. The webhook handler routes incoming messages by matching
the `phone_number_id` from webhook metadata to the clients table.

**Message routing:** `GET /webhook` + `POST /webhook` → one endpoint handles all clients.

**Client cache:** `getCachedClient(phoneNumberId)` caches client rows for 5 minutes
to avoid hitting Supabase on every message. Cache is invalidated when credentials are
updated via the management API.

**Supported message types sent:**
- `sendText()` — plain text
- `sendList()` — scrollable list (up to 10 items per section)
- `sendButtons()` — reply buttons (up to 3)
- `sendImage()` — image with caption

**Supported message types received:**
- `text` — plain user message
- `interactive/button_reply` — button tap (id used as routing token)
- `interactive/list_reply` — list selection (id used as routing token)

---

## Supabase Realtime subscriptions

**Frontend (AppContext.tsx):** When a `selectedClient` is set, two channels are created:
- `postgres_changes` INSERT on `orders` filtered by `client_id` → increments notifications
- `postgres_changes` INSERT on `leads` filtered by `client_id` → increments notifications

**Frontend (Conversaciones.tsx):** All changes (`*`) on `conversation_sessions` filtered
by `client_id` → refreshes session list in real time.

**Frontend (Pedidos.tsx):** INSERT and UPDATE on `orders` filtered by `client_id` →
auto-refreshes orders table.

**Frontend (Leads.tsx):** INSERT on `leads` filtered by `client_id` → auto-refreshes.

**Chatbot backend:** Does NOT use Supabase Realtime. It writes to Supabase via service
role client, which triggers Realtime events automatically for the frontend.

---

## Supabase Storage buckets

| Bucket | Visibility | Used for |
|---|---|---|
| `products` | Public | Product images (uploaded via admin panel) |
| `documents` | Private | RAG source documents (PDFs, text files) |

Calendar service account JSON keys are stored at a URL in `clients.google_calendar_key_url`
and downloaded at runtime by `GoogleCalendarService.downloadKeyFile()`.

---

## RAG architecture (F4 — pending)

```
Admin uploads document → stored in `documents` table
                       ↓
POST /documents/:clientId/index (chatbot backend)
  → split into ~400-token chunks with 50-token overlap
  → for each chunk: openai.embeddings.create(text-embedding-3-small)
  → INSERT into document_chunks (content, embedding)
                       ↓
Bot receives message
  → embed(userMessage) → query_embedding
  → supabase.rpc('match_chunks', { query_embedding, client_id_filter })
  → returns top 4 chunks above 0.75 similarity threshold
  → inject into system prompt as context
  → call OpenAI with grounded context
```

---

## Deployment targets

| Service | Platform | Build command | Notes |
|---|---|---|---|
| Frontend | Cloudflare Pages | `npm run build:frontend` | Output: `frontend/dist/` |
| Chatbot | Railway | `npm start` (in chatbot/) | Start: `node dist/index.js` |
| Database | Supabase | Managed | No self-hosted infra |

**Zero Docker.** All infrastructure is managed cloud services.

---

## Known dead code / cleanup needed

- `chatbot/Dockerfile` — kept for reference but no longer used (deploy via Railway buildpack)
- `REFACTOR.md` — original plan, superseded by `docs/devplan.md` for remaining work
- `docs/architecture.md` (this file) — should be updated after F4 and F5 complete
