# Cleverum — Tech Debt: Supabase / Backend Performance

> Tickets identificados durante desarrollo y pruebas de integración.
> Ordenados por impacto en rendimiento y estabilidad.

---

## Resumen de tickets

| ID | Descripción | Severidad | Área | Estado |
|---|---|---|---|---|
| SB-01 | Session cache se invalida en cada mensaje | MEDIA | Session / DB | ✅ Resuelto |
| SB-02 | RAG query sin augmentación de contexto del cliente | BAJA | RAG | ✅ Resuelto |
| SB-03 | match_chunks threshold hardcodeado en SQL function default | BAJA | RAG | ✅ Resuelto |

---

## SB-01 — Session cache se invalida en cada mensaje

**Severidad:** MEDIA  
**Área:** `chatbot/src/lib/session.ts`

### Problema

`updateSession()` llama `cache.delete(k)` antes de escribir a Supabase. Como `appendToHistory()` internamente llama `updateSession()`, cada mensaje entrante invalida el cache al menos una vez. Esto significa que en un flujo normal de conversación, prácticamente cada operación hace un round-trip a Supabase en lugar de leer del cache en memoria.

```
Mensaje recibido
  → getSession()       ← cache miss (upsert a Supabase)
  → cache hit posible en la misma request
  → appendToHistory()
    → getSession()     ← puede ser cache hit
    → updateSession()  ← borra el cache
  → siguiente mensaje  ← siempre cache miss
```

### Impacto actual

- 2-4 queries a Supabase por mensaje recibido en lugar de 1
- Latencia acumulada de ~50-150ms por mensaje
- A bajo volumen (< 100 mensajes/día) no hay problema práctico
- A volumen medio/alto puede causar conexiones concurrentes excesivas a Supabase

### Solución propuesta

En lugar de invalidar el cache al escribir, actualizar el cache en memoria con el nuevo estado:

```ts
export async function updateSession(clientId: string, phone: string, updates: Partial<Session>) {
  const k = key(clientId, phone)
  
  // Actualizar cache en lugar de borrarlo
  const cached = cache.get(k)
  if (cached) {
    cache.set(k, {
      session: { ...cached.session, ...updates },
      expires: Date.now() + TTL,
    })
  }

  await supabase
    .from('conversation_sessions')
    .update({ ...updates, last_message_at: new Date().toISOString() })
    .eq('client_id', clientId)
    .eq('phone_number', phone)
}
```

### Consideraciones

- El cache es in-memory por instancia. Si Railway escala a múltiples instancias, el cache puede estar desincronizado entre ellas. Para una sola instancia (configuración actual) es seguro.
- Si se añade escalado horizontal en el futuro, migrar a Redis o eliminar el cache completamente.

---

## SB-02 — RAG query sin augmentación de contexto del cliente ✅ Resuelto

**Severidad:** BAJA  
**Área:** `chatbot/src/flows/infoBot.ts`, `leadsBot.ts`

### Problema

El query de RAG usaba solo el texto del usuario (`text`) para buscar chunks. Como todos los chunks del documento contienen el nombre de la empresa, queries genéricas como "¿en qué horario abren?" o "¿qué productos venden?" retornaban 0 resultados porque no incluían el nombre del cliente.

### Solución aplicada

Se augmenta el query con el nombre de la empresa antes de buscar:

```ts
const ragQuery = `${text} ${client.company_name ?? ''}`
const ragContext = await getRagContext(ragQuery, clientId)
```

Esto convierte "¿en qué horario abren?" en "¿en qué horario abren? Gorditas Doña Tota", que sí matchea los chunks correctamente.

---

## SB-03 — match_chunks threshold hardcodeado en SQL function default

**Severidad:** BAJA  
**Área:** `supabase/migrations/001_initial_schema.sql`

### Problema

La función `match_chunks` en Supabase tiene `match_threshold float default 0.75` hardcodeado en la definición SQL. El código del chatbot pasa su propio threshold (actualmente `0.5`), pero si alguien llama la función sin pasar ese parámetro, usará 0.75 que es demasiado restrictivo para queries conversacionales.

### Solución propuesta

Actualizar el default en la función SQL vía migration:

```sql
CREATE OR REPLACE FUNCTION match_chunks(
  query_embedding vector(1536),
  client_id_filter uuid,
  match_threshold float default 0.5,
  match_count int default 4
)
...
```

### Consideraciones

Requiere ejecutar una migration en Supabase. Bajo riesgo — solo cambia el valor default, no la lógica.
