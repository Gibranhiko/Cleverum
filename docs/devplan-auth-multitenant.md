# Devplan — Auth multi-tenant (super admin + users con páginas configurables)

> ## ✅ COMPLETADO
> Los 10 tickets (E-01 → E-10) están implementados, deployed y validados con test de
> aislamiento (E-09) — un user de DTR confirmado solo puede ver su client_id y sus
> páginas asignadas.

> Refactor para pasar de single-admin a hybrid multi-tenant.
> Dos roles: `super_admin` (Cleverum, único) y `user` (cliente final atado a un `client_id`).
> Cada `user` tiene un array `allowed_pages` que define qué pestañas ve.
> Supabase Auth + RLS — sin sumar dependencias nuevas.

---

## 1. Goals & non-goals

### Goals
- `super_admin` (tú, único) ve y administra todos los clientes y todos los datos
- `user` ve solo los datos de su `client_id` y solo las pestañas listadas en su `allowed_pages`
- Súper_admin tiene UI para crear `user`s y asignar qué páginas ven
- Aislamiento estricto a nivel DB (RLS) — no depende del frontend para la seguridad
- Frontend respeta el rol y las páginas permitidas: nav esconde lo que no aplica, RouteGuard bloquea acceso por URL directa
- Sensitive fields (WA tokens, Google Calendar key) escondidos para `user`

### Non-goals (Fase 1)
- Public signup (sigue desactivado)
- Self-service "olvidé mi contraseña" / cambio de email — manual via Supabase dashboard
- Granularidad **dentro de una página** (ej: ve tickets pero no puede cambiar status). Si tiene acceso a la página, hace todo lo que la página permite
- Múltiples roles jerárquicos por cliente (ej: client_admin vs client_user). Solo hay 1 nivel: `user`
- SSO, MFA, audit logs (Fase 2)

---

## 2. Architectural decisions

### A1 — `user_profiles` table en lugar de `app_metadata`
Tabla dedicada con `id` (FK a `auth.users.id`), `role`, `client_id`, `allowed_pages`, `full_name`. Razones:
- Fácil de joinear y querer
- Constraints CHECK directos (super_admin no tiene client_id, user obligado a tener client_id)
- Más flexible si después agregamos campos (avatar, last_login, etc.)

### A2 — Helper functions con SECURITY DEFINER
Crear `public.current_user_role()` y `public.current_user_client_id()` que leen `user_profiles` por `auth.uid()`. SECURITY DEFINER permite que las RLS policies las llamen sin caer en recursión.

### A3 — RLS pattern uniforme (filtro por `client_id`)
Todas las tablas con `client_id` usan la misma policy:
```sql
create policy multi_tenant_access on <table>
  for all to authenticated
  using (
    public.current_user_role() = 'super_admin'
    or client_id = public.current_user_client_id()
  )
  with check (...mismo...);
```
La tabla `clients` es especial: super_admin ve todo, user solo su propio row (`id = current_user_client_id()`).

**Nota:** RLS solo controla acceso por **dato** (client_id), NO por página. Un `user` con acceso a la BD podría leer todos los datos de su cliente aunque su `allowed_pages` no incluya esa pestaña — porque la restricción de páginas es solo en frontend (UX). RLS asegura que NUNCA pueda ver datos de OTRO cliente.

### A4 — `allowed_pages` controla solo la UI
`user_profiles.allowed_pages text[]` lista las page keys (ej: `['conversaciones', 'tickets']`). Esto se usa **solo en el frontend**:
- Navbar: filtra items por allowed_pages
- RouteGuard: bloquea URL directa a página no permitida
- Super_admin ignora allowed_pages (ve todo)

Esto se asume "no security boundary" — si un `user` con cuenta tiene la malicia de armar queries crudos, podrá ver toda la data de SU cliente. La RLS protege contra ver data de OTROS clientes, eso sí es seguridad.

### A5 — Service role del chatbot NO cambia
El chatbot sigue usando `SUPABASE_SERVICE_ROLE_KEY` y bypasea RLS. La separación user/super_admin es solo en frontend / panel humano.

### A6 — UI de gestión de usuarios in-scope desde Fase 1
Como solo el super_admin puede crear users, y crearlos manual via SQL es operacionalmente feo, la UI de "Usuarios" está in-scope desde el inicio. Endpoint backend usa service role para llamar a `auth.admin.createUser()`.

