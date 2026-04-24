# Cleverum — Tech Debt: WhatsApp Ban Risk

> Generated from full codebase audit focused on Meta WhatsApp Cloud API compliance.
> Resolve tickets in order — they are sequenced by risk level and dependency.

---

## Contexto: cómo Meta suspende números

Meta evalúa la calidad de cada número de WhatsApp Business con tres indicadores:

1. **Tasa de reportes como spam** — Si suficientes usuarios bloquean o reportan el número,
   Meta lo degrada (Verde → Amarillo → Rojo) y eventualmente lo suspende.
2. **Violaciones de política** — Mensajes fuera de la ventana de 24h sin template aprobado,
   envíos masivos sin opt-in, o contenido prohibido generan flags directos.
3. **Rate limits** — Superar el throughput permitido por `phone_number_id` puede bloquear
   el número temporalmente o degradar su nivel de mensajería.

El sistema actual tiene riesgos en los tres ejes. Los tickets están ordenados por
severidad: resolver los CRÍTICOS antes de conectar cualquier número real.

---

## Resumen de tickets

| ID | Descripción | Severidad | Antes de prod | Estado |
|---|---|---|---|---|
| WA-01 | Reminders business-initiated sin Message Templates | CRÍTICA | Sí | ✅ Resuelto |
| WA-02 | Reminders no verifican ventana de 24h | CRÍTICA | Sí | ✅ Resuelto |
| WA-03 | Sin manejo de opt-out por palabras clave | ALTA | Sí | ✅ Resuelto |
| WA-04 | Error 131047 (ventana expirada) no se maneja | ALTA | Sí | ✅ Resuelto |
| WA-05 | Sin rate limiting entre envíos de reminders | ALTA | Sí | ✅ Resuelto |
| WA-06 | Versión de API hardcodeada como v19.0 | MEDIA | No | ✅ Resuelto |
| WA-07 | Sin handler para quality rating updates de Meta | MEDIA | No | ✅ Resuelto |
| WA-08 | Mensajes de reminder sin instrucciones de opt-out | MEDIA | No | ✅ Resuelto |
| WA-09 | /bots/:clientId/send no verifica ventana de 24h | BAJA | No | ✅ Resuelto |
| WA-10 | Sin deduplicación de destinatarios en reminders | BAJA | No | ✅ Resuelto |

---

## CRÍTICA — resolver antes de conectar cualquier número real

---

### [WA-01] Reminders envían mensajes business-initiated sin Message Templates

**Archivo:** `chatbot/src/services/reminder.ts`

**Problema:** Los reminders usan `sendText()` — mensajes de texto libre. Meta solo permite
enviar texto libre dentro de la **ventana de servicio de 24h** (cuando el usuario fue quien
inició el último mensaje). Para mensajes iniciados por el negocio fuera de esa ventana,
Meta exige usar **Message Templates (HSM)** pre-aprobados.

Un reminder por definición es un mensaje que *el negocio inicia* — no es una respuesta a
algo que el usuario acaba de escribir. Enviarlo como texto libre es una violación directa
de la política de Meta que puede resultar en:

- Error silencioso `131047` si el usuario está fuera de ventana
- Flag de calidad si se hace de forma recurrente o masiva
- Suspensión del número en casos de alto volumen

Adicionalmente, el fallback actual cuando `phone_numbers` está vacío envía a **todos los
usuarios en `conversation_sessions`** sin verificar si hay opt-in ni si están en ventana:

```ts
// reminder.ts:44-51  ← EL BLOQUE MÁS PELIGROSO DEL PROYECTO
if (recipients.length === 0) {
  const { data: sessions } = await supabase
    .from('conversation_sessions')
    .select('phone_number')
    .eq('client_id', reminder.client_id)
  recipients = (sessions ?? []).map((s: any) => s.phone_number)
}
```

Esto es un **blast masivo de mensajes sin templates ni opt-in** — el escenario exacto
que Meta identifica como spam.

**Fix en dos etapas:**

**Etapa 1 (inmediata — antes de prod):** Eliminar el fallback de "enviar a todos". Hacer
que `phone_numbers` sea requerido. Si está vacío, el reminder no se envía y se loguea un
warning. Esto corta el riesgo de blast masivo de raíz.

```ts
// reminder.ts — reemplazar el bloque del fallback
const recipients: string[] = reminder.phone_numbers ?? []
if (recipients.length === 0) {
  console.warn(`[Reminders] Reminder ${reminder.id} has no recipients — skipped`)
  continue
}
```

**Etapa 2 (post-prod, WA-02 lo complementa):** Implementar soporte para Message Templates
en `whatsapp.ts`. Los reminders deben enviarse vía template con variables dinámicas
(nombre, hora, mensaje). Requiere crear y aprobar templates en Meta Business Manager
antes de usarlos.

