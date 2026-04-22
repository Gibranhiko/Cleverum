# Cleverum — Tech Debt Backlog

> Generated after full codebase audit (F4–F6 complete).
> Tickets ordered by priority. Resolve before or after production deploy as indicated.

---

## Prioridad: CRÍTICA — resolver antes de producción

---

### [TD-01] Endpoints de gestión sin autenticación

**Archivo:** `chatbot/src/routes/bots.ts`

**Problema:** Todos los endpoints de gestión (`PUT /bots/:id/toggle`, `POST /bots/:id/send`, `PUT /bots/:id/credentials`, `POST /bots/:id/takeover`) son completamente públicos. Cualquiera que conozca la URL de Railway puede apagar bots, enviar mensajes como agente, o reemplazar las credenciales de WhatsApp de un cliente.

**Fix:** Agregar middleware de autenticación con un API key secreto (env var `ADMIN_API_KEY`):
```ts
// chatbot/src/middleware/auth.ts
export function requireApiKey(req, res, next) {
  const key = req.headers['x-api-key']
  if (key !== process.env.ADMIN_API_KEY) return res.status(401).json({ error: 'Unauthorized' })
  next()
}
```
Aplicar a `app.use('/bots', requireApiKey, botsRouter)` y `app.use('/documents', requireApiKey, documentsRouter)` en `index.ts`.

Agregar `ADMIN_API_KEY` a `.env.example` y a las env vars del frontend (`VITE_ADMIN_API_KEY`) para incluirlo en los fetch headers.

**Impacto:** CRÍTICO — vector de ataque directo en producción.

---

### [TD-02] Pedidos del catalogBot sin campos críticos

**Archivo:** `chatbot/src/flows/catalogBot.ts` (línea 284)

**Problema:** El INSERT a `orders` omite campos importantes:
- `customer_name` — siempre `NULL`
- `total` — siempre `NULL` (el monto nunca se calcula)
- `payment_method` — siempre `NULL` (nunca se pregunta)

El operador ve pedidos sin nombre ni total en la página de Pedidos, lo que hace el sistema inutilizable en producción.

**Fix:** Antes de `showOrderSummary()`, agregar pasos al flujo de checkout para recolectar nombre y método de pago. El total se calcula sumando precios de `items` (requiere que los productos tengan precio en la tabla `products` — actualmente el campo `options` tiene variantes pero no un precio raíz). Plan mínimo viable:

1. Agregar paso `flow_step: 'name'` al inicio del checkout: preguntar nombre al usuario.
2. Calcular total como suma de precios de los items del carrito (requiere que `products` tenga campo `price`).
3. Guardar `customer_name` y `total` en el INSERT.

**Impacto:** ALTO — datos incompletos en producción para Bot 2.

---

## Prioridad: ALTA — resolver en el primer sprint post-launch

---

### [TD-03] Reminders con `phone_numbers` vacío no envía a nadie

**Archivo:** `chatbot/src/services/reminder.ts` (línea 44)

**Problema:** La arquitectura (`docs/architecture.md`) especifica: `phone_numbers: text[] — Recipients (empty = all active contacts)`. El código actual itera sobre el array vacío y no envía nada, ignorando silenciosamente el reminder.

**Fix:**
```ts
let recipients = reminder.phone_numbers ?? []
if (recipients.length === 0) {
  const { data } = await supabase
    .from('conversation_sessions')
    .select('phone_number')
    .eq('client_id', reminder.client_id)
  recipients = data?.map(r => r.phone_number) ?? []
}
for (const phone of recipients) { ... }
```

**Impacto:** ALTO — feature rota silenciosamente.

---

### [TD-04] `whatsapp.ts` traga errores sin notificar al caller

**Archivo:** `chatbot/src/lib/whatsapp.ts`

**Problema:** La función `send()` captura el error de Axios y lo loguea, pero retorna `void` en ambos casos (éxito y fallo). El caller nunca sabe si el mensaje llegó o no. Esto afecta al `handleSendReply` del endpoint `/bots/:id/send` — responde `{ ok: true }` aunque el mensaje haya fallado.

