-- ═══════════════════════════════════════════════════════════
-- CLEVERUM — Citas genéricas: quitar campos custom (no-hospital)
-- ═══════════════════════════════════════════════════════════
-- El bot informativo + citas es GENÉRICO por diseño: solo recolecta
-- nombre, servicio, día y hora. Los campos de intake configurables
-- (ej. "seguro médico") eran específicos de hospital → se eliminan.
-- Necesidades específicas = bot custom (de paga), aparte.

alter table appointment_settings drop column if exists intake_fields;
alter table appointments drop column if exists extra;
