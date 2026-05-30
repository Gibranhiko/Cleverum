# Tech Debt — Vulnerabilidades de dependencias (Dependabot)

> ## ✅ RESUELTO (2026-05-30) — rama `fix/dep-vulns`
> `npm audit` → **0 vulnerabilidades**. Frontend y chatbot compilan; 14 tests del motor de
> slots verdes; build del frontend OK.
>
> **Lo que se hizo:**
> 1. `npm audit fix` (no `--force`) → parchó axios*, hono, fast-uri, postcss, ip-address, qs, ws, brace-expansion.
> 2. Bumps directos en `chatbot/package.json`: `axios ^1.16.1` (audit fix se quedó corto), `googleapis ^173.0.0` y `node-cron ^4.2.1` (resuelven `uuid` vía parents — Opción A). Se quitó `@types/node-cron` (node-cron@4 trae sus tipos).
> 3. `shadcn` movido a **devDependencies** del frontend → elimina el subárbol MCP/hono/fast-uri de runtime.
> 4. Eliminado el `frontend/package-lock.json` duplicado (el monorepo usa solo el lock del root).
> 5. `npm install` regeneró el árbol → 0 vulns.
> 6. Prevención: `.github/dependabot.yml` (version-updates semanales agrupados).
>
> Pendiente opcional: `npm audit` en CI (no hay pipeline aún — ver §5).

---

> Generado a partir de 19 alertas de Dependabot (GitHub) + `npm audit` local.
> `npm audit` reporta **16 vulnerabilidades (2 high, 14 moderate)**; GitHub las cuenta
> por advisory individual (de ahí las 19).
>
> **Hallazgo clave:** la mayoría se arreglan con `npm audit fix` **sin breaking changes**.
> Solo `uuid` requiere intervención mayor. Además, `shadcn` está mal ubicado como
> dependencia de runtime y arrastra todo el subárbol vulnerable de `hono`/`fast-uri`.

---

## 1. Resumen ejecutivo

| Origen | Paquetes afectados | Alertas GitHub | Fix |
|---|---|---|---|
| **axios** (directo, chatbot) | axios | #79, #87, #94, #95, #96, #97 (6) | `npm audit fix` (no breaking) |
| **shadcn** (frontend, mal como runtime dep) → MCP SDK | hono, fast-uri | #80, #81, #82, #83, #84, #85, #86 (7) | mover shadcn a devDeps **+** `npm audit fix` |
| **express-rate-limit** (chatbot) | ip-address | #78 (1) | `npm audit fix` |
| **express / body-parser** (chatbot) | qs | #91 (1) | `npm audit fix` + actualizar override |
| **supabase-js + openai** (chatbot) | ws | #92, #93 (2) | `npm audit fix` |
| **vite / shadcn** (frontend) | postcss | #77 (1) | `npm audit fix` |
| **eslint / npm-run-all** | brace-expansion | #88 (1) | `npm audit fix` |
| **googleapis + node-cron** (chatbot) | uuid | #90 (1) | ⚠️ requiere `--force` (node-cron@4, breaking) |

**Lectura:** ~85% se resuelve con un `npm audit fix` de bajo riesgo. Los dos puntos que
piden criterio son **`uuid`** (parents con breaking changes) y **`shadcn`** (re-ubicación).

---

## 2. Inventario detallado (origen real en el árbol)

Trazado con `npm ls`:

| Paquete | Vulnerable | Parchado | Directo/Transitivo | Cadena |
|---|---|---|---|---|
| `axios` | `1.0.0–1.15.2` | siguiente `1.x` | **Directo** (`chatbot`) | `chatbot → axios` |
| `hono` | `≤4.12.17` | `>4.12.17` | Transitivo | `frontend → shadcn → @modelcontextprotocol/sdk → hono` |
| `fast-uri` | `≤3.1.1` | `>3.1.1` | Transitivo | `… → @modelcontextprotocol/sdk → ajv → fast-uri` |
| `postcss` | `<8.5.10` | `≥8.5.10` | Transitivo | `frontend → shadcn → postcss` (vite ya usa 8.5.10 ✅) |
| `ip-address` | `≤10.1.0` | `>10.1.0` | Transitivo | `chatbot → express-rate-limit → ip-address` |
| `qs` | `6.11.1–6.15.1` | `>6.15.1` | Transitivo | `chatbot → express/body-parser → qs` (override actual `>=6.14.2` quedó corto) |
| `ws` | `8.0.0–8.20.0` | `>8.20.0` | Transitivo | `chatbot → @supabase/realtime-js / openai → ws` |
| `uuid` | `<11.1.1` | `≥11.1.1` | Transitivo | `chatbot → googleapis (gaxios, googleapis-common) → uuid@9`; `node-cron → uuid@8` |
| `brace-expansion` | `5.0.2–5.0.5` | `>5.0.5` | Transitivo | `npm-run-all → minimatch → brace-expansion` |

### Observaciones de higiene
- **`shadcn` no debería ser dependencia de runtime.** Es un CLI (`npx shadcn add ...`); los
  componentes generados ya viven en `frontend/src/components/ui/`. Tenerlo en
  `dependencies` mete `@modelcontextprotocol/sdk`, `hono`, `ajv`→`fast-uri`, `postcss` a
  producción sin necesidad. **Moverlo a `devDependencies` (o quitarlo) elimina las 7
  alertas de hono + fast-uri** y reduce superficie de ataque.
