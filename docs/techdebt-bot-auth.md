# Cleverum — Tech Debt: Bot `servicios` + Auth multi-tenant

> ## ✅ COMPLETADO
> Todos los 12 tickets (BOT-01 → BOT-07, AUTH-01 → AUTH-03, API-01 → API-02) están resueltos.
> Se mantiene como referencia histórica de la review post-implementación.

> Hallazgos de la revisión post-implementación (2026-05-07).
> Ordenados por severidad. Cada ticket es independiente y se puede atacar en orden de prioridad.

---

## Resumen de tickets

| ID | Descripción | Severidad | Área | Estado |
|---|---|---|---|---|
| BOT-01 | Folio enumeration oracle revela tickets de otros clientes finales | CRÍTICA | `chatbot/src/flows/servicesBot.ts` | ✅ Resuelto |
| AUTH-01 | Loop infinito de redirect cuando `allowed_pages` está vacío | CRÍTICA | `frontend` (App + permissions) | ✅ Resuelto |
| AUTH-02 | TOKEN_REFRESHED remonta toda la app | CRÍTICA | `frontend/src/context/AppContext.tsx` | ✅ Resuelto |
| BOT-02 | Folio regex hijacking en mensajes con texto libre | ALTA | `chatbot/src/flows/servicesBot.ts` | ✅ Resuelto |
| BOT-03 | Botón "Modificar" intake borra todo el state pero comentario dice lo contrario | ALTA | `chatbot/src/flows/servicesBot.ts` | ✅ Resuelto |
| BOT-04 | `awaiting_confirm` rechaza confirmaciones por texto libre | ALTA | `chatbot/src/flows/servicesBot.ts` | ✅ Resuelto |
| API-01 | Backend admin no valida `allowed_pages` contra catálogo permitido | MEDIA | `chatbot/src/routes/admin.ts` | ✅ Resuelto |
| API-02 | PATCH puede demotear al último `super_admin` y brickear el sistema | MEDIA | `chatbot/src/routes/admin.ts` | ✅ Resuelto |
| BOT-05 | Status query acepta cualquier texto cuando flow=`awaiting_folio` | MEDIA | `chatbot/src/flows/servicesBot.ts` | ✅ Resuelto |
| BOT-06 | Faltan `appendToHistory` en prompts del intake | BAJA | `chatbot/src/flows/servicesBot.ts` | ✅ Resuelto |
| AUTH-03 | "Cuenta sin configurar" se muestra en errores transitorios de fetch | BAJA | `frontend/src/components/AuthGuard.tsx` | ✅ Resuelto |
| BOT-07 | Status flow no limpia `session.state` al cerrar | BAJA | `chatbot/src/flows/servicesBot.ts` | ✅ Resuelto |

---

## CRÍTICOS

### BOT-01 — Folio enumeration oracle

**Severidad:** CRÍTICA
**Área:** `chatbot/src/flows/servicesBot.ts:404-410`

#### Problema

`handleStatusQuery` distingue dos casos con mensajes diferentes:

```ts
if (!ticket) {
  await sendText(... `No encontré la orden *${folio}*. Verifica el folio...`)
  return
}
if (ticket.customer_phone !== from) {
  await sendText(... `No encontré la orden *${folio}* asociada a este número.`)
  return
}
```

El segundo mensaje **confirma** que el folio existe pero pertenece a otro número. Un atacante puede iterar folios secuenciales (DTR-1, DTR-2, DTR-3...) y mapear cuáles están ocupados por otras personas.

#### Solución propuesta

Mismo mensaje en ambos casos:

```ts
if (!ticket || ticket.customer_phone !== from) {
  await sendText(... `No encontré la orden *${folio}*. Verifica el folio o escribe *menu* para ver opciones.`)
  return
}
```

---

### AUTH-01 — Loop infinito de redirect con `allowed_pages` vacío

**Severidad:** CRÍTICA
**Área:** `frontend/src/lib/permissions.ts:36-42` + `frontend/src/App.tsx:49`

#### Problema

Si un `user` se crea (o edita) sin asignar páginas (`allowed_pages = []`):

