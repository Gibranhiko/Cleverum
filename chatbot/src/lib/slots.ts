import { addMinutes, addDays } from 'date-fns'
import { fromZonedTime, formatInTimeZone } from 'date-fns-tz'
import { AppointmentSettings, DayHours } from '../types'

export interface Interval {
  start: Date
  end: Date
}

// Suma n días a una fecha calendario 'YYYY-MM-DD' (aritmética pura de fecha).
export function addDaysISO(dayISO: string, n: number): string {
  const d = new Date(`${dayISO}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

// Fecha calendario actual ('YYYY-MM-DD') en la timezone dada.
export function todayISO(tz: string, now: Date = new Date()): string {
  return formatInTimeZone(now, tz, 'yyyy-MM-dd')
}

// Instantes UTC de inicio y fin del día calendario en la tz dada.
export function dayBoundsUtc(dayISO: string, tz: string): Interval {
  return {
    start: fromZonedTime(`${dayISO}T00:00:00`, tz),
    end: fromZonedTime(`${addDaysISO(dayISO, 1)}T00:00:00`, tz),
  }
}

export interface FreeSlotsInput {
  dayISO: string                 // 'YYYY-MM-DD' (día en settings.timezone)
  settings: AppointmentSettings
  busy: Interval[]               // intervalos ocupados (Calendar ∪ DB), en UTC
  now: Date                      // momento actual (UTC)
}

// True si [aStart,aEnd) se traslapa con [bStart,bEnd).
function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart < bEnd && aEnd > bStart
}

// Día de la semana (0=domingo..6=sábado) de una fecha calendario 'YYYY-MM-DD',
// independiente de timezone (se calcula sobre la fecha pura).
function weekdayOf(dayISO: string): number {
  return new Date(`${dayISO}T00:00:00Z`).getUTCDay()
}

// Convierte una hora local ('HH:mm') de un día a su instante UTC en la tz dada.
function localToUtc(dayISO: string, hhmm: string, tz: string): Date {
  return fromZonedTime(`${dayISO}T${hhmm}:00`, tz)
}

// Construye los starts candidatos de una ventana [open, close) del día.
// Cada slot debe caber completo antes de close.
function windowSlots(
  dayISO: string,
  open: string,
  close: string,
  settings: AppointmentSettings
): Date[] {
  const tz = settings.timezone
  const windowStart = localToUtc(dayISO, open, tz)
  const windowEnd = localToUtc(dayISO, close, tz)
  const step = settings.slot_minutes + settings.buffer_minutes

  const out: Date[] = []
  let start = windowStart
  while (true) {
    const end = addMinutes(start, settings.slot_minutes)
    if (end > windowEnd) break          // no cabe completo antes del cierre
    out.push(start)
    start = addMinutes(start, step)
    if (step <= 0) break                // guard contra config inválida
  }
  return out
}

/**
 * Calcula los horarios libres de un día (función pura, sin I/O).
 * slots_libres = grid_horario − (busy de Calendar ∪ citas en DB),
 * filtrado por lead-time y horizonte. Devuelve starts (UTC) ordenados y
 * capeados a settings.max_slots_listed.
 */
export function computeFreeSlots(input: FreeSlotsInput): Date[] {
  const { dayISO, settings, busy, now } = input

  // Día cerrado por fecha específica (feriado/vacaciones)
  if (settings.closed_dates?.includes(dayISO)) return []

  // Horario del día de la semana
  const wd = weekdayOf(dayISO)
  const hours: DayHours | null = settings.weekly_hours?.[wd] ?? null
  if (!hours) return []

  // Ventanas (soporta horario partido)
  const windows: { open: string; close: string }[] = [{ open: hours.open, close: hours.close }]
  if (hours.open2 && hours.close2) windows.push({ open: hours.open2, close: hours.close2 })

  const earliest = addMinutes(now, settings.lead_time_minutes)
  const horizonEnd = addDays(now, settings.horizon_days)

  let candidates: Date[] = []
  for (const w of windows) {
    candidates = candidates.concat(windowSlots(dayISO, w.open, w.close, settings))
  }

  const free = candidates.filter(start => {
    if (start < earliest) return false          // dentro del lead-time / pasado
    if (start > horizonEnd) return false         // fuera del horizonte
    const end = addMinutes(start, settings.slot_minutes)
    return !busy.some(b => overlaps(start, end, b.start, b.end))
  })

  free.sort((a, b) => a.getTime() - b.getTime())
  return free.slice(0, settings.max_slots_listed)
}