### A7 — Hide sensitive fields en cliente
Aunque RLS permite que el `user` lea su row de `clients`, en frontend escondemos columnas sensibles cuando `role !== 'super_admin'`:
- `wa_access_token`
- `wa_phone_number_id`
- `google_calendar_key_url`

Razón: son tokens, no es buena UX que los vea en plain text. Si los necesita rotar, hay que pedírtelo.

---

## 3. Data model

### Page keys (catálogo)
Los strings válidos para `allowed_pages` están definidos en código (no en DB) como un enum. Listado actual:

```ts
export const PAGE_KEYS = [
  'dashboard',
  'clientes',          // solo super_admin (no asignable a user)
  'conversaciones',
  'documentos',
  'configbot',
  'recordatorios',
  'pedidos',
  'leads',
  'tickets',           // bot servicios
  'servicios',         // bot servicios — CRUD del catálogo
  'usuarios',          // solo super_admin (no asignable a user)
] as const
```

Páginas que **solo super_admin** puede ver (no aparecen en la UI de asignación de páginas para users):
- `clientes`
- `usuarios`
- (eventualmente: configbot si decidimos que solo super_admin la toca)

### `user_profiles` (nuevo)
```sql
create table user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('super_admin', 'user')),
  client_id uuid references clients(id) on delete cascade,
  allowed_pages text[] default '{}',
  full_name text,
  created_at timestamptz default now(),

  constraint user_has_client check (
    role = 'super_admin' or client_id is not null
  ),
  constraint super_admin_no_client check (
    role = 'user' or client_id is null
  )
);

create index idx_user_profiles_client on user_profiles(client_id);
```

### Helper functions
```sql
create or replace function public.current_user_role()
returns text
language sql stable security definer
set search_path = public, auth
as $$
  select role from user_profiles where id = auth.uid()
$$;

create or replace function public.current_user_client_id()
returns uuid
language sql stable security definer
set search_path = public, auth
as $$
  select client_id from user_profiles where id = auth.uid()
$$;
```

### RLS de `user_profiles`
```sql
alter table user_profiles enable row level security;

-- Cualquier usuario autenticado puede leer SU PROPIO profile
create policy self_read on user_profiles
  for select to authenticated using (id = auth.uid());

-- Solo super_admin escribe profiles
create policy super_admin_write on user_profiles
  for all to authenticated
  using (public.current_user_role() = 'super_admin')
  with check (public.current_user_role() = 'super_admin');
```

---

## 4. Cambios en RLS — tabla por tabla

| Tabla | Tiene `client_id` | Policy nueva |
|---|---|---|
| `clients` | NO (es la tabla raíz) | super_admin → todo. client_user → solo `id = current_user_client_id()` |
| `products` | sí | multi_tenant_access |
| `orders` | sí | multi_tenant_access |
| `leads` | sí | multi_tenant_access |
| `reminders` | sí | multi_tenant_access |
| `conversation_sessions` | sí | multi_tenant_access |
| `bot_configs` | sí | multi_tenant_access |
| `documents` | sí | multi_tenant_access |
| `document_chunks` | sí | multi_tenant_access |
| `services` | sí | multi_tenant_access |
| `tickets` | sí | multi_tenant_access |
| `user_profiles` | n/a | self_read + super_admin_write |

---

## 5. Cambios en Storage policies

### Buckets actuales
- `products` (público) — no cambia
- `documents` (privado)
- `calendar-keys` (privado)

### Buckets a agregar
- `tickets` (privado) — para fotos de equipos cuando entre la Fase 2 de servicios

### Pattern de path
Convención: el path siempre empieza con `{client_id}/...`. Por ejemplo:
- `documents/15c2a9b5.../doc1.pdf`
- `calendar-keys/15c2a9b5.../service-account.json`

### Policies
```sql
-- Privado: cliente solo accede a su carpeta, super_admin a todo
create policy multi_tenant_storage on storage.objects
  for all to authenticated
  using (
    bucket_id in ('documents', 'calendar-keys', 'tickets')
    and (
      public.current_user_role() = 'super_admin'
      or (storage.foldername(name))[1] = public.current_user_client_id()::text
    )
  )
  with check (
    bucket_id in ('documents', 'calendar-keys', 'tickets')
    and (
      public.current_user_role() = 'super_admin'
      or (storage.foldername(name))[1] = public.current_user_client_id()::text
    )
  );
```