1. AuthGuard pasa (profile existe)
2. Index route `/` → `<DefaultRedirect />`
3. `landingPath(profile)` retorna `/no-access`
4. Navigate a `/no-access`
5. `/no-access` no matchea ninguna ruta
6. Catch-all `<Route path="*" element={<DefaultRedirect />} />` se activa
7. `landingPath()` retorna `/no-access` otra vez → **loop infinito**

#### Solución propuesta

Crear una página simple `NoAccess.tsx` y registrarla como ruta:

```tsx
<Route path="no-access" element={<NoAccess />} />
```

Página muestra mensaje "No tienes acceso a ninguna sección. Contacta al administrador." con botón de logout. No requiere PageGuard.

---

### AUTH-02 — TOKEN_REFRESHED remonta toda la app

**Severidad:** CRÍTICA
**Área:** `frontend/src/context/AppContext.tsx:69-72`

#### Problema

```ts
const { data: { subscription } } = supabase.auth.onAuthStateChange((_, s) => {
  setLoading(true)              // ← se ejecuta en TOKEN_REFRESHED
  resolveSessionAndProfile(s)
})
```

Supabase Auth dispara `onAuthStateChange` con evento `TOKEN_REFRESHED` cada ~1 hora cuando renueva el access_token automáticamente. El `setLoading(true)` provoca que `AuthGuard` muestre el spinner y **desmonte toda la dashboard**, incluyendo formularios con texto a medio escribir, modales abiertos, etc.

#### Solución propuesta

Distinguir entre eventos que sí requieren reload y los que no:

```ts
supabase.auth.onAuthStateChange((event, s) => {
  if (event === 'TOKEN_REFRESHED') {
    setSession(s)  // solo actualiza el token, no el profile
    return
  }
  setLoading(true)
  resolveSessionAndProfile(s)
})
```

Eventos relevantes para reload: `INITIAL_SESSION`, `SIGNED_IN`, `SIGNED_OUT`, `USER_UPDATED`.

---

## ALTOS

### BOT-02 — Folio regex hijacking en mensajes con texto libre

**Severidad:** ALTA
**Área:** `chatbot/src/flows/servicesBot.ts:5`

#### Problema

```ts
const FOLIO_REGEX = /\b([A-Z]{2,5})-(\d+)\b/i
```

Usa word boundaries — matchea folios incrustados en oraciones. Ejemplos problemáticos:
- "Mi PC-1 no enciende" → matchea `PC-1`, routea a status query
- "iPhone 14-pro" → no match (no `\d+` al final)
- "se cayó del PC-7" → matchea `PC-7`

#### Solución propuesta

Versión strict que requiere que el texto entero (trimeado) sea el folio:

```ts
const FOLIO_REGEX = /^([A-Z]{2,5})-(\d+)$/i

// y en el check:
if (flow !== 'intake' && FOLIO_REGEX.test(text.trim())) {
  return handleStatusQuery(ctx, text)
}
```

Para preguntas tipo "estado de DTR-1" el intent classifier (`getServicesIntent`) detecta `consultar_orden` y luego pide el folio en `awaiting_folio`.

---

### BOT-03 — Botón "Modificar" intake borra todo el state

**Severidad:** ALTA
**Área:** `chatbot/src/flows/servicesBot.ts:332-335`

#### Problema

```ts
if (text === 'intake_confirm:modify') {
  // Restart from device_type, keeping data so user re-confirms each step
  await updateSession(clientId, from, {
    flow_step: 'awaiting_device_type',
    state: {},   // ← borra todo el state
  })
  ...
}
```

Comentario y código se contradicen. Como WhatsApp Lists no soportan "default selection", pre-rellenar realmente no aporta. Pero el comentario es engañoso para quien lea el código después.

#### Solución propuesta

Dos opciones:

**A.** Aceptar el wipe y arreglar comentario + mensaje:
```ts
state: {},
// Mensaje al usuario: 'Sin problema, comencemos de nuevo desde el principio.'
```

