# Cleverum — Development Plan (Remaining Work)

> Phases F1, F2, F3 are complete. This document covers F4, F5, and F6.
> See `docs/architecture.md` for the full system context.

---

## Status summary

| Phase | Tickets | Status |
|---|---|---|
| F1 — Supabase Foundation | F1-01 → F1-06 | ✅ Complete |
| F2 — Frontend (Vite) | F2-01 → F2-06 | ✅ Complete |
| F3 — WhatsApp Cloud API | F3-01 → F3-10 | ✅ Complete |
| F4 — RAG Integration | F4-01 → F4-04 | ⏳ Pending |
| F5 — Admin Panel v2 | F5-01 → F5-05 | ⏳ Pending |
| F6 — Cleanup & Deploy | F6-01 → F6-04 | ⏳ Pending |

---

## FASE 4 — RAG Integration

> The pgvector infrastructure is already in place (table `document_chunks`,
> HNSW index, `match_chunks()` function). F4 connects the pipeline.

---

### [F4-01] Embedding ingestion pipeline

**What:** Backend endpoint that takes a document's text content, splits it into
overlapping chunks, generates embeddings via OpenAI, and stores them in `document_chunks`.

**Files to create:**
- `chatbot/src/services/rag.ts` — embed(), retrieve(), indexDocument(), splitIntoChunks()
- `chatbot/src/routes/documents.ts` — POST /documents/:clientId/index

**Tasks:**
- [ ] `splitIntoChunks(text, size=400, overlap=50)` — split by approximate token count
      (use word count * 1.3 as token estimate; exact tokenization not needed here)
- [ ] `embed(text)` — call `openai.embeddings.create({ model: 'text-embedding-3-small' })`
- [ ] `indexDocument(documentId, content, clientId)`:
      1. Delete existing chunks for this document (re-index support)
      2. Split content into chunks
      3. Embed each chunk (sequential, not parallel — avoid rate limits)
      4. Batch INSERT into `document_chunks`
- [ ] `retrieve(query, clientId, threshold=0.75, count=4)`:
      1. Embed the query
      2. Call `supabase.rpc('match_chunks', { query_embedding, client_id_filter, match_threshold, match_count })`
      3. Return array of chunk content strings
- [ ] `POST /documents/:clientId/index` — reads document from `documents` table by ID,
      calls `indexDocument()`, returns `{ chunks_created: N }`
- [ ] Register route in `chatbot/src/index.ts`
- [ ] Add `documentId` param support so frontend can trigger indexing after upload

**Acceptance criteria:**
- Upload a text document via the admin panel, call the endpoint, verify `document_chunks`
  rows appear in Supabase with non-null `embedding` values
- Call `retrieve('precio del servicio', clientId)` and get relevant chunks back
- Re-indexing the same document deletes old chunks and creates new ones

**Dependencies:** F3-02 (Express server already running)

---

### [F4-02] RAG in Bot 1 (Informativo)

**What:** Connect retrieval to `handleInfoBot` so it answers questions about the
business using actual document content instead of just what's in the system prompt.

**File to modify:** `chatbot/src/flows/infoBot.ts`

**Tasks:**
- [ ] In the `consultar_empresa` intent branch, call `retrieve(text, clientId)` before
      calling `ai.createChat()`
- [ ] Build context string from retrieved chunks:
      ```ts
      const chunks = await retrieve(text, clientId)
      const ragContext = chunks.length > 0
        ? `Información real de la empresa:\n\n${chunks.join('\n\n')}`
        : ''
      ```
- [ ] Inject `ragContext` into the talker system prompt (replace `{RAG_CONTEXT}` placeholder)
      — add this placeholder to `prompt-talker.txt` if not already there
- [ ] Graceful fallback: if `retrieve()` returns empty array, bot still responds using
      the base system prompt (does not fail or return empty response)
- [ ] Same pattern for the `hablar` intent if the message seems to be about the business

**Acceptance criteria:**
- Client has a document with their service prices indexed
- User asks "¿cuánto cuesta el servicio X?" via WhatsApp
- Bot responds with the actual price from the document, not a hallucinated one
- If no documents are indexed for this client, bot still responds normally

**Dependencies:** F4-01

---

### [F4-03] RAG in Bot 3 (Leads)

**What:** When a user in the `leads` bot asks about services or pricing, retrieve
relevant chunks and inject them as context before the AI response.

