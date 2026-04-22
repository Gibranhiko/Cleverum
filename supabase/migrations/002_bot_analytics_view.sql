-- ═══════════════════════════════════════════════════════════
-- CLEVERUM — Bot Analytics View
-- ═══════════════════════════════════════════════════════════
-- Aggregates usage metrics per client. Read by Dashboard.tsx
-- via supabase.from('bot_analytics').select('*').

create or replace view bot_analytics as
select
  c.id as client_id,
  c.company_name,
  c.bot_type,
  count(distinct cs.phone_number) as unique_users,
  count(distinct o.id) as total_orders,
  count(distinct l.id) as total_leads,
  count(distinct o.id) filter (
    where o.created_at > now() - interval '7 days'
  ) as orders_last_7d,
  count(distinct l.id) filter (
    where l.created_at > now() - interval '7 days'
  ) as leads_last_7d,
  max(cs.last_message_at) as last_activity
from clients c
left join conversation_sessions cs on cs.client_id = c.id
left join orders o on o.client_id = c.id
left join leads l on l.client_id = c.id
where c.is_active = true
group by c.id, c.company_name, c.bot_type;