**B.** Pre-rellenar campos de texto (model, problem, name) que sí se pueden mostrar como placeholder. Más complejo, vale la pena solo si el feedback de usuarios lo pide.

Recomendado: opción A.

---

### BOT-04 — `awaiting_confirm` rechaza confirmaciones por texto libre

**Severidad:** ALTA
**Área:** `chatbot/src/flows/servicesBot.ts:327`

#### Problema

```ts
case 'awaiting_confirm': {
  if (text === 'intake_confirm:yes') return finalizeIntake(ctx, state)
  if (text === 'intake_confirm:modify') { ... }
  // Invalid input — re-show confirm
  return promptConfirm(ctx, state)
}
```

Si el usuario tipea "sí", "si", "ok" en vez de tap del botón, el bot re-muestra el resumen sin decir nada. UX confusa.

#### Solución propuesta

Aceptar variantes naturales:

```ts
const lower = text.trim().toLowerCase()
const yesWords = ['intake_confirm:yes', 'si', 'sí', 'yes', 'ok', 'okay', 'correcto', 'confirmo']
const modifyWords = ['intake_confirm:modify', 'no', 'modificar', 'cambiar', 'editar']

if (yesWords.includes(lower) || lower === 'intake_confirm:yes') return finalizeIntake(...)
if (modifyWords.some(w => lower === w)) { ... }

// Si no matchea, re-prompt explicando que tap o escriba sí/no
await sendText(... 'No entendí. Tap un botón o escribe *sí* para crear o *no* para modificar.')
return promptConfirm(ctx, state)
```

---

## MEDIOS

### API-01 — Backend admin no valida `allowed_pages`

**Severidad:** MEDIA
**Área:** `chatbot/src/routes/admin.ts:38-141`

#### Problema

POST y PATCH `/admin/users` aceptan `allowed_pages` como cualquier `string[]`. Permite:
- Strings que no son page keys válidas (ej: `["foo", "bar"]`) — datos basura en DB
- Pages super-admin-only (`'clientes'`, `'usuarios'`) — la UI las rechaza pero RLS no se preocupa

#### Solución propuesta

Definir el catálogo permitido en backend y filtrar:

```ts
const VALID_PAGES = [
  'dashboard', 'pedidos', 'productos', 'leads',
  'conversaciones', 'reminders', 'documentos',
  'config', 'tickets', 'servicios',
  // 'clientes', 'usuarios' EXCLUIDAS — solo super_admin
]

const cleanPages = (pages: unknown): string[] => {
  if (!Array.isArray(pages)) return []
  return pages.filter(p => typeof p === 'string' && VALID_PAGES.includes(p))
}

// En POST:
allowed_pages: role === 'super_admin' ? [] : cleanPages(allowed_pages)
```

Idealmente compartir el catálogo entre frontend y backend (ej: `shared/permissions.ts`), pero por ahora duplicar es OK.

---

### API-02 — PATCH puede demotear al último `super_admin`

**Severidad:** MEDIA
**Área:** `chatbot/src/routes/admin.ts:94-141`

#### Problema

PATCH permite cambiar el rol de un super_admin a `user`. Si quitas tu propio rol (o solo hay 1 super_admin y lo demotean), nadie puede crear más users → sistema brickeado.

#### Solución propuesta

Antes de cambiar rol de un super_admin a `user`:

```ts
if (role === 'user') {
  const { data: target } = await supabase
    .from('user_profiles').select('role').eq('id', id).single()

  if (target?.role === 'super_admin') {
    const { count } = await supabase
      .from('user_profiles')
      .select('id', { count: 'exact', head: true })
      .eq('role', 'super_admin')

    if ((count ?? 0) <= 1) {
      res.status(400).json({ error: 'No se puede demotar al último super_admin' })
      return
    }
  }
}
```

Aplica para PATCH y también para DELETE de super_admins.

---

### BOT-05 — Status query acepta cualquier texto

**Severidad:** MEDIA
**Área:** `chatbot/src/flows/servicesBot.ts:386-390`

#### Problema

Cuando flow=`awaiting_folio` y user escribe algo que no matchea regex:

