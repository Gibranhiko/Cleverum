-- ═══════════════════════════════════════════════════════════
-- CLEVERUM — Cache del media_id del mascot en WhatsApp
-- ═══════════════════════════════════════════════════════════
-- Al mandar la imagen del mascot por `link:`, WhatsApp la descarga
-- desde la URL en cada envío → llega tarde y desordenada (después
-- del menú). Subiéndola una vez al endpoint /media obtenemos un
-- media_id reutilizable que se entrega sin descarga y en orden.
-- Se cachea por cliente (1 upload por negocio, no por usuario).

alter table clients add column if not exists mascot_media_id text;