**Impacto:** CRÍTICO — el fallback actual puede provocar suspensión inmediata del número
en el primer reminder mal configurado.

---

### [WA-02] Reminders no verifican la ventana de 24h por destinatario

**Archivo:** `chatbot/src/services/reminder.ts`

**Problema:** El cron envía el reminder a todos los destinatarios sin verificar cuándo fue
su último mensaje. La tabla `conversation_sessions` ya tiene el campo `last_message_at`
disponible — no se usa.

Si el último mensaje del usuario fue hace más de 24h, cualquier `sendText()` viola la
política de ventana de servicio de Meta. El número puede recibir un flag por cada envío
fallido o no detectado.

```ts
// reminder.ts:53-55 — sin ninguna verificación de ventana
for (const phone of recipients) {
  await sendText(client.wa_phone_number_id, client.wa_access_token, phone, reminder.message)
}
```

**Fix:** Antes de enviar a cada destinatario, consultar `last_message_at` y solo proceder
si el usuario está dentro de la ventana (o en el futuro, cuando WA templates estén
implementados, enviar vía template fuera de ventana).

```ts
// Enriquecer la query de recipients para incluir last_message_at
const { data: sessions } = await supabase
  .from('conversation_sessions')
  .select('phone_number, last_message_at')
  .eq('client_id', reminder.client_id)
  .in('phone_number', recipients)

const WINDOW_MS = 23.5 * 60 * 60 * 1000 // 23.5h — margen de seguridad
const now = Date.now()

for (const session of sessions ?? []) {
  const lastMsg = session.last_message_at ? new Date(session.last_message_at).getTime() : 0
  if (now - lastMsg > WINDOW_MS) {
    console.warn(`[Reminders] Skipping ${session.phone_number} — outside 24h window`)
    continue
  }
  await sendText(...)
}
```

**Nota:** Esta verificación es el puente seguro hasta que los Message Templates estén
implementados (WA-01 Etapa 2). Con templates, el check de ventana desaparece porque
los templates pueden enviarse en cualquier momento.

**Impacto:** CRÍTICO — cada reminder enviado a un usuario inactivo es una violación
de política de Meta.

---

## ALTA — resolver antes del primer cliente en producción

---

### [WA-03] Sin manejo de opt-out por palabras clave

**Archivo:** `chatbot/src/webhook/handler.ts`

**Problema:** El handler solo reconoce `botoff`, `status`, y `boton` como comandos.
No detecta ni procesa palabras de opt-out estándar como:
- STOP, ALTO, CANCELAR, BAJA, NO GRACIAS, SALIR, UNSUBSCRIBE

Un usuario que dice "STOP" o "ya no quiero mensajes" y sigue recibiendo respuestas del
bot tiene todas las razones para reportar el número como spam. Meta mide la tasa de
reportes por número — a partir de cierto umbral el número entra en revisión y puede
ser suspendido.

**Fix:** Agregar detección de opt-out antes del routing en `processMessage()`:

```ts
// handler.ts — agregar después de la verificación de COMMANDS
const OPT_OUT_KEYWORDS = new Set([
  'stop', 'alto', 'cancelar', 'baja', 'darme de baja', 'no quiero',
  'no más', 'no mas', 'salir', 'unsubscribe', 'eliminar',
])

function isOptOut(text: string): boolean {
  const normalized = text.trim().toLowerCase()
  return OPT_OUT_KEYWORDS.has(normalized) ||
    OPT_OUT_KEYWORDS.has(normalized.replace(/[^a-záéíóúüñ\s]/gi, '').trim())
}

// En processMessage(), antes del routing:
if (isOptOut(text)) {
  await updateSession(client.id, from, { bot_disabled_for_user: true })
  await sendText(pid, token, from,
    'Has sido dado de baja. Ya no recibirás mensajes de este número. ' +
    'Si deseas reactivarte, escribe HOLA.')
  return
}
```

El flag `bot_disabled_for_user` ya existe en el schema — solo falta activarlo con estas
palabras clave además del comando `botoff`.

**Impacto:** ALTO — cada usuario que pide parar y sigue recibiendo mensajes es un reporte
potencial de spam.

---

### [WA-04] Error 131047 (ventana de 24h expirada) no se maneja específicamente

**Archivo:** `chatbot/src/lib/whatsapp.ts`

**Problema:** La función `send()` captura todos los errores de la API de Meta de la misma
forma. El error `131047` ("Re-engagement message") es el código que Meta devuelve cuando
intentas enviar texto libre a un usuario fuera de la ventana de 24h.

