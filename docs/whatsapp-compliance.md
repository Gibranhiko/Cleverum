# Cleverum — WhatsApp Compliance & Outbound Templates

> Playbook operativo + devplan técnico para asegurar que todos los mensajes outbound (proactivos del negocio al cliente final) cumplen con las políticas de Meta WhatsApp Business Platform.
>
> Documento vivo: actualizar cuando Meta cambie pricing o políticas (cada 3-6 meses revisar).

---

## 1. ¿Por qué esto importa?

Si Meta detecta abuso, escalación de penalizaciones:

| Severidad | Consecuencia |
|---|---|
| Quality rating baja a Yellow | Cap diario reducido (ej: de 1000 a 250 conversaciones outbound/24h) |
| Quality rating baja a Red | Cap reducido a casi cero. Todas las nuevas iniciaciones de conversación bloqueadas |
| Reincidencia | Suspensión del número permanente |
| Violación grave (spam masivo, contenido prohibido) | Suspensión de toda la cuenta de Business Manager |

**No es algo que se arregle pidiendo perdón.** Una vez suspendido, recuperar el número toma semanas y a veces no se puede. Y un cliente final puede reportar tu número → tres reportes en una ventana corta = Yellow inmediato.

---

## 2. Las 4 categorías de mensajes y su costo

### Service (gratis)
- Cliente inicia conversación
- Bot responde dentro de ventana 24h
- **Sin costo, sin template requerido**

### Utility
- Negocio inicia, contenido transaccional sobre algo que YA pasó
- Ejemplos: "Tu orden está lista", "Tu cita es mañana", "Tu pago fue recibido"
- **Costo MX:** ~$0.005-0.01 USD por conversación
- **Requiere template aprobado**

### Marketing
- Negocio inicia, contenido promocional o de retención
- Ejemplos: "20% de descuento esta semana", "Vuelve a visitarnos", "Encuesta de satisfacción"
- **Costo MX:** ~$0.04-0.08 USD por conversación (8x más que utility)
- **Requiere template aprobado + opt-in explícito del cliente**

### Authentication
- Solo OTPs / códigos de verificación
- Ejemplos: "Tu código es 123456"
- **Costo MX:** ~$0.001 USD por conversación
- **No aplica para Cleverum por ahora** (no hacemos auth)

### Trampa común: re-categorización automática

Si mandas un mensaje categorizado como Utility pero Meta lo lee como promocional, te lo **re-clasifica a Marketing y te cobra retroactivo**. Además baja tu quality rating.

**Regla de oro:** si el mensaje no es estrictamente sobre **algo que ya ocurrió** o **un trámite específico ya iniciado**, es Marketing.

| Mensaje | Categoría correcta |
|---|---|
| "Tu cotización para iPhone 12 está lista: $2000" | Utility ✓ |
| "Tu equipo está listo para recoger" | Utility ✓ |
| "Recordatorio: tu cita es mañana 10am" | Utility ✓ |
| "Tenemos descuento en pantallas iPhone" | Marketing |
| "Hace tiempo no nos visitas, ¿en qué podemos ayudarte?" | Marketing |
| "¿Cómo te pareció el servicio? Califícanos" | Marketing |

---

## 3. Las 4 capas de compliance

### Capa 1 — Templates aprobados antes de cualquier outbound
Toda función que mande mensajes proactivos **debe** referenciar un template aprobado por Meta. Templates se gestionan desde Meta Business Manager (manual) o vía Meta Graph API (automático).

### Capa 2 — Enforcement layer en código
Tabla `whatsapp_templates` en DB con status del template. Función `sendTemplateMessage()` valida antes de mandar:
- Template existe y está `approved`
- Cliente final no está en opt-out
- Throttle no excedido
- Quality del número no es Red

Si cualquier check falla → bloquear envío y loggear.

### Capa 3 — Throttling + opt-in/out
Reglas duras codificadas:
- Cliente con `bot_disabled_for_user=true` → 0 outbounds, jamás
- Por ticket: máximo N notificaciones por orden (proponer N=5)
- Por cliente final: máximo M conversaciones outbound por mes (proponer M=10)
- Cooldown entre mensajes del mismo template al mismo cliente: 4h mínimo
- Solo notificar cambios significativos (no cada edición intermedia)

