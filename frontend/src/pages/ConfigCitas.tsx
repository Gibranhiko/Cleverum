import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'

interface Cliente { id: string; company_name: string; bot_type: string }
type Day = { open: string; close: string } | null

const DAY_LABELS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']

interface SettingsState {
  enabled: boolean
  timezone: string
  weekly_hours: Day[]
  slot_minutes: number
  buffer_minutes: number
  lead_time_minutes: number
  horizon_days: number
  max_slots_listed: number
  closed_dates: string[]
  service_label: string
  use_services_catalog: boolean
  intake_fields: unknown[]
}

function defaults(): SettingsState {
  return {
    enabled: false,
    timezone: 'America/Mexico_City',
    weekly_hours: [null, { open: '09:00', close: '14:00' }, { open: '09:00', close: '14:00' }, { open: '09:00', close: '14:00' }, { open: '09:00', close: '14:00' }, { open: '09:00', close: '14:00' }, null],
    slot_minutes: 30,
    buffer_minutes: 0,
    lead_time_minutes: 120,
    horizon_days: 30,
    max_slots_listed: 8,
    closed_dates: [],
    service_label: 'Servicio',
    use_services_catalog: false,
    intake_fields: [],
  }
}

export default function ConfigCitas() {
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [clienteId, setClienteId] = useState('')
  const [s, setS] = useState<SettingsState>(defaults())
  const [intakeText, setIntakeText] = useState('[]')
  const [closedText, setClosedText] = useState('')
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    supabase.from('clients').select('id, company_name, bot_type').eq('is_active', true).order('company_name')
      .then(({ data }) => {
        const list = data ?? []
        setClientes(list)
        const first = list.find(c => c.bot_type === 'informativo') ?? list[0]
        if (first) setClienteId(first.id)
      })
  }, [])

  useEffect(() => {
    if (!clienteId) return
    setLoading(true)
    supabase.from('appointment_settings').select('*').eq('client_id', clienteId).maybeSingle()
      .then(({ data }) => {
        const next: SettingsState = data
          ? {
              enabled: data.enabled,
              timezone: data.timezone,
              weekly_hours: (data.weekly_hours?.length ? data.weekly_hours : defaults().weekly_hours) as Day[],
              slot_minutes: data.slot_minutes,
              buffer_minutes: data.buffer_minutes,
              lead_time_minutes: data.lead_time_minutes,
              horizon_days: data.horizon_days,
              max_slots_listed: data.max_slots_listed,
              closed_dates: data.closed_dates ?? [],
              service_label: data.service_label,
              use_services_catalog: data.use_services_catalog,
              intake_fields: data.intake_fields ?? [],
            }
          : defaults()
        setS(next)
        setIntakeText(JSON.stringify(next.intake_fields, null, 2))
        setClosedText((next.closed_dates ?? []).join('\n'))
        setLoading(false)
      })
  }, [clienteId])

  function setDay(i: number, day: Day) {
    setS(prev => { const wh = [...prev.weekly_hours]; wh[i] = day; return { ...prev, weekly_hours: wh } })
  }

  async function save() {
    let intake_fields: unknown[]
    try { intake_fields = JSON.parse(intakeText) } catch { toast.error('Campos de intake: JSON inválido'); return }
    const closed_dates = closedText.split('\n').map(l => l.trim()).filter(Boolean)
    if (closed_dates.some(d => !/^\d{4}-\d{2}-\d{2}$/.test(d))) { toast.error('Fechas cerradas: usa YYYY-MM-DD por línea'); return }

    setSaving(true)
    const { error } = await supabase.from('appointment_settings').upsert({
      client_id: clienteId,
      ...s,
      closed_dates,
      intake_fields,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'client_id' })
    setSaving(false)
    if (error) { toast.error('No se pudo guardar: ' + error.message); return }
    toast.success('Configuración guardada')
  }

  const num = (v: string) => Number(v) || 0

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Config Citas</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Horarios y reglas de la agenda por cliente</p>
        </div>
        <Select value={clienteId} onValueChange={setClienteId}>
          <SelectTrigger className="w-52"><SelectValue placeholder="Cliente" /></SelectTrigger>
          <SelectContent>{clientes.map(c => <SelectItem key={c.id} value={c.id}>{c.company_name}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      {loading ? <p className="text-sm text-muted-foreground">Cargando...</p> : (
        <>
          <div className="flex items-center justify-between rounded-lg border bg-card px-4 py-3">
            <div>
              <Label className="text-base">Citas con agenda habilitadas</Label>
              <p className="text-xs text-muted-foreground">Requiere Google Calendar configurado en el cliente.</p>
            </div>
            <Switch checked={s.enabled} onCheckedChange={v => setS({ ...s, enabled: v })} />
          </div>

          {/* Horario semanal */}
          <div className="rounded-lg border bg-card p-4 space-y-2">
            <Label className="text-base">Horario de atención</Label>
            {s.weekly_hours.map((d, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="w-24 text-sm">{DAY_LABELS[i]}</span>
                <Switch checked={!!d} onCheckedChange={v => setDay(i, v ? { open: '09:00', close: '14:00' } : null)} />
                {d ? (
                  <>
                    <Input type="time" value={d.open} onChange={e => setDay(i, { ...d, open: e.target.value })} className="w-32" />
                    <span className="text-muted-foreground">a</span>
                    <Input type="time" value={d.close} onChange={e => setDay(i, { ...d, close: e.target.value })} className="w-32" />
                  </>
                ) : <span className="text-sm text-muted-foreground">Cerrado</span>}
              </div>
            ))}
          </div>

          {/* Parámetros de slots */}
          <div className="rounded-lg border bg-card p-4 grid grid-cols-2 gap-4">
            <div><Label>Duración de cita (min)</Label><Input type="number" value={s.slot_minutes} onChange={e => setS({ ...s, slot_minutes: num(e.target.value) })} className="mt-1" /></div>
            <div><Label>Colchón entre citas (min)</Label><Input type="number" value={s.buffer_minutes} onChange={e => setS({ ...s, buffer_minutes: num(e.target.value) })} className="mt-1" /></div>
            <div><Label>Anticipación mínima (min)</Label><Input type="number" value={s.lead_time_minutes} onChange={e => setS({ ...s, lead_time_minutes: num(e.target.value) })} className="mt-1" /></div>
            <div><Label>Horizonte (días)</Label><Input type="number" value={s.horizon_days} onChange={e => setS({ ...s, horizon_days: num(e.target.value) })} className="mt-1" /></div>
            <div><Label>Máx. horarios por mensaje</Label><Input type="number" value={s.max_slots_listed} onChange={e => setS({ ...s, max_slots_listed: num(e.target.value) })} className="mt-1" /></div>
            <div><Label>Zona horaria</Label><Input value={s.timezone} onChange={e => setS({ ...s, timezone: e.target.value })} className="mt-1" /></div>
          </div>

          {/* Etiquetas / catálogo */}
          <div className="rounded-lg border bg-card p-4 space-y-4">
            <div><Label>Etiqueta del servicio</Label><Input value={s.service_label} onChange={e => setS({ ...s, service_label: e.target.value })} className="mt-1" placeholder="Ej: Especialidad" /></div>
            <div className="flex items-center justify-between">
              <div><Label>Usar catálogo de Servicios</Label><p className="text-xs text-muted-foreground">Las especialidades salen de la página Servicios (lista determinista).</p></div>
              <Switch checked={s.use_services_catalog} onCheckedChange={v => setS({ ...s, use_services_catalog: v })} />
            </div>
          </div>

          {/* Avanzado */}
          <div className="rounded-lg border bg-card p-4 space-y-4">
            <div>
              <Label>Fechas cerradas (una por línea, YYYY-MM-DD)</Label>
              <textarea value={closedText} onChange={e => setClosedText(e.target.value)} rows={3} className="mt-1 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm font-mono" placeholder="2026-12-25" />
            </div>
            <Separator />
            <div>
              <Label>Campos adicionales de intake (JSON)</Label>
              <p className="text-xs text-muted-foreground mb-1">Ej: [{`{"key":"seguro","label":"Seguro médico","type":"list","options":["GNP","AXA","Particular"],"required":true}`}]</p>
              <textarea value={intakeText} onChange={e => setIntakeText(e.target.value)} rows={6} className="mt-1 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm font-mono" />
            </div>
          </div>

          <Button onClick={save} disabled={saving || !clienteId}>{saving ? 'Guardando...' : 'Guardar configuración'}</Button>
        </>
      )}
    </div>
  )
}