Actualmente este error se convierte en un `throw new Error('[WA] Send failed: ...')` genérico.
El caller lo loguea y sigue adelante, sin ningún contexto de qué pasó ni ninguna acción
correctiva.

```ts
// whatsapp.ts:11-13 — todos los errores tratados igual
.catch((err: any) => {
  const detail = err.response?.data?.error?.message ?? err.message
  throw new Error(`[WA] Send failed: ${detail}`)
})
```

Consecuencia práctica: si un reminder falla con 131047 para 50 usuarios, el log muestra
50 líneas de error genérico y nadie sabe que fue por ventana expirada. Sin visibilidad,
el problema nunca se diagnostica.

**Fix:** Parsear el código de error de Meta y lanzar un error tipado:

```ts
// whatsapp.ts
export class WhatsAppWindowError extends Error {
  constructor(to: string) {
    super(`[WA] 24h window expired for ${to}`)
    this.name = 'WhatsAppWindowError'
  }
}

.catch((err: any) => {
  const metaError = err.response?.data?.error
  if (metaError?.code === 131047) throw new WhatsAppWindowError(body.to as string)
  const detail = metaError?.message ?? err.message
  throw new Error(`[WA] Send failed (code ${metaError?.code ?? 'unknown'}): ${detail}`)
})
```

Con esto, `reminder.ts` puede hacer `catch (e) { if (e instanceof WhatsAppWindowError) ... }`
y actuar de forma diferente (saltar al siguiente destinatario en lugar de abortar el cron).

**Impacto:** ALTO — sin esto, los fallos de ventana son invisibles y no se puede corregir
el comportamiento automáticamente.

---

### [WA-05] Sin rate limiting entre envíos en el cron de reminders

**Archivo:** `chatbot/src/services/reminder.ts`

**Problema:** El loop de envío no tiene ningún delay entre mensajes:

```ts
for (const phone of recipients) {
  await sendText(...)  // sin pausa
}
```

Meta impone límites de throughput por `phone_number_id`. El límite exacto varía según el
nivel de la cuenta (Standard: ~250 msg/seg en ráfaga, pero el promedio sostenido es mucho
menor). Un burst inesperado activa rate limiting temporal, que Meta puede escalar a una
degradación de calidad si ocurre de forma repetida.

**Fix:** Agregar un delay mínimo entre envíos. 100ms da un throughput de ~10 msg/seg,
suficiente para casi cualquier cliente de esta plataforma sin riesgo de rate limiting:

```ts
async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

for (const phone of recipients) {
  await sendText(...)
  await sleep(100)
}
```

**Impacto:** ALTO — un cliente con muchos contactos podría saturar su número y recibir
un bloqueo temporal de Meta en el primer reminder masivo.

---

## MEDIA — resolver en el primer sprint post-lanzamiento

---

### [WA-06] Versión de API de WhatsApp hardcodeada como v19.0

**Archivo:** `chatbot/src/lib/whatsapp.ts:3`

**Problema:**
```ts
const BASE = 'https://graph.facebook.com/v19.0'
```

Meta depreca versiones del Graph API en ciclos regulares (~cada 2 años). Cuando v19.0
llegue a fin de vida, todos los envíos de WhatsApp fallarán silenciosamente o con error
genérico. No hay ningún mecanismo para detectar esto antes de que suceda.

**Fix:** Mover la versión a una variable de entorno con fallback:

```ts
const API_VERSION = process.env.WHATSAPP_API_VERSION ?? 'v20.0'
const BASE = `https://graph.facebook.com/${API_VERSION}`
```

Agregar `WHATSAPP_API_VERSION=v20.0` a `.env.example`. Actualizar a la versión estable
actual al momento del deploy.

**Impacto:** MEDIO — no es un riesgo de ban inmediato, pero causará outage total cuando
la versión actual sea deprecada.

---

### [WA-07] Sin handler para quality rating updates de Meta

**Archivo:** `chatbot/src/webhook/handler.ts`

**Problema:** Meta envía notificaciones por webhook cuando la calidad de un número cambia
(eventos `phone_number_quality_update` y `account_alerts`). El handler actual ignora todos
los eventos que no son `field: 'messages'`:

```ts
// handler.ts:59
if (change.field !== 'messages') continue
```

Esto significa que si Meta empieza a degradar un número (Verde → Amarillo), el operador
no se entera hasta que los mensajes empiecen a fallar.

**Fix:** Agregar handlers para los eventos de calidad más importantes:

```ts
if (change.field === 'phone_number_quality_update') {
  const { display_phone_number, event, current_limit } = change.value
  console.warn(`[Meta Quality] ${display_phone_number}: ${event}, limit=${current_limit}`)
  // Futuro: enviar alerta al operador vía Supabase o email
}