- **Lockfile duplicado:** existe `frontend/package-lock.json` además del root. En un
  monorepo con workspaces el lock debe ser **solo el del root**. El stray lock provoca
  drift (la alerta de `ws` #93 viene de ahí). Eliminarlo.
- El bloque `overrides` del root ya existe y funciona; solo hay que **subir el de `qs`** y
  agregar algunos más como red de seguridad.

---

## 3. Plan de remediación (por fases, de menor a mayor riesgo)

### Fase 0 — Preparación
- Crear rama `fix/dep-vulns`.
- Confirmar baseline: `npm audit` (16 vulns), `npm run build`, `npm --workspace=chatbot run test`.

### Fase 1 — `npm audit fix` (no breaking) — resuelve ~14
```bash
npm audit fix            # NO uses --force aquí
```
Esto parcha (todas marcadas "fix available via npm audit fix"):
**axios, hono, fast-uri, postcss, ip-address (vía express-rate-limit), qs, ws, brace-expansion.**
- ✅ axios es dep directa con rango `^1.7.9` → el parche `1.x` entra solo, sin tocar `package.json`.
- Verificar después: `npm audit` debe bajar a ~1–2 vulns (solo `uuid`).

### Fase 2 — Higiene de `shadcn` (frontend)
- Mover `shadcn` de `dependencies` a `devDependencies` en `frontend/package.json`
  (o eliminarlo si ya no se usará el CLI; se puede seguir usando con `npx shadcn@latest`).
- `rm frontend/package-lock.json` (usar solo el lock del root).
- `npm install` desde el root para regenerar el árbol.
- Esto **remueve el subárbol MCP/hono/fast-uri de producción** → defensa en profundidad
  aunque `audit fix` ya los haya parchado.

### Fase 3 — `uuid` (requiere decisión, breaking)
`uuid <11.1.1` viene de `googleapis` (gaxios, googleapis-common) y `node-cron`.
`npm audit fix --force` instala **`node-cron@4.2.1`** (breaking). Dos caminos:

- **Opción A (recomendada): bump de parents + test.**
  - Subir `googleapis` a la última (trae gaxios con uuid parchado) y `node-cron` a `^4`.
  - **Probar:** los crons de [Reminders] siguen agendando; `node-cron@4` cambia detalles de
    API (validar `schedule()` y opciones). Probar el flujo de Google Calendar (gaxios).
- **Opción B: override puntual.** Agregar `"uuid": ">=11.1.1"` a `overrides`.
  - ⚠️ Riesgo: `uuid@11` es ESM-only; los consumidores CJS (`node-cron`, `gaxios`) usan
    `uuid.v4()` (estable), pero hay que **probar** que `require('uuid')` no truene en runtime.
  - Más rápido pero menos "correcto" que actualizar los parents.

### Fase 4 — Reforzar `overrides` (red de seguridad para transitivas)
En `package.json` (root), actualizar/añadir tras la Fase 1 (rellenar versiones exactas que
deje `npm audit fix`):
```jsonc
"overrides": {
  // ...existentes...
  "qs": ">=6.15.2",          // subir desde >=6.14.2 (6.15.1 sigue vulnerable)
  "ws": ">=8.18.4",          // versión parchada que reporte el advisory
  "brace-expansion": ">=2.0.2",
  "postcss": ">=8.5.10",
  "ip-address": ">=10.1.1",
  "fast-uri": ">=3.1.2",
  "hono": ">=4.12.18"
}
```
> Nota: usar los `overrides` solo para lo que `audit fix` no resuelva por sí solo, para no
> "congelar" versiones innecesariamente. Verificar números exactos contra cada advisory.

### Fase 5 — Verificación
- `npm audit` → **0 vulnerabilidades** (o solo informativas aceptadas).
- `npm run build` (frontend + chatbot).
- `npm --workspace=chatbot run test` (14 tests del motor de slots verdes).
- Smoke test en local del bot (webhook → flujo de citas) y del panel.
- Deploy a Railway y validar logs sin errores de módulos.

---

## 4. Riesgos y validaciones

| Cambio | Riesgo | Cómo validar |
|---|---|---|
| `npm audit fix` (Fase 1) | Bajo — versiones patch/minor compatibles | build + tests + smoke |
| `axios` patch | Bajo (1.x → 1.x) | Envío de mensajes WhatsApp + upload de media + Calendar |
| Mover `shadcn` a devDeps | Bajo — no se importa en runtime | `npm run build` del frontend; UI intacta |
| Borrar `frontend/package-lock.json` | Bajo — workspace usa lock del root | `npm install` desde root, build |
| `node-cron@4` (uuid) | **Medio** — breaking en API de cron | Verificar `[Reminders] Cron started` y que dispare |
| `uuid@11` override (alt) | **Medio** — ESM en consumidores CJS | runtime del chatbot sin `ERR_REQUIRE_ESM` |
| Bump `express-rate-limit` | Bajo | rate limiting del webhook sigue activo |

---

## 5. Prevención (que no se vuelva a acumular)

- **Habilitar Dependabot version updates** (no solo security): `.github/dependabot.yml`
  con ecosistema `npm`, agrupando patches para PRs pequeños y frecuentes.
- **`npm audit` en CI**: fallar el pipeline en `--audit-level=high` (o moderate) para no
  acumular deuda.
- **Revisar `dependencies` vs `devDependencies`** al agregar herramientas CLI (como
  `shadcn`) — los CLIs van en devDeps o se usan con `npx`, nunca en runtime.
- Mantener un solo `package-lock.json` (root) en el monorepo.

---

## 6. Orden de ejecución sugerido
`Fase 0 → Fase 1 (audit fix) → verificar → Fase 2 (shadcn + lock) → verificar → Fase 3 (uuid, decidir A/B) → Fase 4 (overrides) → Fase 5 (verificación final) → PR → deploy`

Entregable mínimo de alto impacto: **Fase 1 + Fase 2** ya resuelven ~15 de 16 alertas con
riesgo bajo. La Fase 3 (uuid) es la única que pide pruebas cuidadosas.
