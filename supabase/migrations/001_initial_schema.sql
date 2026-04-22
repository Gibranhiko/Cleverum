-- ═══════════════════════════════════════════════════════════
-- CLEVERUM — Initial Schema
-- ═══════════════════════════════════════════════════════════

-- ─── CLIENTES ────────────────────────────────────────────────
create table clients (
  id uuid primary key default gen_random_uuid(),
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
create table conversation_sessions (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references clients(id) on delete cascade,
  phone_number text not null,
  current_flow text,
  flow_step text,
  state jsonb default '{}',
  history jsonb default '[]',
  bot_disabled_for_user boolean default false,
  human_takeover boolean default false,
  assigned_agent_id uuid,
  last_message_at timestamptz default now(),
  created_at timestamptz default now(),
  unique(client_id, phone_number)
);

-- ─── BOT CONFIG ──────────────────────────────────────────────
create table bot_configs (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references clients(id) on delete cascade unique,
  welcome_message text,
  system_prompt text,
  intents_enabled text[] default '{}',
  qualification_questions jsonb default '[]',
  closing_message text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
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
  embedding vector(1536),
  created_at timestamptz default now()
);

-- ─── ÍNDICES ─────────────────────────────────────────────────
create index on products(client_id);
create index on orders(client_id);
create index on orders(created_at desc);
create index on leads(client_id);
create index on leads(status);
create index on reminders(client_id, active);
create index on conversation_sessions(client_id, phone_number);
create index on document_chunks(client_id);
create index on document_chunks using hnsw (embedding vector_cosine_ops);

-- ─── RAG: FUNCIÓN DE BÚSQUEDA SEMÁNTICA ──────────────────────
create or replace function match_chunks(
  query_embedding vector(1536),
  client_id_filter uuid,
  match_threshold float default 0.75,
  match_count int default 4
)
returns table (id uuid, content text, similarity float)
language sql stable as $$
  select
    dc.id,
    dc.content,
    1 - (dc.embedding <=> query_embedding) as similarity
  from document_chunks dc
  where dc.client_id = client_id_filter
    and 1 - (dc.embedding <=> query_embedding) > match_threshold
  order by similarity desc
  limit match_count;
$$;

-- ─── REALTIME ────────────────────────────────────────────────
-- Habilitar realtime para estas tablas desde el Dashboard:
-- Database → Replication → Supabase Realtime → orders, leads, conversation_sessions