if (change.field === 'account_alerts') {
  console.error('[Meta Alert]', JSON.stringify(change.value))
}
```

**Impacto:** MEDIO — sin esto, un ban se descubre cuando ya es tarde. Con esto, el
operador tiene al menos tiempo de reaccionar.

---

### [WA-08] Mensajes de reminder sin instrucciones de opt-out

**Archivo:** `chatbot/src/services/reminder.ts` + `frontend/src/pages/Reminders.tsx`

**Problema:** Los reminders se envían exactamente como el operador los escribe, sin ninguna
indicación de cómo el usuario puede detenerlos. Meta recomienda (y para algunos tipos de
mensajes requiere) incluir instrucciones de opt-out.

Un usuario que recibe recordatorios recurrentes sin saber cómo pararlos tiene más
probabilidad de reportar el número como spam que de escribir `botoff` (un comando que
no conoce).

**Fix:** Dos opciones (elegir una):

**Opción A — Append automático (más simple):**
```ts
// reminder.ts — al enviar
const fullMessage = `${reminder.message}\n\n_Responde STOP para no recibir más mensajes._`
await sendText(pid, token, phone, fullMessage)
```

**Opción B — Validación en frontend:**
En `Reminders.tsx`, al guardar un reminder, verificar que el mensaje contenga alguna
variante de opt-out y mostrar un warning si no la tiene.

**Impacto:** MEDIO — reduce la tasa de reportes de spam en usuarios que reciben reminders
recurrentes.

---

## BAJA — nice to have

---

### [WA-09] El endpoint /bots/:clientId/send no verifica ventana de 24h

**Archivo:** `chatbot/src/routes/bots.ts:56-78`

**Problema:** Cuando un agente envía un mensaje manual desde Conversaciones, el backend
no verifica si el usuario está dentro de la ventana de 24h. Si el operador responde a
una conversación vieja, el mensaje falla con error 131047 y el operador solo ve un error
genérico en el frontend (o nada, dependiendo del manejo de errores).

**Fix:** Antes de llamar `sendText()`, consultar `last_message_at` de la sesión y
retornar un 400 descriptivo si la ventana está cerrada:

```ts
const { data: session } = await supabase
  .from('conversation_sessions')
  .select('last_message_at')
  .eq('client_id', clientId)
  .eq('phone_number', phone_number)
  .single()

const lastMsg = session?.last_message_at ? new Date(session.last_message_at).getTime() : 0
if (Date.now() - lastMsg > 23.5 * 3600 * 1000) {
  return res.status(400).json({
    error: 'WINDOW_EXPIRED',
    message: 'Han pasado más de 24h desde el último mensaje del usuario. No es posible enviar texto libre.',
  })
}
```

**Impacto:** BAJO — el agente intenta enviar conscientemente, el fallo no es un riesgo
de ban en sí. Pero mejora la experiencia del operador.

---

### [WA-10] Sin deduplicación de destinatarios en reminders

**Archivo:** `chatbot/src/services/reminder.ts`

**Problema:** Si el array `phone_numbers` de un reminder contiene duplicados (error
humano al configurarlo desde el panel), el usuario recibirá el mismo mensaje dos o más
veces. Un usuario que recibe el mismo mensaje duplicado tiene más probabilidad de
reportar el número.

**Fix:** Deduplicar antes del loop:

```ts
const recipients = [...new Set(reminder.phone_numbers ?? [])]
```

**Impacto:** BAJO — el schema DB no previene duplicados en el array `text[]`.

---

## Notas sobre Message Templates (visión a largo plazo)

Los tickets WA-01 y WA-02 tienen soluciones de emergencia que reducen el riesgo
inmediatamente (eliminar el fallback masivo, verificar ventana de 24h). Pero la
solución arquitectónica correcta para los reminders es usar **Message Templates**.

Un Message Template es un mensaje pre-aprobado por Meta con variables dinámicas:
```
Hola {{1}}, te recordamos tu cita el {{2}} a las {{3}}.
Responde CONFIRMAR para confirmar o CANCELAR para reagendar.
```

Con templates:
- Se pueden enviar fuera de la ventana de 24h (business-initiated permitido)
- Meta tiene contexto del mensaje y puede verificar que no es spam
- El número mantiene mejor calidad rating

Para implementarlos en el futuro:
1. Crear templates en Meta Business Manager → WhatsApp Manager → Message Templates
2. Agregar `sendTemplate()` a `whatsapp.ts` usando el endpoint de mensajes con `type: 'template'`
3. Asociar cada reminder a un template aprobado en lugar de texto libre

Esto es trabajo significativo que requiere pasar por el proceso de aprobación de Meta,
por lo que se deja como deuda futura documentada.