**File to modify:** `chatbot/src/flows/leadsBot.ts`

**Tasks:**
- [ ] Add RAG context to `SYSTEM_PROMPT` (replace `{RAG_CONTEXT}` placeholder that
      already exists in the template)
- [ ] Before each AI call in `handleLeadsBot()`, call `retrieve(text, clientId)`
- [ ] Only inject RAG context if chunks are returned (no empty context blocks)
- [ ] The `captureLead()` function should include the full history — the lead extraction
      AI already has access to the conversation context, no RAG needed there

**Acceptance criteria:**
- Client has service description documents indexed
- User asks "¿qué incluye el paquete premium?" during lead qualification
- Bot answers with actual package details from documents
- Lead capture still works correctly after RAG is added

**Dependencies:** F4-01

---

### [F4-04] Document management UI (admin panel)

**What:** The `Documentos.tsx` page already exists with create/delete/preview.
Connect it to the indexing backend so documents get embedded automatically.

**File to modify:** `frontend/src/pages/Documentos.tsx`

**Tasks:**
- [ ] After saving a document (INSERT into `documents`), call the indexing endpoint:
      `POST {CHATBOT_URL}/documents/{clientId}/index?documentId={id}`
- [ ] Add `VITE_CHATBOT_URL` to `frontend/.env` (points to Railway URL in prod,
      `http://localhost:4000` in dev)
- [ ] Show indexing state: "Indexando..." spinner while POST is in flight
- [ ] On success, refresh the document list (chunk count should now show > 0)
- [ ] On error, show error message but keep the document (it was saved to DB)
- [ ] Add "Re-indexar" button on each document row — calls the same endpoint
- [ ] Disable "Nuevo documento" button while a previous indexing is in flight

**Acceptance criteria:**
- Admin creates a document → it appears in the list → chunk count shows after indexing
- "Re-indexar" button replaces old chunks with new ones
- Error during indexing does not delete the document

**Dependencies:** F4-01, F2-04 (Documentos.tsx already exists)

---

## FASE 5 — Admin Panel v2

---

### [F5-01] Bot dashboard

**What:** A central status page showing all bots at a glance.

**File to create:** `frontend/src/pages/Dashboard.tsx`

**Tasks:**
- [ ] Add route `/dashboard` in `App.tsx`
- [ ] Add "Dashboard" link in `Navbar.tsx`
- [ ] Card per client showing:
  - Company name + bot type badge
  - Bot active/inactive toggle (calls `PUT /bots/:clientId/toggle`)
  - WhatsApp number
  - Last message received (`conversation_sessions.last_message_at`)
  - Active conversations today (count from `conversation_sessions` where `last_message_at > today`)
  - Orders today (Bot 2) / Leads this week (Bot 3)
- [ ] Realtime: subscribe to `clients` table changes to update toggle state live
- [ ] Visual alert if a bot hasn't received messages in > 24h
- [ ] Make `/` redirect to `/dashboard` instead of `/clientes`

**Acceptance criteria:**
- Dashboard loads with cards for all active clients
- Toggling a bot's active state updates the DB and reflects immediately
- Last message time is visible and accurate

**Dependencies:** F3-09 (bots route already done)

---

### [F5-02] Conversaciones (already built, needs enhancement)

**Status:** Page exists and shows sessions, history, takeover toggle.

**Remaining tasks:**
- [ ] Connect the manual reply to the chatbot backend: `POST /bots/:clientId/send`
      endpoint that calls `sendText()` — add this route to `chatbot/src/routes/bots.ts`
- [ ] The Conversaciones page `handleSendReply()` should call this endpoint instead of
      only updating the DB history
- [ ] Show the full raw `session.state` JSON in a collapsible panel (useful for debugging
      cart state or lead qualification data)
- [ ] Filter sessions: show only sessions with activity in the last 7 days by default,
      with a toggle for "all sessions"

**Acceptance criteria:**
- Manual reply from the admin panel actually sends a WhatsApp message to the user
- Agent can see cart contents or lead data for the current conversation

**Dependencies:** F3-02

---

### [F5-03] Leads page (already built, needs CSV export)

**Status:** Full CRM table with status management is complete.

**Remaining tasks:**
- [ ] "Exportar CSV" button that generates and downloads a CSV of the current filtered
      leads list (client-side generation using the data already in state)
- [ ] Show raw conversation history in the detail dialog (currently only notes are shown)

