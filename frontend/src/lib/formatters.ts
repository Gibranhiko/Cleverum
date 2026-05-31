export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return 'Nunca'
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return 'Hace un momento'
  if (mins < 60) return `Hace ${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `Hace ${hrs}h`
  return `Hace ${Math.floor(hrs / 24)}d`
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-MX', { dateStyle: 'medium' })
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })
}

// Etiqueta humana para current_flow + flow_step (en vez de jerga tipo
// "appointment · picking_slot"). Cubre los flujos de informativo+citas y servicios.
const FLOW_LABELS: Record<string, string> = {
  appointment: 'Agendando cita',
  manage_appt: 'Gestionando su cita',
  faq: 'Preguntas',
  intake: 'Levantando orden',
  status: 'Consultando folio',
}

const STEP_LABELS: Record<string, string> = {
  collect_name: 'pidiendo nombre',
  collect_service: 'eligiendo servicio',
  picking_day: 'eligiendo día',
  picking_slot: 'eligiendo horario',
  confirming: 'confirmando',
  picking_appt: 'eligiendo cita',
  actions: 'viendo su cita',
  confirm_cancel: 'confirmando cancelación',
}

export function flowLabel(flow: string | null, step: string | null): string | null {
  if (!flow) return null
  const base = FLOW_LABELS[flow] ?? flow
  const stepLabel = step ? STEP_LABELS[step] : null
  return stepLabel ? `${base} · ${stepLabel}` : base
}
