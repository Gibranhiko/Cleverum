# Devplan — Robustez del bot de citas (v2)

> Continuación de `docs/devplan-citas.md`. Aborda 3 problemas observados en pruebas:
> 1. La IA **improvisa flujos** (ej. "reagendar") que no existen → confunde.
> 2. No existe **reagendar / cancelar** una cita.
> 3. No hay manejo de **citas vencidas** (lifecycle) ni recordatorios.

---

## 1. Diagnóstico del problema actual

El routing de `infoBot` usa IA (`determineIntent`) para decidir qué hacer con texto libre:
- `saludo` → menú
- `agendar_cita` → flujo de citas
- `consultar_*` → FAQ
- **`hablar` → talker (IA libre)** ← el hueco

Cuando el usuario escribe algo que no es saludo claro (ej. *"hola necesito hacer un cambio"*),
cae en `hablar` → el **talker improvisa** una conversación de reagendar (que no existe como
flujo real), pide datos, y nunca concreta nada. Evidencia en el transcript de prueba.

**Causa raíz:** dar a la IA la decisión de routing. La filosofía del proyecto (CLAUDE.md) es
*IA solo donde aporta valor real; lo demás, menús deterministas*. El routing debe ser menú.

---

## 2. Análisis de escenarios

| # | Escenario | Hoy | Deseado |
|---|---|---|---|
| A | Usuario escribe cualquier cosa fuera de flujo | IA clasifica → puede caer en talker que improvisa | **Siempre el menú** (IA no rutea) |
| B | Preguntas abiertas (FAQ) | `consultar_*` → talker+RAG | Solo dentro de la opción **"Información"** del menú |
| C | Reagendar cita | ❌ no existe (la IA lo finge) | Flujo determinista desde "Mi cita" → Cambiar horario |
| D | Cancelar cita | ❌ no existe | Flujo determinista desde "Mi cita" → Cancelar |
| E | Consultar cita (reactivo) | ✅ "Consultar mi cita" lista próximas | Mejorar: mostrar con botones de acción |
| F | Recordatorio proactivo ("tu cita es mañana") | ❌ | Depende de **F6 (plantillas WhatsApp)** — ver §4 |
| G | Citas vencidas (panel) | Quedan como `nueva`/`confirmada` por siempre | Cron las pasa a `completada`/`no_asistio` |
| H | Slots/días vencidos | ✅ `computeFreeSlots` ya filtra por lead-time/now | (ok) |
| I | "Consultar mi cita" trae vencidas | ✅ `getUpcomingAppointments` filtra `starts_at >= now` | (ok) |

### Detalle por escenario

**A/B — Routing 100% menú.** Quitar `determineIntent` del ruteo. Regla:
- ¿Comando `menu`? → menú.
- ¿En flujo `appointment`? → continuar pasos.
- ¿En flujo `faq`? → talker + RAG (única vía donde la IA responde libre).
- ¿Tap de opción `menu_*`? → rutear.
- **Cualquier otra cosa → menú** (con mascot la 1ª vez).

Resultado: la IA ya **no decide nada de routing**. Solo responde preguntas cuando el usuario
**eligió "Información"**. Más barato (sin llamada de intent por mensaje), determinista, sin
improvisar. Trade-off aceptado: el usuario tapea en vez de "lenguaje natural" para navegar.

**C — Reagendar.** Desde "Mi cita": mostrar la próxima cita + botones `[🕐 Cambiar horario]`
`[❌ Cancelar]`. "Cambiar" reusa `picking_day → picking_slot → confirmar`, y al confirmar:
1. Re-check del nuevo slot.
2. `update` de la fila (`starts_at`, `ends_at`, `status_history`).
3. Mover el evento en Calendar (`updateEvent` por `calendar_event_id`, o delete+create).
El `unique index (client_id, starts_at)` lo permite porque es **la misma fila** (cambia su
`starts_at`). El slot viejo queda libre automáticamente.
- Edge: 0 citas → "no tienes citas próximas"; varias → lista para elegir cuál.

**D — Cancelar.** Desde "Mi cita" → `[❌ Cancelar]` → confirmación (botones Sí/No) →
`status='cancelada'` + **borrar evento de Calendar** (`deleteEvent`) → libera el slot (el
unique index excluye `cancelada`). 