**Acceptance criteria:**
- CSV export includes: name, company, phone, need, budget, timeline, status, date
- Conversation history is readable in the detail modal

**Dependencies:** None (page already exists)

---

### [F5-04] Bot config editor

**What:** Per-client configuration for welcome message, system prompt, and bot behavior,
editable from the admin panel without code changes.

**Files to create:**
- `frontend/src/pages/ConfigBot.tsx`

**Tasks:**
- [ ] Add route `/config` in `App.tsx` and link in `Navbar.tsx`
- [ ] Client selector at top
- [ ] Form fields reading from `bot_configs` table (already in schema):
  - Welcome message (textarea)
  - System prompt (textarea with character count)
  - For `informativo`: intents enabled (checkboxes)
  - For `leads`: qualification questions (list editor — add/remove/reorder)
  - Closing message
- [ ] On save: upsert into `bot_configs` using `onConflict: 'client_id'`
- [ ] In `chatbot/src/webhook/handler.ts`: after loading the client, also fetch
      `bot_configs` for that client (with same 5-min cache) and make it available
      to the flow handlers
- [ ] In `infoBot.ts` and `leadsBot.ts`: use `bot_configs.system_prompt` as the base
      prompt instead of the hardcoded file prompts (fall back to file if not set)

**Acceptance criteria:**
- Admin changes welcome message → next WhatsApp user gets the new welcome message
- System prompt is respected by the AI response
- Bot config survives server restart (it's in DB, not memory)

**Dependencies:** F3-05, F3-07

---

### [F5-05] Analytics view

**What:** Basic usage metrics per client/bot.

**Tasks:**
- [ ] Run this SQL in Supabase Dashboard → SQL Editor:
      ```sql
      create or replace view bot_analytics as
      select
        c.id as client_id,
        c.company_name,
        c.bot_type,
        count(distinct cs.phone_number) as unique_users,
        count(distinct o.id) as total_orders,
        count(distinct l.id) as total_leads,
        count(distinct o.id) filter (
          where o.created_at > now() - interval '7 days'
        ) as orders_last_7d,
        count(distinct l.id) filter (
          where l.created_at > now() - interval '7 days'
        ) as leads_last_7d,
        max(cs.last_message_at) as last_activity
      from clients c
      left join conversation_sessions cs on cs.client_id = c.id
      left join orders o on o.client_id = c.id
      left join leads l on l.client_id = c.id
      where c.is_active = true
      group by c.id, c.company_name, c.bot_type;
      ```
- [ ] Add analytics cards to `Dashboard.tsx` reading from this view via:
      `supabase.from('bot_analytics').select('*')`
- [ ] Show: unique users, orders/leads this week, last activity timestamp

**Acceptance criteria:**
- Dashboard shows correct counts (verify against raw table data)
- View returns results when queried directly in Supabase SQL Editor

**Dependencies:** F5-01

---

## FASE 6 — Cleanup & Deploy

---

### [F6-01] Pre-deploy cleanup

**What:** Remove stale files and ensure the codebase has no dead code.

**Tasks:**
- [ ] Delete `chatbot/Dockerfile` — Railway uses its own buildpack, no Dockerfile needed
- [ ] Delete `docker-compose.yml` — currently just a comment block, can go entirely
- [ ] Delete `.dockerignore` — no Docker, no need
- [ ] Verify `chatbot/src/prompts/` — remove unused prompts:
  - `prompt-determine-order.txt` — replaced by `determineLead()` tool call
  - `prompt-order.txt` — replaced by catalogBot state machine
  - `prompt-products.txt` — products come from DB, not prompts
  - `prompt-seller.txt` — replaced by leadsBot AI flow
  - Keep: `prompt-discriminator.txt`, `prompt-talker.txt`, `prompt-appointment.txt`
- [ ] Add `chatbot/.env.example` with all required vars and descriptions
- [ ] Add `frontend/.env.example`
- [ ] Verify no `console.log` debug statements left in production paths
- [ ] Run `npx tsc --noEmit` in both workspaces — must be clean

**Acceptance criteria:**
- Root directory has no Docker files
- Both workspaces compile with no TypeScript errors
- `.env.example` files document all required variables

**Dependencies:** F4, F5 complete

---

### [F6-02] Deploy frontend to Cloudflare Pages

**Tasks:**
- [ ] Push code to GitHub (or connect existing repo)
- [ ] Create project in Cloudflare Pages → connect repository
- [ ] Build settings:
  - Framework preset: None (Vite)
  - Build command: `npm run build:frontend`
  - Build output directory: `frontend/dist`
  - Root directory: `/` (monorepo root)
- [ ] Add environment variables in Cloudflare dashboard:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`
  - `VITE_CHATBOT_URL` (Railway URL from F6-03)
- [ ] Configure custom domain if needed
- [ ] Verify: login works, all pages load, Realtime notifications work

**Acceptance criteria:**
- Frontend accessible at Cloudflare Pages URL
- Login authenticates against Supabase
- Creating a client saves to Supabase and appears in the list

**Dependencies:** F6-01

---

### [F6-03] Deploy chatbot to Railway

**Tasks:**
- [ ] Create project in Railway → connect repository
- [ ] Set root directory to `chatbot/` in Railway settings
- [ ] Set start command: `npm start` (runs `node dist/index.js`)
- [ ] Set build command: `npm run build` (runs `tsc`)
- [ ] Add environment variables in Railway dashboard:
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `OPENAI_API_KEY`
  - `OPENAI_MODEL=gpt-4o`
  - `WHATSAPP_WEBHOOK_SECRET`
  - `PORT=4000`
- [ ] Get the Railway deployment URL (e.g., `https://cleverum-chatbot.railway.app`)
- [ ] Register webhook URL in Meta Business Manager:
  - URL: `https://cleverum-chatbot.railway.app/webhook`
  - Verify token: value of `WHATSAPP_WEBHOOK_SECRET`
- [ ] Verify: `GET /health` returns `{ status: 'ok' }`
- [ ] Send a test WhatsApp message and verify it routes to the correct bot

**Acceptance criteria:**
- `/health` endpoint returns 200
- Meta webhook verification succeeds (green checkmark in Meta dashboard)
- Test message from WhatsApp receives a bot response

**Dependencies:** F6-01, F6-02 (for VITE_CHATBOT_URL)

---

### [F6-04] Post-deploy smoke test

**Tasks:**
- [ ] **Bot 1 (informativo):** Send "hola" → verify welcome response. Ask a business
      question → verify RAG response uses document content. Say "quiero agendar una cita"
      → complete full appointment flow → verify event appears in Google Calendar.
- [ ] **Bot 2 (catalogo):** Send "hola" → verify category list appears. Select category
      → select product → add to cart → checkout → pick delivery → confirm → verify order
      appears in Pedidos page with Realtime notification.
- [ ] **Bot 3 (leads):** Send "hola" → complete qualification conversation → verify lead
      appears in Leads page with status "new" and Realtime notification.
- [ ] **Admin panel:** Create client → add products → upload document → index → send
      question to bot → verify RAG uses document.
- [ ] **Reminders:** Create a reminder for 1 minute from now → verify WhatsApp message
      is received → verify `last_sent` updated in DB.
- [ ] **Takeover:** From Conversaciones page, click "Tomar conversación" → send manual
      reply → verify user receives the message.

**Acceptance criteria:**
- All three bot types complete their full happy path without errors
- Realtime notifications appear in the admin panel for new orders and leads
- No TypeScript compilation errors, no 500 errors in Railway logs

**Dependencies:** F6-03

---

## Decision log

| Decision | Chosen approach | Rejected | Reason |
|---|---|---|---|
| WhatsApp SDK | Official Cloud API (HTTP) | Baileys (unofficial) | TOS compliance, production reliability |
| Session storage | Supabase DB + memory cache | BuilderBot MemoryDB | Persistence across restarts, visible in admin |
| AI function calls | tools API | functions API | functions is deprecated in OpenAI SDK |
| Bot credential storage | Per-client in DB | Global env vars | One backend serves multiple clients |
| Message routing | Match by phone_number_id | One process per client | Single Railway instance, simpler ops |
| Auth | Supabase Auth | Custom JWT | Less code, better security, integrates with RLS |
| Realtime | Supabase Realtime | Socket.io | No extra server, integrates with DB inserts |
| Build | tsc (CommonJS) | rollup + ESM | Simpler for Node.js, better package compat |
| RAG model | text-embedding-3-small | text-embedding-ada-002 | Better quality, same price |
| Dedup in RAG | Supabase match_chunks() | Client-side comparison | DB handles vector math efficiently |
