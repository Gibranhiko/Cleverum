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

export async function getAppointmentById(id: string): Promise<AppointmentRow | null> {
  const { data } = await supabase.from('appointments').select('*').eq('id', id).maybeSingle()
  return (data as AppointmentRow) ?? null
}

// Cancela una cita: status='cancelada' + borra el evento de Calendar (libera el slot).
export async function cancelAppointment(appt: AppointmentRow, calendar: GoogleCalendarService | null): Promise<boolean> {
  const nowISO = new Date().toISOString()
  const history = [...(appt.status_history ?? []), { status: 'cancelada', at: nowISO, by: 'bot', note: null }]
  const { error } = await supabase
    .from('appointments')
    .update({ status: 'cancelada', status_history: history, updated_at: nowISO })
    .eq('id', appt.id)
  if (error) {
    console.error('[Appointments] cancel error:', error)
    return false
  }
  if (calendar && appt.calendar_event_id) {
    try {
      await calendar.deleteEvent(appt.calendar_event_id)
    } catch (err) {
      console.error('[Appointments] cancel: calendar delete failed (kept cancelada en DB):', err)
    }
  }
  return true
}

// Reagenda una cita a un nuevo slot: re-check + update DB + mueve el evento de Calendar.
// No cambia el `status` (sigue nueva/confirmada); solo deja rastro en status_history.
export async function rescheduleAppointment(
  appt: AppointmentRow,
  newSlotStart: Date,
  settings: AppointmentSettings,
  calendar: GoogleCalendarService | null
): Promise<BookResult> {
  const slotEnd = addMinutes(newSlotStart, settings.slot_minutes)
  const nowISO = new Date().toISOString()

  if (calendar) {
    const available = await calendar.checkAvailability(newSlotStart, settings.slot_minutes / 60)
    if (!available) return { ok: false, reason: 'slot_taken' }
  }

  const history = [...(appt.status_history ?? []), { status: 'reagendada', at: nowISO, by: 'bot', note: appt.starts_at }]
  const { error } = await supabase
    .from('appointments')
    .update({ starts_at: newSlotStart.toISOString(), ends_at: slotEnd.toISOString(), status_history: history, updated_at: nowISO })
    .eq('id', appt.id)

  if (error) {
    if ((error as any).code === '23505') return { ok: false, reason: 'slot_taken' }
    console.error('[Appointments] reschedule error:', error)
    return { ok: false, reason: 'error' }
  }

  if (calendar && appt.calendar_event_id) {
    try {
      await calendar.updateEvent(appt.calendar_event_id, newSlotStart, settings.slot_minutes / 60)
    } catch (err) {
      console.error('[Appointments] reschedule: calendar move failed:', err)
    }
  }
  return { ok: true }
}

// Citas próximas (no canceladas) de un teléfono — para "Mi cita".
export async function getUpcomingAppointments(clientId: string, phone: string): Promise<AppointmentRow[]> {
  const { data } = await supabase
    .from('appointments')
    .select('*')
    .eq('client_id', clientId)
    .eq('customer_phone', phone)
    .in('status', ['nueva', 'confirmada'])
    .gte('starts_at', new Date().toISOString())
    .order('starts_at', { ascending: true })
  return (data ?? []) as AppointmentRow[]
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
  const { clientId, calendar, settings, customerPhone, customerName, service, slotStart, origin = 'whatsapp' } = input
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
      status: 'nueva',
      status_history: [{ status: 'nueva', at: nowISO, by: origin === 'panel' ? 'panel' : 'bot', note: null }],
      origin,
      calendar_synced: false,
    })
    .select()
    .single()

  if (insertError) {
    // 23505 = unique_violation → otro cliente ganó el slot (A3, edge #16).
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
        `Teléfono: ${customerPhone}`,
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
