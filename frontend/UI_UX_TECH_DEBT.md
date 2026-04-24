# Cleverum Frontend — UI/UX Tech Debt

> Generated: 2026-04-22 | Stack: React + Tailwind + shadcn/ui | Skill: ui-ux-pro-max v2.5.0

---

## Recommended Design System (ui-ux-pro-max)

| Token | Value |
|-------|-------|
| Style | AI-Native UI |
| Primary | `#7C3AED` |
| Secondary | `#A78BFA` |
| CTA | `#06B6D4` |
| Background | `#FAF5FF` |
| Text | `#1E1B4B` |
| Font | Plus Jakarta Sans (300/400/500/600/700) |
| Key Effects | Typing indicators, streaming text pulse, smooth reveals |
| Anti-patterns | Heavy chrome, slow response feedback |

---

## Items by Priority

### P0 — Visual & Design System

| # | Item | File(s) | Effort |
|---|------|---------|--------|
| P0-01 | Apply recommended color palette (purple/cyan AI-native) replacing current indigo defaults | `index.css` | S |
| P0-02 | Swap font from Geist to Plus Jakarta Sans via Google Fonts import | `index.css` | XS |
| P0-03 | Delete `App.css` — 185 lines of unused legacy 3D animation styles | `App.css` | XS |
| P0-04 | Unify loading state pattern — standardize to skeleton screens (not mix of spinners + "Cargando...") | All pages | M |
| P0-05 | Add `cursor-pointer` to all clickable table rows, toggle buttons, and card elements | All pages | S |

---

### P1 — Interaction & UX Patterns

| # | Item | File(s) | Effort |
|---|------|---------|--------|
| P1-01 | Separate compound action in Navbar: notification badge click should NOT navigate — just clear count | `Navbar.tsx:45` | XS |
| P1-02 | Pedidos: remove row-level circle toggle — keep single status change pattern inside detail modal | `Pedidos.tsx` | S |
| P1-03 | Leads notes: add dirty-state detection + unsaved changes warning before closing modal | `Leads.tsx` | S |
| P1-04 | Reminders time picker: expand range beyond 8am–10pm, support 15-min increments | `Reminders.tsx` | S |
| P1-05 | Conversaciones: add empty state when no session selected (currently blank panel) | `Conversaciones.tsx` | XS |
| P1-06 | All forms: migrate from manual `useState` per field to React Hook Form + shadcn `<Form>` | `ClienteModal.tsx`, `ProductoModal.tsx`, `ConfigBot.tsx` | L |

---

### P2 — Accessibility

| # | Item | File(s) | Effort |
|---|------|---------|--------|
| P2-01 | Add `aria-label` to all icon-only buttons (toggle active, delete, mute, takeover) | All pages | S |
| P2-02 | Ensure all modal focus traps work correctly — test Tab/Shift+Tab cycle inside dialogs | All modals | S |
| P2-03 | Add `prefers-reduced-motion` check — disable pulse/animate-spin for users who request it | `index.css` | XS |
| P2-04 | Verify color contrast 4.5:1 minimum for muted/secondary text (badge text, table captions) | All pages | S |
| P2-05 | Add `alt` text to product thumbnails in Productos table | `Productos.tsx` | XS |

---

### P3 — Performance & Scalability

| # | Item | File(s) | Effort |
|---|------|---------|--------|
| P3-01 | Add pagination to Clientes, Productos, and Leads tables (offset/limit via Supabase) | `Clientes.tsx`, `Productos.tsx`, `Leads.tsx` | M |
| P3-02 | Add search/filter input to Documentos list panel | `Documentos.tsx` | S |
| P3-03 | Add keyword filter to Productos table (by category or name) | `Productos.tsx` | S |
| P3-04 | Lazy load product images in table thumbnails | `Productos.tsx` | XS |
| P3-05 | Add error boundaries to Dashboard and Conversaciones (no silent failures on fetch errors) | `Dashboard.tsx`, `Conversaciones.tsx` | M |

---

### P4 — Component Architecture

| # | Item | File(s) | Effort |
|---|------|---------|--------|
| P4-01 | Extract `BotCard` component from Dashboard (257 lines, mixed concerns) | `Dashboard.tsx` | M |
| P4-02 | Extract `ChatPanel` and `SessionList` from Conversaciones (292 lines) | `Conversaciones.tsx` | M |
| P4-03 | Extract `LeadDetailModal` from Leads (321 lines) | `Leads.tsx` | M |
| P4-04 | Extract `ReminderModal` and `ReminderRow` from Reminders (304 lines) | `Reminders.tsx` | S |
| P4-05 | Extract `DocumentContent` viewer from Documentos (335 lines) | `Documentos.tsx` | S |
| P4-06 | Make `INFO_INTENTS` in ConfigBot data-driven from Supabase instead of hardcoded array | `ConfigBot.tsx` | M |

---

### P5 — Polish & Micro-interactions

| # | Item | File(s) | Effort |
|---|------|---------|--------|
| P5-01 | Add hover transition (`transition-colors duration-200`) to all table rows | All pages | XS |
| P5-02 | Add skeleton placeholder cards in Dashboard while bots load | `Dashboard.tsx` | S |
| P5-03 | Add typing indicator (3-dot pulse) in Conversaciones chat when bot is responding | `Conversaciones.tsx` | S |
| P5-04 | Add toast notifications for save/delete actions (currently silent or alert-based) | All CRUD pages | M |
| P5-05 | Floating navbar: add shadow + backdrop-blur for depth perception | `Navbar.tsx` | XS |
| P5-06 | Add `${page}.tsx` stray file removal (template artifact in pages folder) | `pages/${page}.tsx` | XS |

---

## Effort Legend

| Symbol | Description |
|--------|-------------|
| XS | < 30 min |
| S | 30–90 min |
| M | 2–4 hours |
| L | Half day+ |

---

## Suggested Order of Attack

```
Sprint 1 — Quick Wins (P0 visual + P5 polish XS items)
  P0-02 → P0-03 → P5-06 → P2-03 → P2-05 → P5-05 → P0-05 → P1-01 → P1-05

Sprint 2 — Interaction fixes (P1 + P2)
  P0-04 → P1-02 → P1-03 → P1-04 → P2-01 → P2-02 → P2-04

Sprint 3 — Performance (P3)
  P3-04 → P3-03 → P3-02 → P3-01 → P3-05

Sprint 4 — Architecture (P4 + P1-06)
  P4-04 → P4-05 → P4-01 → P4-02 → P4-03 → P4-06 → P1-06

Sprint 5 — Design System (P0-01 color palette overhaul)
  P0-01 (last, after components are stable)
```

---

## Notes

- All P0 XS items can be done in a single session (~2 hours total)
- P0-01 (color palette) is intentionally last — it touches every file and is best done when components are stable
- P1-06 (React Hook Form migration) is L effort but pays off in form validation consistency
- Supabase Realtime subscriptions are already well-implemented — no changes needed there