```ts
const match = text.match(FOLIO_REGEX)
const folio = match ? `${match[1].toUpperCase()}-${match[2]}` : text.trim().toUpperCase()
```

Sin match cae a `text.trim().toUpperCase()`. Si user escribe "ola" → `folio = "OLA"` → query DB → "no encontré OLA". Es funcional pero UX rara.

#### Solución propuesta

Validar formato antes de la query:

```ts
const match = text.trim().match(FOLIO_REGEX)
if (!match) {
  await sendText(... 'Formato no válido. Escribe el folio (ej: ABC-123) o *menu* para ver opciones.')
  return  // mantener flow_step en awaiting_folio
}
const folio = `${match[1].toUpperCase()}-${match[2]}`
```

---

## BAJOS

### BOT-06 — Faltan `appendToHistory` en prompts del intake

**Severidad:** BAJA
**Área:** `chatbot/src/flows/servicesBot.ts` (varios)

#### Problema

Los `sendText`/`sendList` durante intake (preguntas del bot tipo "¿Qué tipo de equipo?", "¿Modelo?") no llaman a `appendToHistory(clientId, from, 'assistant', message)`. Solo `finalizeIntake` y status query lo hacen.

Resultado: si después del intake el user pregunta algo de FAQ, `session.history` no incluye los prompts del bot. AI ve un historial fragmentado.

#### Solución propuesta

Agregar `appendToHistory` después de cada `sendText`/`sendList` en intake. Helper:

```ts
async function sendAndStore(ctx, sendFn, text) {
  await sendFn()
  await appendToHistory(ctx.client.id, ctx.from, 'assistant', text)
}
```

No es bloqueante para Fase 1 — RAG y intent classifier funcionan sin esto. Pulir después.

---

### AUTH-03 — "Cuenta sin configurar" en errores transitorios

**Severidad:** BAJA
**Área:** `frontend/src/components/AuthGuard.tsx:19-31`

#### Problema

Cuando profile fetch falla por timeout/network, `profile === null` → AuthGuard muestra "Cuenta sin configurar" con botón de logout. Mensaje alarmante para un error recuperable.

#### Solución propuesta

Distinguir entre "no profile (data correcta, usuario sin configurar)" y "fetch falló":

```ts
// AppContext: agregar profileError state
if (error) setProfileError(error.message)

// AuthGuard: si hay profileError, mostrar "Error temporal, recarga"
// Si no hay error pero profile es null, mostrar "Cuenta sin configurar"
```

Implementación lo define después si se vuelve un dolor real.

---

### BOT-07 — Status flow no limpia `state` al cerrar

**Severidad:** BAJA
**Área:** `chatbot/src/flows/servicesBot.ts` (handleStatusQuery)

#### Problema

```ts
await updateSession(clientId, from, { current_flow: null, flow_step: null })
// no limpia state
```

State residual del intake o cualquier otro flow puede quedar persistido. No es bug funcional pero ensucia la DB.

#### Solución propuesta

Agregar `state: {}` consistentemente cuando se resetea flow:

```ts
await updateSession(clientId, from, { current_flow: null, flow_step: null, state: {} })
```

Aplicar en todas las funciones que cierran un flow.

---

## Notas adicionales

### Cosas observadas pero NO consideradas tech debt
- Quote amount solo se muestra para status `cotizado` y `aprobado` — intencional
- `next_ticket_number` no es SECURITY DEFINER — correcto, no necesita serlo (RLS no aplica al chatbot que usa service role)
- Storage policies asumen path `{client_id}/...` — verificado, todos los uploads existentes siguen este patrón
- Match_chunks no tiene `set search_path` — solo se llama desde service role del chatbot, irrelevante
- `auth.admin.deleteUser` cascade de FK a `user_profiles` — confirmado, FK tiene `on delete cascade`

### Roadmap sugerido
1. Fixear los 3 críticos (BOT-01, AUTH-01, AUTH-02) antes de cualquier prueba
2. Después los altos (BOT-02, BOT-03, BOT-04)
3. Probar end-to-end
4. Si todo OK, atacar los medios y bajos en sprints siguientes
