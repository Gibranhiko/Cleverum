# Devplan — Mejorar la sección "Conversaciones"

> Objetivo: que el operador (super_admin o user-cliente) entienda y use bien el historial
> de chats. Hoy muestra IDs internos y jerga de dev.

---

## 1. Diagnóstico (qué hay hoy)

**Página** `Conversaciones.tsx`: selector de cliente, lista de sesiones (últimos 7 días /
"mostrar todas"), realtime sobre `conversation_sessions`. Panel derecho `ChatPanel`:
burbujas (cliente izq / bot der), badges de flujo, toggles takeover/silenciar bot, caja de
respuesta (solo en takeover), y un JSON de estado (debug).

### Problemas detectados
| # | Problema | Impacto |
|---|---|---|
| P1 | **IDs crudos en el historial** (`svc_2`, `day_2026-06-02`, `menu_cita`, `slot_...`, `confirm_yes`) | 🔴 El operador no entiende qué hizo el cliente |
| P2 | **Solo el número** identifica la conversación (`5215541433545`) | 🟡 No sabes quién es sin abrir |
| P3 | **Jerga de dev** en badges (`appointment · picking_slot`) en lista y header | 🟡 Confunde al operador |
| P4 | **Mensajes multimedia se pierden** (imagen/audio del cliente se ignoran, ni se loguean) | 🟡 El operador queda ciego ante "te mandé una foto" |
| P5 | **Historial capado a 10 mensajes** (`appendToHistory` MAX=10, para contexto de IA) | 🟡 No hay log completo de la conversación |
| P6 | **Sin timestamps por mensaje** (`HistoryMsg = {role, content}`) | 🟢 No se ve a qué hora |
| P7 | **JSON de estado (debug)** visible para cualquier operador | 🟢 Ruido para no-técnicos |

### Lo que SÍ está bien (no tocar)
- Respuestas del operador en takeover **sí** se guardan en historial (`/bots/:id/send`).
- Realtime, toggles de takeover/silenciar, filtro de 7 días, typing indicator.

---

## 2. Plan por fases

### Fase 1 — Legibilidad: títulos en vez de IDs  🔴 (lo crítico)
- **Webhook** (`handler.ts`): al procesar un `interactive`, capturar el **`title`** del tap
  (`list_reply.title` / `button_reply.title`) y guardarlo en el historial. El **`id` se sigue
  usando para rutear** (`ctx.text`), solo cambia lo que se persiste como mensaje del cliente.
- Resultado: el panel muestra "Consulta Pediátrica", "martes 2 de junio", "📅 Agendar cita",
  "09:00", "✅ Confirmar" — legible.
- También mejora el **contexto de la IA** en FAQ (ya no ve `svc_2`).
- Edge: el historial **viejo** ya tiene IDs; no se reescribe (solo lo nuevo sale legible).

### Fase 2 — Identificar al cliente por nombre
- Mostrar el **nombre del cliente** (no solo el teléfono) en `SessionList` y header de `ChatPanel`.
- Fuente: `appointments.customer_name` por teléfono (o el último nombre conocido). Si no hay,
  cae al número.

### Fase 3 — Lenguaje humano en la metadata de flujo
- Mapear `current_flow`/`flow_step` a etiquetas amigables (ej. `appointment·picking_slot` →
  "Agendando cita · eligiendo horario"; `faq` → "Preguntas"; `manage_appt` → "Gestionando su cita").
- En `SessionList`, en vez de "Sin flujo", mostrar un **preview del último mensaje**.

### Fase 4 — No perder multimedia
- Cuando el cliente manda imagen/audio/documento/ubicación, **loguear un placeholder** en el
  historial (`📷 [imagen]`, `🎤 [audio]`, `📎 [archivo]`) para que el operador sepa que llegó algo.
  (El bot sigue sin procesarlo, pero deja rastro.)

### Fase 5 — (Mayor / opcional) Log completo con timestamps
- Hoy el historial vive en `conversation_sessions.history` **capado a 10** (para la IA). Para un
  registro completo y auditable con hora por mensaje, conviene una tabla **`messages`** aparte
  (insert por cada mensaje in/out). Es un cambio de modelo de datos + escrituras extra.
- Evaluar si se necesita o si con los últimos 10 basta. **Probablemente futuro.**

### Fase 6 — (Menor) Pulido
- Ocultar el JSON de "Estado de sesión (debug)" para `user` (dejarlo solo a super_admin).

---

## 3. Orden sugerido y riesgo
| Fase | Riesgo | Valor |
|---|---|---|
| 1 — Títulos | Bajo (1 cambio en webhook) | 🔥 Alto |
| 2 — Nombre | Bajo (frontend + query) | Alto |
| 3 — Etiquetas | Bajo (frontend) | Medio |
| 4 — Multimedia | Bajo (webhook) | Medio |
| 5 — Tabla messages | Alto (modelo de datos) | Medio (auditoría) |
| 6 — Ocultar debug | Trivial | Bajo |

Entregable de mayor impacto inmediato: **Fase 1** (resuelve el problema que viste) + **Fase 2**.

---

## 4. Decisiones a validar
- **R1** — ¿Fase 1 (títulos) primero, sola, para validar rápido? (recomendado)
- **R2** — ¿Mostrar nombre del cliente en la lista/header? (Fase 2)
- **R3** — Metadata de flujo: ¿etiquetas amigables, o moverla a "debug" y mostrar preview del último mensaje?
- **R4** — Multimedia: ¿loguear placeholder `[imagen]`/`[audio]`? (Fase 4)
- **R5** — ¿Log completo con tabla `messages` ahora o futuro?