**Fix:** Hacer que `send()` retorne `boolean` o lance el error:
```ts
async function send(...): Promise<void> {
  await axios.post(...) // sin try/catch — el error se propaga al caller
}
```
El caller en `bots.ts` ya tiene su propio try/catch y maneja el error correctamente.

**Impacto:** ALTO — el operador cree que el mensaje se envió cuando no.

---

### [TD-05] URL de Google Calendar key sin validación HTTPS

**Archivo:** `chatbot/src/services/googleCalendar.ts`

**Problema:** El campo `google_calendar_key_url` del cliente puede ser cualquier URL. Si alguien configura una URL `http://`, el service account JSON se descarga sin cifrado — riesgo de interceptación.

**Fix:** Antes de hacer el fetch, validar el protocolo:
```ts
if (!this.keyFileUrl.startsWith('https://')) {
  throw new Error('google_calendar_key_url must use HTTPS')
}
```

**Impacto:** ALTO — potencial exposición de credenciales de Google.

---

## Prioridad: MEDIA — refactors de calidad

---

### [TD-06] `BotContext` definido en tres archivos

**Archivos:**
- `chatbot/src/flows/infoBot.ts` (línea 16)
- `chatbot/src/flows/catalogBot.ts` (línea 7)
- `chatbot/src/flows/leadsBot.ts` (línea 8)

**Problema:** La misma interfaz con los mismos campos (más o menos) está duplicada en los tres flows. Si se agrega un campo nuevo (como ya pasó con `botConfig`) hay que editarlo en tres lugares.

**Fix:** Crear `chatbot/src/types/index.ts`:
```ts
import { Session } from '../lib/session'
export interface BotContext {
  text: string
  from: string
  client: any
  session: Session
  botConfig?: any
}
```
Importar desde los tres flows.

---

### [TD-07] Lógica de contexto RAG duplicada

**Archivos:**
- `chatbot/src/flows/infoBot.ts` (líneas 49–52)
- `chatbot/src/flows/leadsBot.ts` (líneas 48–51)

**Problema:** El mismo bloque de código (retrieve + formateo de chunks) aparece en ambos flows con texto ligeramente diferente.

**Fix:** Agregar función helper en `chatbot/src/services/rag.ts`:
```ts
export async function getRagContext(text: string, clientId: string, label = 'Información real de la empresa'): Promise<string> {
  const chunks = await retrieve(text, clientId).catch(() => [] as string[])
  return chunks.length > 0 ? `${label}:\n\n${chunks.join('\n\n')}\n\n` : ''
}
```

---

### [TD-08] `CHATBOT_URL` duplicado en tres páginas del frontend

**Archivos:**
- `frontend/src/pages/Conversaciones.tsx` (línea 10)
- `frontend/src/pages/Dashboard.tsx` (línea 18)
- `frontend/src/pages/Documentos.tsx` (línea 12)

**Problema:** La misma constante con el mismo fallback definida tres veces.

**Fix:** Crear `frontend/src/lib/config.ts`:
```ts
export const CHATBOT_URL = import.meta.env.VITE_CHATBOT_URL ?? 'http://localhost:4000'
```
Importar desde las tres páginas.

---

### [TD-09] `formatDate()` y `timeAgo()` duplicadas en el frontend

**Problema:**
- `formatDate()` está en `Documentos.tsx`, `Leads.tsx` y `Pedidos.tsx`
- `timeAgo()` / `formatRelative()` está en `Conversaciones.tsx` y `Dashboard.tsx`

**Fix:** Crear `frontend/src/lib/formatters.ts` con ambas funciones y reemplazar todas las definiciones locales.

---

### [TD-10] `/bots/status` expone `wa_phone_number_id`

**Archivo:** `chatbot/src/routes/bots.ts` (línea 32)

**Problema:** El endpoint de status retorna `wa_phone_number_id` que es un identificador sensible de Meta. El Dashboard no lo usa para nada en el frontend.

