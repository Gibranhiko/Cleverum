-- ═══════════════════════════════════════════════════════════
-- CLEVERUM — Auto-sanación del mascot media_id
-- ═══════════════════════════════════════════════════════════
-- Guarda la URL con la que se subió el mascot_media_id actual. El bot compara
-- esta URL con mascot_image_url; si difieren (la imagen cambió), re-sube la nueva
-- a WhatsApp automáticamente. Evita que siga saliendo la imagen vieja sin importar
-- cómo se haya cambiado (panel, SQL, etc.).

alter table clients add column if not exists mascot_media_url text;