### Capa 4 — Monitoreo y auto-pausa
Webhooks de Meta (`phone_number_quality_update`, `account_alerts`) ya llegan al webhook handler pero solo se loggean.

Necesitamos:
- Persistir en DB
- Alertar al super_admin cuando quality baja a Yellow
- Auto-pausa de todos los outbounds cuando quality es Red
- Dashboard de quality + costos

---

## 4. Reglas operativas (super_admin)

### Pre-send checklist (antes de habilitar un template nuevo)
- [ ] La categoría del template matchea el contenido real (Utility para transaccional, Marketing para promo)
- [ ] El template está aprobado por Meta (status `approved`)
- [ ] Las variables del template tienen valores válidos para todos los casos esperados
- [ ] Hice prueba con número propio antes de habilitarlo en producción
- [ ] El template tiene opt-out hint si es marketing ("Responde STOP para dejar de recibir")

### Monthly audit checklist (revisar primer día de cada mes)
- [ ] Quality rating del número (debe estar Green)
- [ ] Costo del mes anterior (vs estimado y vs presupuesto)
- [ ] Templates rechazados o pausados — investigar por qué
- [ ] Total de outbound vs inbound (ratio razonable)
- [ ] Quejas / opt-outs del último mes

### What NOT to do
- ❌ Mandar mismo mensaje a lista grande sin templates (= spam masivo)
- ❌ Usar Utility para contenido promocional para ahorrar costos
- ❌ Mandar fuera de horario (8am-9pm zona horaria del cliente)
- ❌ Notificar cambios de status no relevantes (cliente no quiere saber que pasó de "diagnóstico" a "diagnóstico extendido")
- ❌ Ignorar opt-outs (legalmente y por compliance Meta)
- ❌ Hard-codear textos de mensajes outbound en código (siempre vía template)

---

## 5. Templates iniciales a someter en Meta

### Para bot `servicios` (DTR + futuros talleres)

**ticket_diagnostico_listo** (Utility, español MX)
```
Hola {{1}}, tu equipo {{2}} ha sido diagnosticado. En breve recibirás la cotización con el costo del servicio.

— {{3}}
```
Variables: `1=customer_name, 2=device, 3=company_name`

**ticket_cotizacion_lista** (Utility, español MX)
```
Hola {{1}}, tu cotización para {{2}} está lista:

💵 Total: ${{3}} MXN
📋 Folio: {{4}}

Responde *SI* si autorizas la reparación o *NO* si prefieres no proceder.
```
Variables: `1=name, 2=device, 3=quote_amount, 4=folio`

**ticket_aprobado** (Utility, español MX)
```
Recibido, {{1}}. Iniciamos la reparación de tu {{2}}. Te avisamos en cuanto esté listo.

— {{3}}
```

**ticket_listo_recoger** (Utility, español MX)
```
✅ ¡Buenas noticias, {{1}}! Tu {{2}} está listo para recoger.

📍 {{3}}
🕐 Horario: {{4}}
📋 Folio: {{5}}

Te esperamos.
```

**ticket_recordatorio_recoger** (Utility, español MX)
```
Hola {{1}}, te recordamos que tu {{2}} sigue listo para recoger desde hace {{3}} días. Pasa por él cuando puedas.

— {{4}}
```

### Para bot `informativo` (citas)

**cita_recordatorio_24h** (Utility, español MX)
```
Hola {{1}}, te recordamos tu cita mañana:

📅 {{2}} a las {{3}}
📍 {{4}}

Si no puedes asistir, responde *CANCELAR*.
```

**cita_recordatorio_2h** (Utility, español MX)
```
Hola {{1}}, tu cita es en 2 horas:

🕐 {{2}}
📍 {{3}}

Te esperamos.
```

### Reminders genéricos (existentes)
Los reminders actuales mandan mensajes hard-coded — **viola la regla "no hard-coded outbound"**. Hay que migrarlos a templates antes de seguir usándolos en producción.

---

## 6. Devplan — Epic F: Compliance Layer

### F-01 — DB schema para templates y log de outbounds

**Files:**
- `supabase/migrations/006_whatsapp_compliance.sql` (nuevo)

