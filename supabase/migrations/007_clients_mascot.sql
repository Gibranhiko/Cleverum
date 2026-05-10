-- ═══════════════════════════════════════════════════════════
-- CLEVERUM — Mascot del asesor virtual por cliente
-- ═══════════════════════════════════════════════════════════

alter table clients add column if not exists mascot_name text;
alter table clients add column if not exists mascot_image_url text;