**Fix:** Remover del `.select()`:
```ts
.select('id, company_name, bot_type, bot_active, whatsapp_phone')
```

---

### [TD-11] Tipos `any` en rutas críticas del backend

**Problema:** El objeto `client` que se pasa a todos los flows es `any`. Si cambia el schema de `clients`, TypeScript no detectará el error.

**Archivos afectados:**
- `chatbot/src/webhook/handler.ts` — `clientCache`, `botConfigCache`, función `handleCommand`
- `chatbot/src/flows/infoBot.ts`, `catalogBot.ts`, `leadsBot.ts` — `client: any` en BotContext

**Fix:** Crear interface `ClientRow` con los campos usados y tipar el cache y el contexto con ella. Hacer lo mismo con `BotConfigRow`.

---

## Prioridad: BAJA — nice to have

---

### [TD-12] Sin rate limiting en el webhook

**Archivo:** `chatbot/src/index.ts`

**Problema:** El endpoint `POST /webhook` acepta peticiones ilimitadas. Un flood de mensajes desde un número podría saturar el servidor o agotar el quota de OpenAI.

**Fix:** Agregar `express-rate-limit` como middleware:
```ts
import rateLimit from 'express-rate-limit'
app.use('/webhook', rateLimit({ windowMs: 60_000, max: 100 }))
```

---

### [TD-13] Sin logger estructurado — todo va a `console.log`

**Problema:** El backend tiene ~20 `console.log` / `console.error`. En Railway los logs son planos y difíciles de filtrar. En producción conviene tener al menos nivel de severidad.

**Fix:** Reemplazar con una librería ligera como `pino` o simplemente un wrapper:
```ts
// lib/logger.ts
export const logger = {
  info: (...args: any[]) => console.log('[INFO]', ...args),
  warn: (...args: any[]) => console.warn('[WARN]', ...args),
  error: (...args: any[]) => console.error('[ERROR]', ...args),
}
```

---

## Estado del devplan

| Ticket | Feature | Estado |
|---|---|---|
| F4-01 | Embedding pipeline | ✅ Completo |
| F4-02 | RAG en infoBot | ✅ Completo |
| F4-03 | RAG en leadsBot | ✅ Completo |
| F4-04 | Document UI con indexing | ✅ Completo |
| F5-01 | Dashboard | ✅ Completo |
| F5-02 | Conversaciones — send real | ✅ Completo |
| F5-03 | Leads CSV export | ✅ Completo |
| F5-04 | ConfigBot | ✅ Completo |
| F5-05 | Analytics view | ✅ Completo |
| F6-01 | Pre-deploy cleanup | ✅ Completo |
| F6-02 | Deploy Cloudflare Pages | ⏳ Pendiente |
| F6-03 | Deploy Railway | ⏳ Pendiente |
| F6-04 | Smoke test | ⏳ Pendiente |

---

## Resumen por prioridad

| ID | Issue | Prioridad | Antes de prod |
|---|---|---|---|
| TD-01 | Auth en endpoints /bots/* | CRÍTICA | ✅ Sí |
| TD-02 | Pedidos sin customer_name/total | ALTA | ✅ Sí |
| TD-03 | Reminders vacíos no envían | ALTA | ✅ Sí |
| TD-04 | whatsapp.ts traga errores | ALTA | ✅ Sí |
| TD-05 | Google Calendar key sin HTTPS | ALTA | ✅ Sí |
| TD-06 | BotContext duplicado x3 | MEDIA | No |
| TD-07 | RAG context logic duplicada | MEDIA | No |
| TD-08 | CHATBOT_URL duplicado x3 | MEDIA | No |
| TD-09 | formatDate / timeAgo duplicados | MEDIA | No |
| TD-10 | wa_phone_number_id en /status | MEDIA | No |
| TD-11 | Tipos `any` en backend | MEDIA | No |
| TD-12 | Sin rate limiting en webhook | BAJA | No |
| TD-13 | Sin logger estructurado | BAJA | No |
