import { addMinutes } from 'date-fns'
import supabase from './supabase'
import { GoogleCalendarService } from '../services/googleCalendar'
import { Interval, dayBoundsUtc, addDaysISO } from './slots'
import { AppointmentSettings, AppointmentRow } from '../types'

// ─── Settings loader (B5) ────────────────────────────────────
const settingsCache = new Map<string, { settings: AppointmentSettings | null; expires: number }>()
const TTL = 5 * 60 * 1000

export async function getAppointmentSettings(clientId: string): Promise<AppointmentSettings | null> {
  const cached = settingsCache.get(clientId)
  if (cached && cached.expires > Date.now()) return cached.settings

  const { data } = await supabase
    .from('appointment_settings')
    .select('*')
    .eq('client_id', clientId)
    .maybeSingle()

  const settings = (data as AppointmentSettings) ?? null
  settingsCache.set(clientId, { settings, expires: Date.now() + TTL })
  return settings
}

export function invalidateAppointmentSettings(clientId: string) {
  settingsCache.delete(clientId)
}

// ─── DB busy (red de seguridad A1) ───────────────────────────
// Citas no canceladas que se traslapan con un rango → intervalos para
// restar de la disponibilidad junto con el busy de Calendar.
export async function getDbBusyForRange(
  clientId: string,
  start: Date,
  end: Date
): Promise<Interval[]> {
  const { data } = await supabase
    .from('appointments')
    .select('starts_at, ends_at, status')
    .eq('client_id', clientId)
    .neq('status', 'cancelada')
    .gte('starts_at', start.toISOString())
    .lt('starts_at', end.toISOString())

  return (data ?? []).map((r: any) => ({
    start: new Date(r.starts_at),
    end: new Date(r.ends_at),
  }))
}

export function getDbBusyForDay(clientId: string, dayISO: string, tz: string) {
  const b = dayBoundsUtc(dayISO, tz)
  return getDbBusyForRange(clientId, b.start, b.end)
}

export function getDbBusyForHorizon(clientId: string, fromDayISO: string, settings: AppointmentSettings) {
  const start = dayBoundsUtc(fromDayISO, settings.timezone).start
  const end = dayBoundsUtc(addDaysISO(fromDayISO, settings.horizon_days), settings.timezone).start
  return getDbBusyForRange(clientId, start, end)
}

// ─── Booking con doble escritura (B3 / decisión A2) ──────────
export interface BookInput {
  clientId: string
  calendar: GoogleCalendarService | null
  settings: AppointmentSettings
  customerPhone: string
  customerName: string
  service: string | null
  slotStart: Date
  extra?: Record<string, unknown>
  origin?: 'whatsapp' | 'panel'
}

export interface BookResult {
  ok: boolean
  reason?: 'slot_taken' | 'error'
  appointment?: AppointmentRow
  calendarSynced?: boolean
}

/**
 * Agenda una cita escribiendo en DB y Google Calendar (A2):
 *  1. Re-check del slot contra Calendar (pudo ocuparse desde que se listó).
 *  2. Insert en DB (status 'nueva') — el panel siempre tiene registro.
 *  3. Create event en Calendar.
 *  4. Update con calendar_event_id + calendar_synced.
 * El unique index uq_appointments_slot (A3) atrapa dos confirmaciones del
 * mismo slot → la segunda recibe 'slot_taken'.
 */
export async function bookAppointment(input: BookInput): Promise<BookResult> {
  const { clientId, calendar, settings, customerPhone, customerName, service, slotStart, extra = {}, origin = 'whatsapp' } = input
  const slotEnd = addMinutes(slotStart, settings.slot_minutes)
  const nowISO = new Date().toISOString()

  // 1) Re-check contra Calendar (edge #14). Si falla la API, checkAvailability
  //    asume libre — el unique index sigue protegiendo contra dobles internos.
  if (calendar) {
    const available = await calendar.checkAvailability(slotStart, settings.slot_minutes / 60)
    if (!available) return { ok: false, reason: 'slot_taken' }
  }

  // 2) Insert DB primero (la cita existe en el panel aunque Calendar falle).
  const { data: inserted, error: insertError } = await supabase
    .from('appointments')
    .insert({
      client_id: clientId,
      customer_phone: customerPhone,
      customer_name: customerName,
      service,
      starts_at: slotStart.toISOString(),
      ends_at: slotEnd.toISOString(),
      extra,
      status: 'nueva',
      status_history: [{ status: 'nueva', at: nowISO, by: origin === 'panel' ? 'panel' : 'bot', note: null }],
      origin,
      calendar_synced: false,
    })
    .select()
    .single()

  if (insertError) {
    // 23505 = unique_violation → otro paciente ganó el slot (A3, edge #16).
    if ((insertError as any).code === '23505') return { ok: false, reason: 'slot_taken' }
    console.error('[Appointments] insert error:', insertError)
    return { ok: false, reason: 'error' }
  }

  const appointment = inserted as AppointmentRow
  let calendarSynced = false

  // 3 + 4) Calendar event (best-effort). Si falla, la cita queda sin sync (edge #26).
  if (calendar) {
    try {
      const eventId = await calendar.createEvent(
        `${service ?? 'Cita'} — ${customerName}`,
        `Teléfono: ${customerPhone}\n${Object.entries(extra).map(([k, v]) => `${k}: ${v}`).join('\n')}`,
        slotStart,
        settings.slot_minutes / 60
      )
      if (eventId) {
        await supabase
          .from('appointments')
          .update({ calendar_event_id: eventId, calendar_synced: true, updated_at: new Date().toISOString() })
          .eq('id', appointment.id)
        appointment.calendar_event_id = eventId
        appointment.calendar_synced = true
        calendarSynced = true
      }
    } catch (err) {
      console.error('[Appointments] Calendar create failed — appointment kept unsynced:', err)
    }
  }

  return { ok: true, appointment, calendarSynced }
}