(Verificar que las uploads existentes ya siguen este patrón — si no, **migrar paths antes de aplicar policy**.)

---

## 6. Tickets

### Epic E — Auth multi-tenant

#### E-01 — Migration `003_auth_multitenant.sql`

**Files:**
- `supabase/migrations/003_auth_multitenant.sql` (nuevo)

**Acceptance:**
- Tabla `user_profiles` creada con CHECK constraints
- Funciones `current_user_role()` y `current_user_client_id()` creadas con SECURITY DEFINER
- RLS habilitado en `user_profiles` con policies `self_read` y `super_admin_write`
- Migration **NO toca aún las RLS de las otras tablas** — eso va en E-03 (cutover separado para minimizar riesgo)
- SQL aplicado en Supabase prod

**Effort:** 0.5d

---

#### E-02 — Crear el super_admin (tú)

**Files:** N/A (operación SQL one-off)

**Acceptance:**
- Encontrar el `auth.users.id` correspondiente a tu email actual (`gibran.villarreal@accenture.com`)
- INSERT en `user_profiles`:
  ```sql
  insert into user_profiles (id, role, full_name)
  values ('<your_auth_uid>', 'super_admin', 'Gibran Villarreal');
  ```
- Verificar: `select public.current_user_role();` desde el SQL editor logueado como tú → debe retornar `'super_admin'`

**⚠️ CRITICAL:** Este ticket DEBE completarse **antes** de E-03. Si haces el cutover de RLS sin tener tu profile, te bloqueas a ti mismo.

**Effort:** 0.25d

---

#### E-03 — Cutover RLS multi-tenant (todas las tablas)

**Files:**
- `supabase/migrations/004_rls_multitenant_cutover.sql` (nuevo)

**Acceptance:**
- Para cada tabla del modelo (lista en sección 4): drop la policy `authenticated_full_access` y crear `multi_tenant_access` con la condicional super_admin OR client_id
- `clients` recibe policy especial: super_admin ve todo, client_user solo su row (`id = current_user_client_id()`)
- Aplicar en una sola transacción (BEGIN/COMMIT) para evitar estado intermedio
- Verificar después del apply: tú (super_admin) sigues viendo todos los clientes en el panel

**Riesgo alto.** Antes de ejecutar:
- Backup mental: tener un cliente Supabase con service role en mano por si hay que rollback
- Verificar paso a paso: aplicar la policy de `clients` PRIMERO, recargar el panel, confirmar que ves los clientes; después seguir con products, etc.

**Effort:** 1d (incluyendo testing post-cutover)

---

#### E-04 — Storage policies multi-tenant

**Files:**
- `supabase/migrations/005_storage_multitenant.sql` (nuevo)

**Acceptance:**
- Auditar paths actuales de uploads en `documents` y `calendar-keys` — confirmar que siguen el patrón `{client_id}/...`. Si no, migrar.
- Drop policies anteriores de los buckets privados
- Crear policy `multi_tenant_storage` que filtra por primer segmento del path
- Bucket `products` sigue público (no cambia)
- Crear bucket `tickets` (privado) preparado para Fase 2 de servicios
- Verificar: super_admin sube/descarga sin problema, simulación de client_user solo accede a su carpeta

**Effort:** 0.75d

---

#### E-05 — Auth context con rol + cliente

**Files:**
- `frontend/src/context/AuthContext.tsx` (nuevo o extender existente)
- `frontend/src/lib/supabase.ts` — opcional, hook de helper
- `frontend/src/components/AuthGuard.tsx` — adaptar

**Acceptance:**
- `AuthContext` expone: `{ user, profile: { role, client_id, full_name } | null, loading, signOut }`
- En `signIn` exitoso, fetchar `user_profiles where id = auth.uid()` y guardar en estado
- Si profile es null tras login → mostrar error "Tu cuenta aún no está configurada, contacta al administrador" y forzar logout
- Toda la app puede usar `useAuth()` para saber rol + client_id
- AuthGuard sigue protegiendo rutas autenticadas

**Effort:** 0.75d

---

#### E-06 — Selector de cliente (solo super_admin)

**Files:**
- `frontend/src/context/AppContext.tsx` — adaptar selección de cliente
- `frontend/src/components/Navbar.tsx` o similar — mostrar selector

