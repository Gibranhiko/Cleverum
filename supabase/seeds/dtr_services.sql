-- ═══════════════════════════════════════════════════════════
-- Seed: 10 servicios iniciales para DTR
-- Pega este SQL en Supabase SQL Editor.
-- Si tu cliente NO se llama exactamente 'DTR', ajusta el WHERE
-- de la primera línea (busca por LIKE o reemplaza el nombre).
-- ═══════════════════════════════════════════════════════════

with dtr as (
  select id from clients where company_name = 'DTR' limit 1
)
insert into services (
  client_id, name, description, category,
  price_amount, price_label, estimated_duration,
  is_active, display_order
)
select dtr.id, v.name, v.description, v.category,
       v.price_amount, v.price_label, v.estimated_duration,
       true, v.display_order
from dtr,
(values
  (
    'Reparación celular',
    'Reparación de celulares Android y iPhone, cambios de pantalla, batería, centro de carga y software.',
    'Reparación',
    500.00,
    'Desde $500 según falla',
    '2–3 días',
    1
  ),
  (
    'Reparación computadora',
    'Reparación de laptops y computadoras de escritorio, fallas de hardware, software y formateos.',
    'Reparación',
    800.00,
    'Desde $800 según reparación',
    '2–5 días',
    2
  ),
  (
    'Mantenimiento preventivo',
    'Limpieza interna, optimización y mantenimiento preventivo para equipos de cómputo y consolas.',
    'Mantenimiento',
    350.00,
    'Desde $350',
    '1 día',
    3
  ),
  (
    'Accesorios celular',
    'Venta de fundas, cargadores, cables, micas, audífonos y accesorios para celular.',
    'Accesorios',
    150.00,
    'Desde $150',
    'Entrega inmediata',
    4
  ),
  (
    'Accesorios cómputo',
    'Accesorios para computadora como teclados, mouse, memorias USB, bocinas y webcams.',
    'Accesorios',
    250.00,
    'Desde $250',
    'Entrega inmediata',
    5
  ),
  (
    'Piezas y refacciones',
    'Venta e instalación de piezas y refacciones para celulares, laptops y computadoras.',
    'Refacciones',
    400.00,
    'Cotización según pieza',
    '1–5 días',
    6
  ),
  (
    'Accesorios gaming',
    'Venta de controles, headsets, teclados gamer, mousepads y accesorios para gaming.',
    'Gaming',
    300.00,
    'Desde $300',
    'Entrega inmediata',
    7
  ),
  (
    'Automatización industrial',
    'Soluciones de automatización industrial, configuración de equipos, sensores y sistemas inteligentes.',
    'Industrial',
    2500.00,
    'Cotización personalizada',
    '3–10 días',
    8
  ),
  (
    'Soporte técnico empresarial',
    'Soporte técnico para empresas, redes, mantenimiento de equipos y asistencia remota o presencial.',
    'Soporte técnico',
    1200.00,
    'Planes desde $1200',
    'Mismo día',
    9
  ),
  (
    'Seguridad tecnológica',
    'Instalación y configuración de cámaras, respaldos, redes seguras y protección tecnológica.',
    'Seguridad',
    1800.00,
    'Cotización según proyecto',
    '2–7 días',
    10
  )
) as v(name, description, category, price_amount, price_label, estimated_duration, display_order);

-- Verificar:
-- select name, category, price_label, display_order from services
-- where client_id = (select id from clients where company_name = 'DTR')
-- order by display_order;