**F — Recordatorio proactivo.** Mandar "tu cita es mañana" es un **mensaje outbound fuera de
la ventana de 24h** → **requiere plantilla aprobada de WhatsApp (F6, pendiente)**. No se puede
hacer con texto libre sin arriesgar baneo (ver `docs/whatsapp-compliance.md`). Ya existe el
`reminder.ts` cron; se puede **preparar** la lógica (qué citas recordar y cuándo) pero el
**envío** queda bloqueado hasta F6. → Se documenta, no se implementa el envío aún.

**G — Lifecycle / expiración.** Cron (reusa `node-cron`, ya activo) cada X min:
- `confirmada` con `ends_at < now` → `completada`.
- `nueva` con `ends_at < now` → `no_asistio` (nunca se confirmó/atendió).
Mantiene el panel "Citas" limpio y los tabs con sentido. Sin tocar Calendar (histórico).

---

## 3. Modelo de datos — cambios

- `appointments`: sin columnas nuevas. Se usan `calendar_event_id` (ya existe) para
  reagendar/cancelar, y `status` (`nueva|confirmada|completada|cancelada|no_asistio`).
- (Opcional) índice ya cubierto por `idx_appointments_client_start`.

---

## 4. Cambios en código

### Backend — `chatbot/`
1. **`infoBot.ts` — routing 100% menú:**
   - Quitar el bloque de `determineIntent` y los casos `agendar_cita/saludo/consultar_*/hablar`.
   - Fuera de flujo → `sendInfoMenu`. FAQ como `flow_step='faq'` que manda el texto al talker+RAG.
   - El menú gana opciones: la actual "Información" entra a `faq`; "Consultar mi cita" pasa a
     "**Mi cita**" (consulta + acciones Cambiar/Cancelar).
2. **`googleCalendar.ts` — métodos nuevos:**
   - `deleteEvent(eventId)` — para cancelar.
   - `updateEvent(eventId, newStart)` — para reagendar (o delete+create).
3. **`lib/appointments.ts`:**
   - `rescheduleAppointment(apptId, newSlotStart)` — re-check + update DB + mover Calendar.
   - `cancelAppointment(apptId)` — status=cancelada + deleteEvent.
   - `expirePastAppointments()` — el job del cron (G).
4. **`reminder.ts` / nuevo cron:** registrar `expirePastAppointments` cada 30 min.
5. **`prompts/`:** se puede **eliminar** `prompt-discriminator.txt` (ya no se rutea con IA).
   El talker (`prompt-talker.txt`) se mantiene solo para FAQ.

### Frontend — `frontend/`
- Sin cambios obligatorios. (El panel ya muestra estados; con el cron G se llenan
  `completada`/`no_asistio` solos.)

---

## 5. Plan por fases (orden sugerido)

| Fase | Qué | Impacto / riesgo |
|---|---|---|
| **1** | **Routing 100% menú** (quitar IA del ruteo; FAQ como flow_step) | 🔥 Alto impacto, bajo riesgo. **Arregla el bug actual.** |
| **2** | `deleteEvent` + flujo **Cancelar** desde "Mi cita" | Medio (toca Calendar) |
| **3** | `updateEvent` + flujo **Reagendar** | Medio (toca Calendar + re-check) |
| **4** | Cron **expiración** (lifecycle de citas vencidas) | Bajo |
| **5** | Recordatorios proactivos — **bloqueado por F6** (plantillas). Solo dejar la lógica lista. | Bloqueado |

Entregable de mayor valor inmediato: **Fase 1** (mata el problema de la IA improvisando) +
**Fase 4** (limpieza de vencidas). Fases 2-3 dan el reagendar/cancelar que el usuario pidió.

---

## 6. Decisiones abiertas
- **R1 — Menú:** ¿"Mi cita" reemplaza a "Consultar mi cita" e incluye los botones
  Cambiar/Cancelar? (recomendado) ¿o se dejan como opciones separadas?
- **R2 — Reagendar Calendar:** ¿`updateEvent` (patch del evento) o `delete + create` nuevo?
  (patch conserva el ID; delete+create es más simple). Recomiendo patch.
- **R3 — Estado de vencidas sin confirmar:** ¿`no_asistio` o un nuevo `expirada`?
  Recomiendo `no_asistio` (ya existe en el check) para no migrar el enum.
- **R4 — Recordatorios:** ¿esperamos a F6 (plantillas) o se deja totalmente fuera por ahora?