**Acceptance:**
- Si `profile.role === 'super_admin'`: dropdown en navbar lista todos los clientes, selección persiste en localStorage
- Si `profile.role === 'client_user'`: NO se muestra el selector. `selectedClientId` está fijo en `profile.client_id`
- Todas las páginas que actualmente usan `selectedClientId` siguen funcionando — la fuente cambia pero la API no
- Default al loguear: super_admin → último cliente seleccionado en localStorage o el primero. client_user → su client_id

**Effort:** 0.5d

---

#### E-07 — PageGuard + visibilidad de páginas

**Files:**
- `frontend/src/components/PageGuard.tsx` (nuevo)
- `frontend/src/lib/permissions.ts` (nuevo) — exporta `PAGE_KEYS`, helpers `canSee(page, profile)`, `SUPER_ADMIN_ONLY_PAGES`
- `frontend/src/App.tsx` — wrap rutas
- `frontend/src/layouts/DashboardLayout.tsx` — filtrar items de nav

**Acceptance:**
- Helper `canSee(pageKey, profile)`:
  - Si `profile.role === 'super_admin'` → siempre `true`
  - Si la página está en `SUPER_ADMIN_ONLY_PAGES` → `false` para `user`
  - Else → `profile.allowed_pages.includes(pageKey)`
- Componente `<PageGuard page="tickets">{children}</PageGuard>`:
  - Si `canSee` retorna false → redirect a `/` o página de "no autorizado"
  - Cubre acceso por URL directa (no solo nav)
- Items de nav se esconden si `canSee(page, profile) === false`
- Si un `user` no tiene NINGUNA página visible (allowed_pages vacío y no es super_admin), mostrar mensaje "No tienes acceso a ninguna sección. Contacta al administrador."

**Effort:** 0.75d

---

#### E-08 — Hide sensitive fields en ClienteModal

**Files:**
- `frontend/src/components/ClienteModal.tsx`

**Acceptance:**
- Si `profile.role === 'client_user'`: las secciones de WhatsApp Cloud API (phone_number_id, access_token) y Google Calendar (key_url upload) se esconden
- Para client_user el modal puede ser totalmente read-only o permitir editar solo info básica (company_address, redes sociales, email) — decidir
- En cualquier caso, el bot_type NO es editable por client_user

**Effort:** 0.5d

---

#### E-09 — Test de aislamiento

**Files:** N/A (manual)

**Acceptance:**
- Crear un usuario test client_user vinculado a DTR (via SQL)
- Loguear con ese usuario en otra ventana / incognito
- Verificar:
  - Solo ve la pestaña/datos de DTR
  - No puede ver tickets de otro cliente (intentar query directa con anon key + JWT del client_user)
  - No puede insertar/editar tickets de otro cliente
  - No ve el selector de cliente
  - No accede a `/clientes` (redirect)
  - Sí ve sus propios tickets en realtime cuando llega uno nuevo
- Crear un 2do cliente test (mock) y verificar que client_user de DTR no ve nada de él

**Effort:** 0.5d

---

#### E-10 — UI de gestión de usuarios *(in-scope Fase 1)*

**Files:**
- `frontend/src/pages/Usuarios.tsx` (nuevo)
- `frontend/src/components/UsuarioModal.tsx` (nuevo)
- `chatbot/src/routes/admin.ts` (nuevo) — endpoints `POST /admin/users`, `PATCH /admin/users/:id`, `DELETE /admin/users/:id`
- `chatbot/src/index.ts` — wire admin routes con auth middleware

**Acceptance:**
- Página `/usuarios` visible solo para `super_admin` (RouteGuard)
- Lista todos los `user_profiles` con columnas: email, full_name, role, cliente, allowed_pages (badges), created_at
- Botón "Crear usuario" → modal con form:
  - email (required)
  - password (required, mínimo 8 chars)
  - full_name
  - role: select [`user`, `super_admin`]
  - Si role=`user`:
    - client_id: select de la lista de clientes (required)
    - allowed_pages: checkbox group con todas las páginas asignables (las que NO están en `SUPER_ADMIN_ONLY_PAGES`)