**Acceptance:**
```sql
create table whatsapp_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  category text not null check (category in ('utility', 'marketing', 'authentication')),
  language text not null default 'es_MX',
  body text not null,
  variables_count int default 0,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'paused', 'disabled')),
  meta_template_id text,            -- ID en Meta para sync
  rejection_reason text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table outbound_log (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  customer_phone text not null,
  template_name text not null,
  template_category text not null,
  ticket_id uuid references tickets(id) on delete set null,
  variables jsonb,
  meta_message_id text,
  status text default 'sent' check (status in ('sent', 'delivered', 'read', 'failed')),
  error_message text,
  created_at timestamptz default now()
);

create index idx_outbound_log_client on outbound_log(client_id, created_at desc);
create index idx_outbound_log_phone on outbound_log(client_id, customer_phone, created_at desc);

create table phone_quality_events (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references clients(id) on delete cascade,
  phone_number_id text not null,
  event_type text not null,           -- 'quality_update', 'account_alert', etc
  quality_rating text,                 -- 'GREEN', 'YELLOW', 'RED'
  current_limit text,                  -- 'TIER_1K', 'TIER_10K', etc
  raw_payload jsonb,
  created_at timestamptz default now()
);
```

RLS: multi_tenant_access pattern (igual que tickets).

**Effort:** 0.5d

---

### F-02 — Sync de templates con Meta Graph API

**Files:**
- `chatbot/src/services/metaTemplates.ts` (nuevo)
- `chatbot/src/routes/admin.ts` — agregar endpoints para CRUD de templates

**Acceptance:**
- Función `syncTemplatesFromMeta(client)` consulta `GET /v20.0/{whatsapp_business_account_id}/message_templates` y refresca tabla local
- Endpoint `POST /admin/templates/sync` triggera el sync manualmente
- Campo `meta_template_id` poblado para vinculación
- Status mapeado de Meta (`APPROVED` → `approved`, `REJECTED` → `rejected`, etc.)
- Error handling: si Meta no devuelve un template que tenemos en local → marcar `disabled`

**Effort:** 1d

---

### F-03 — Enforcement layer `sendTemplateMessage`

**Files:**
- `chatbot/src/lib/whatsapp.ts` — agregar función
- `chatbot/src/lib/compliance.ts` (nuevo) — checks de compliance

**Acceptance:**

```ts
export async function sendTemplateMessage(args: {
  client: ClientRow
  to: string                    // customer phone
  templateName: string
  variables: Record<string, string>
  ticketId?: string
}): Promise<{ ok: boolean; error?: string }> {
  // 1. Resolver template en DB
  // 2. Si status !== 'approved' → block + log error
  // 3. Si quality_rating === 'RED' → block + log error
  // 4. Check opt-out (conversation_sessions.bot_disabled_for_user)
  // 5. Check throttle (compliance.ts):
  //    - Por ticket: count outbound_log where ticket_id=X < 5
  //    - Por cliente final: count outbound_log where customer_phone=X y created_at>=this_month < 10
  //    - Cooldown: count outbound_log where template+phone < 4h ago === 0
  // 6. Construir payload de WhatsApp template message
  // 7. Enviar via axios a Graph API
  // 8. Log en outbound_log
}
```

Toda función futura que necesite mandar outbound **debe usar esta función**, no `sendText` directamente.

**Effort:** 1.5d

---

### F-04 — Migrar reminders existentes a usar templates

**Files:**
- `chatbot/src/services/reminder.ts` — refactor

**Acceptance:**
- Reminders ya no usan texto hard-coded
- Cada reminder referencia un `template_name`
- Si el template no está aprobado → reminder no dispara (log warning)
- Frontend de reminders permite seleccionar template aprobado

**Effort:** 0.75d

---

### F-05 — Procesar webhooks de quality y account alerts

**Files:**
- `chatbot/src/webhook/handler.ts` — extender

**Acceptance:**
- Eventos `phone_number_quality_update` se persisten en `phone_quality_events`
- Eventos `account_alerts` también
- Si `current_limit` cambia o `quality_rating` baja → log `[Meta Quality] CRITICAL`
- (Opcional) Notificar al super_admin via email o slack webhook

**Effort:** 0.5d

---

### F-06 — Auto-pausa cuando quality es Red

**Files:**
- `chatbot/src/lib/compliance.ts`

