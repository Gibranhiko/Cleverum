# Cleverum — Tech Debt: Architecture

> Tickets de arquitectura / patrones que se repiten y generan mantenimiento.
> Cosas que no son bugs, pero hacen que cada cambio cueste más de lo que debería.

---

## Resumen de tickets

| ID | Descripción | Severidad | Área | Estado |
|---|---|---|---|---|
| ARCH-01 | Tipos de DB duplicados entre pages y modales del frontend | MEDIA | `frontend/src` | ⏳ Pendiente |

---

## ARCH-01 — Tipos de DB duplicados entre pages y modales

**Severidad:** MEDIA
**Área:** `frontend/src/pages/*.tsx` + `frontend/src/components/*Modal.tsx`

### Problema

El mismo tipo (`Cliente`, `Servicio`, `Producto`, etc.) está definido **independientemente** en al menos 2 lugares por entidad:
- En la `page` (lista, fetcheo, render de tabla)
- En el `Modal` (form de edición)

Y a veces también en una tercera capa (ej: `chatbot/src/types/index.ts` para el backend).

Cada vez que se agrega una columna al schema (ej: `mascot_name`, `image_url`, `examples`, `ticket_prefix`), hay que actualizar:
1. La migration SQL
2. El tipo en `chatbot/src/types/index.ts` (backend)
3. El tipo en `frontend/src/components/<Entity>Modal.tsx`
4. El tipo en `frontend/src/pages/<Entity>.tsx`
5. A veces otros pages que también consumen la entidad

Si olvidas uno de los 4-5 lugares, TypeScript explota con el mensaje "Two different types with this name exist, but they are unrelated".

#### Lugares afectados detectados (mayo 2026)

```
frontend/src/pages/Clientes.tsx           — interface Cliente (full)
frontend/src/pages/ConfigBot.tsx          — interface Cliente (parcial)
frontend/src/pages/Conversaciones.tsx     — interface Cliente (mínimo: id, name)
frontend/src/pages/Documentos.tsx         — interface Cliente
frontend/src/pages/Leads.tsx              — interface Cliente
frontend/src/pages/Pedidos.tsx            — interface Cliente
frontend/src/pages/Productos.tsx          — interface Cliente
frontend/src/pages/Reminders.tsx          — interface Cliente (mínimo)
frontend/src/pages/Servicios.tsx          — interface Cliente + interface Servicio
frontend/src/pages/Tickets.tsx            — interface Cliente
frontend/src/components/ClienteModal.tsx  — interface Cliente (full)
frontend/src/components/ServicioModal.tsx — interface Servicio (full)
frontend/src/components/ProductoModal.tsx — interface Producto (full)
... y más por venir cuando crezca el modelo
```

### Solución propuesta

Crear `frontend/src/types/db.ts` con tipos centralizados que matcheen el schema:

```ts
// frontend/src/types/db.ts
export interface DbClient {
  id: string
  company_name: string
  company_type: string | null
  company_email: string | null
  company_address: string | null
  admin_name: string | null
  whatsapp_phone: string | null
  bot_type: 'informativo' | 'catalogo' | 'leads' | 'servicios'
  bot_active: boolean
  is_active: boolean
  facebook_link: string | null
  instagram_link: string | null
  image_url: string | null
  google_calendar_id: string | null
  google_calendar_key_url: string | null
  wa_phone_number_id: string | null
  wa_access_token: string | null
  ticket_prefix: string | null
  ticket_counter: number
  mascot_name: string | null
  mascot_image_url: string | null
  created_at: string
  updated_at: string
}

export interface DbService {
  id: string
  client_id: string
  name: string
  description: string | null
  category: string | null
  price_amount: number | null
  price_label: string | null
  estimated_duration: string | null
  examples: string | null
  image_url: string | null
  is_active: boolean
  display_order: number
}

export interface DbProduct { ... }
export interface DbTicket { ... }
// etc.
```

Después en cada page/modal:
```ts
import type { DbClient } from '@/types/db'

// Para listas que solo necesitan algunos campos:
type ClientListItem = Pick<DbClient, 'id' | 'company_name' | 'bot_type'>

// Para forms que omiten campos auto-managed:
type ClientFormData = Omit<DbClient, 'id' | 'created_at' | 'updated_at'> & { id?: string }
```

### Beneficio

- Una sola fuente de verdad por entidad en el frontend
- Agregar una columna → tocas 1 archivo (db.ts) en vez de 4-5
- TypeScript previene drift: si la columna no está en `DbClient`, no se puede usar en ninguna page
- Patrones reutilizables (Pick, Omit) para subsetting cuando una page no necesita todo

### Effort

- Crear `types/db.ts` con tipos para Client, Service, Product, Ticket, Lead, Order, Reminder, Document, UserProfile (~30 min)
- Refactorizar las 10+ pages/modales para importar desde ahí (~45 min)
- Validar que todo compila (~10 min)
- **Total: ~1.5 hrs**

### Riesgo

- **Bajo.** El tipo es metadata — no cambia comportamiento runtime
- TypeScript te dice exactamente dónde rompe si algo no matchea
- Se puede hacer incremental (entidad por entidad)

### Bonus: sincronización con backend

El `chatbot/src/types/index.ts` también tiene `ClientRow`, `TicketRow`, `ServiceRow` con los mismos campos. Largo plazo se podría:

1. Extraer `shared/types.ts` en la raíz del monorepo
2. Importar desde frontend Y chatbot
3. Tener UN solo lugar para tipos de DB en todo el repo

Eso es un refactor mayor (~3-4 hrs incluyendo configurar paths del workspace), pero elimina TODA la duplicación de tipos entre frontend y backend. Lo dejaría para cuando ya no sople tan raro tener `DbClient` (frontend) vs `ClientRow` (backend) con casi los mismos campos.

### Cuándo hacerlo

No es urgente. Es trabajo de **higiene** que paga dividendos en sprints siguientes. Buen candidato para un día de baja carga o como parte de una sesión de refactor cuando agregues una nueva entidad grande (sería natural definir el tipo en `db.ts` desde el inicio).

**Trigger sugerido:** cuando agregues una columna nueva y tengas que tocar 4+ archivos otra vez, ese es el momento.