- Botón editar: permite cambiar full_name, role, client_id, allowed_pages (no email/password)
- Botón eliminar: confirma + llama backend
- Backend `chatbot/src/routes/admin.ts`:
  - Middleware: solo permite requests con un Bearer token cuyo perfil sea `super_admin`. Verifica con `supabase.auth.getUser(token)` + lookup de `user_profiles`
  - `POST /admin/users`: usa service role para `supabase.auth.admin.createUser()` + INSERT en `user_profiles`
  - `PATCH /admin/users/:id`: actualiza `user_profiles` (no toca auth.users salvo si cambia email — pospuesto)
  - `DELETE /admin/users/:id`: `auth.admin.deleteUser()` (cascade drop en user_profiles por FK)
- Validación: si role=`user`, client_id obligatorio; si role=`super_admin`, ignora client_id y allowed_pages

**Effort:** 1.5d

---

## 7. Resumen de esfuerzo

| Ticket | Effort |
|---|---|
| E-01 — Schema + funciones | 0.5d |
| E-02 — Crear super_admin | 0.25d |
| E-03 — Cutover RLS | 1.0d |
| E-04 — Storage policies | 0.75d |
| E-05 — Auth context | 0.75d |
| E-06 — Selector de cliente | 0.5d |
| E-07 — PageGuard + nav | 0.75d |
| E-08 — Hide sensitive fields | 0.5d |
| E-09 — Test aislamiento | 0.5d |
| E-10 — UI usuarios | 1.5d |
| **Total Fase 1** | **7.0d** ≈ **2 semanas** |

---

## 8. Orden de ejecución (CRÍTICO)

```
1. E-01 ─ Migration (sin tocar otras RLS)
   └─ Confirmar funciones SECURITY DEFINER funcionan

2. E-02 ─ INSERT tu super_admin profile
   └─ Verificar select public.current_user_role() = 'super_admin'

3. E-03 ─ Cutover RLS (TX única, una tabla a la vez con verificación)
   └─ Probar panel después de cada tabla migrada

4. E-04 ─ Storage policies
   └─ Probar upload/download de documents y calendar-keys

5. E-05 ─ Auth context (necesario para que el resto del frontend lea profile)

6. E-06 + E-07 + E-08 ─ Frontend (en paralelo si quieres)

7. E-10 ─ UI Usuarios (necesita el backend admin endpoint)

8. E-09 ─ Test de aislamiento creando un user real con E-10
```

**Nunca** ejecutes E-03 antes de E-02. Si lo haces, te quedarás bloqueado de tu propio panel y necesitarás SQL editor con service role para revertir.

---

## 9. Riesgos & mitigaciones

| Riesgo | Mitigación |
|---|---|
| Cutover RLS te bloquea el panel | E-02 estricto antes de E-03. Tener tab abierto al SQL editor con service role para emergencias |
| Recursión en policies por llamar a `user_profiles` desde policy | Usar SECURITY DEFINER en helpers (A2). NO hacer policies que se llamen entre sí |
| Performance de `current_user_role()` en cada query | Postgres cachea funciones STABLE dentro de la misma query. RLS no debería sumar latencia perceptible |
| Storage paths actuales no siguen patrón `{client_id}/...` | E-04 incluye auditar antes de aplicar. Si hay paths viejos, migrar primero |
| Client_user puede ver su `wa_access_token` en `clients` row | E-08 lo esconde en UI; suficiente para Fase 1. Para Fase 2 agregar column-level security o tabla separada `client_credentials` |
| Olvidar una tabla en el cutover | Checklist explícita en sección 4. Validar con `select * from pg_policies where schemaname='public'` post-migration |
| Realtime no respeta RLS | Confirmar — Supabase Realtime SÍ respeta RLS desde 2024 cuando se usa la API correcta. Test con E-09 |

---

## 10. Out of scope (Fase 2+)

- Public signup / self-service onboarding
- Permisos **dentro de una página** (ej: ve tickets pero no puede cambiar status). Si tiene la página, hace todo lo que la página permite
- Múltiples niveles jerárquicos de user (client_admin invitando otros users de su cliente)
- Audit logs (quién cambió qué cuándo)
- MFA / SSO
- Magic link / passwordless
- "Olvidé mi contraseña" desde la UI
- Branding por cliente (logo, colores en el panel)
- Multi-cliente por usuario (usuario que pertenece a varias empresas)
- Cambio de email desde la UI de Usuarios (manual via Supabase dashboard por ahora)