**Acceptance:**
- Función `isQualityHealthy(clientId)` consulta el último evento de quality
- Si `quality_rating === 'RED'` o `current_limit === 'TIER_50'` (banned) → retornar false
- `sendTemplateMessage` consulta esta función antes de enviar
- Cuando llega webhook con quality recuperado, los outbounds se reanudan automáticamente
- Banner en panel admin: "Tu número WhatsApp tiene calidad RED. Outbounds pausados."

**Effort:** 0.5d

---

### F-07 — Página Templates en panel admin

**Files:**
- `frontend/src/pages/Templates.tsx` (nueva)
- `frontend/src/components/TemplateModal.tsx` (nueva)

**Acceptance:**
- Lista de templates por cliente con: name, category, status badge, language, last sync
- Botón "Sincronizar con Meta" → llama F-02
- Click en template → modal con preview del body + variables esperadas
- Page key `templates` agregado a permissions.ts (super_admin only)

**Effort:** 1d

---

### F-08 — Cost tracking dashboard

**Files:**
- `frontend/src/pages/Dashboard.tsx` — extender
- `chatbot/src/routes/admin.ts` — endpoint `/admin/usage`

**Acceptance:**
- Dashboard del super_admin muestra:
  - Total outbound del mes actual por cliente
  - Costo estimado (utility * tarifa + marketing * tarifa)
  - Quality rating actual
  - Top 5 customers que más mensajes outbound recibieron (detectar abuso)
- Endpoint `/admin/usage?from=&to=&clientId=` retorna agregados

**Effort:** 1d

---

### Resumen de esfuerzo Epic F

| Ticket | Effort |
|---|---|
| F-01 — DB schema | 0.5d |
| F-02 — Sync Meta templates | 1d |
| F-03 — sendTemplateMessage enforcement | 1.5d |
| F-04 — Migrar reminders | 0.75d |
| F-05 — Webhook processing | 0.5d |
| F-06 — Auto-pausa Red | 0.5d |
| F-07 — Página Templates | 1d |
| F-08 — Cost dashboard | 1d |
| **Total** | **6.75d** ≈ **2 semanas** |

---

## 7. Orden de ejecución

1. **F-01 + F-03** primero — schema + enforcement layer base
2. **F-02** — sync con Meta (necesita que ya tengas templates pending)
3. **F-05 + F-06** — monitoring y auto-pausa
4. **F-07** — UI para que super_admin vea estado de templates
5. **F-04** — migrar reminders (después de tener todo el resto)
6. **F-08** — dashboard de costos

**Pre-trabajo manual antes de F-04:**
- Crear los 7 templates de la sección 5 en Meta Business Manager
- Esperar aprobación (1-24h por template)
- Sin esto, F-04 no puede ejecutarse

---

## 8. Riesgos & mitigaciones

| Riesgo | Mitigación |
|---|---|
| Templates se cuelgan en `pending` forever | F-07 muestra status en UI; si > 48h sin aprobar, alert |
| Meta rechaza un template por contenido | Iterar texto, re-someter; documentar razón en `rejection_reason` |
| Throttle muy agresivo bloquea legítimos | Hacer límites configurables por cliente desde panel |
| Auto-pausa por Red bloquea durante operación crítica | Permite override manual desde panel admin con justificación |
| Costo se dispara | F-08 alertas en dashboard cuando un cliente excede X% del mes anterior |
| Cliente final spamea bot para abrir ventana 24h gratis | Throttle por phone para outbounds independiente del estado de la ventana |

---

## 9. Out of scope

- A/B testing de templates
- Localización a otros idiomas (solo es_MX por ahora)
- Templates dinámicos generados por IA (Meta no lo permite — tiene que ser pre-aprobado)
- Marketing automation (drip campaigns, segmentación) — explícitamente fuera de alcance, riesgo alto de violación
- Integración con CDP / herramientas de marketing externas

---

## 10. Referencias

- [WhatsApp Business Pricing — Meta](https://developers.facebook.com/docs/whatsapp/pricing)
- [Message Template Guidelines](https://developers.facebook.com/docs/whatsapp/business-management-api/message-templates)
- [Quality Rating](https://developers.facebook.com/docs/whatsapp/cloud-api/phone-numbers/quality-rating-and-status)
- [WhatsApp Business Policy](https://www.whatsapp.com/legal/business-policy/)
