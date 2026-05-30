import { test } from 'node:test'
import assert from 'node:assert/strict'
import { computeFreeSlots, addDaysISO, dayBoundsUtc, Interval } from './slots'
import { AppointmentSettings, DayHours } from '../types'

const TZ = 'America/Mexico_City' // UTC-6 fijo (México sin DST desde 2022)

function hours(open: string, close: string, open2?: string, close2?: string): DayHours {
  return { open, close, ...(open2 && close2 ? { open2, close2 } : {}) }
}

function makeSettings(over: Partial<AppointmentSettings> = {}): AppointmentSettings {
  return {
    client_id: 'c1',
    enabled: true,
    timezone: TZ,
    weekly_hours: Array(7).fill(hours('09:00', '11:00')), // todos los días igual
    slot_minutes: 30,
    buffer_minutes: 0,
    lead_time_minutes: 120,
    horizon_days: 30,
    max_slots_listed: 8,
    closed_dates: [],
    service_label: 'Servicio',
    use_services_catalog: false,
    ...over,
  }
}

// 'now' muy anterior al día de prueba para que lead-time/horizonte no filtren.
const NOW = new Date('2026-06-01T00:00:00Z')
const DAY = '2026-06-15' // lunes

// Formatea un slot como 'HH:mm' UTC para asserts legibles.
function utc(d: Date): string {
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`
}

test('grid básico: 09:00-11:00 slot 30 → 4 slots', () => {
  const slots = computeFreeSlots({ dayISO: DAY, settings: makeSettings(), busy: [], now: NOW })
  // 09:00 local = 15:00 UTC (UTC-6)
  assert.deepEqual(slots.map(utc), ['15:00', '15:30', '16:00', '16:30'])
})

test('timezone: 09:00 local de México = 15:00 UTC', () => {
  const slots = computeFreeSlots({ dayISO: DAY, settings: makeSettings(), busy: [], now: NOW })
  assert.equal(slots[0].getUTCHours(), 15)
})

test('día cerrado por weekly_hours null → []', () => {
  const wh: (DayHours | null)[] = Array(7).fill(hours('09:00', '11:00'))
  wh[1] = null // lunes cerrado (DAY es lunes)
  const slots = computeFreeSlots({ dayISO: DAY, settings: makeSettings({ weekly_hours: wh }), busy: [], now: NOW })
  assert.deepEqual(slots, [])
})

test('día en closed_dates → []', () => {
  const slots = computeFreeSlots({ dayISO: DAY, settings: makeSettings({ closed_dates: [DAY] }), busy: [], now: NOW })
  assert.deepEqual(slots, [])
})

test('busy de Calendar elimina el slot traslapado', () => {
  // Ocupa 10:00-10:30 local = 16:00-16:30 UTC
  const busy: Interval[] = [{ start: new Date('2026-06-15T16:00:00Z'), end: new Date('2026-06-15T16:30:00Z') }]
  const slots = computeFreeSlots({ dayISO: DAY, settings: makeSettings(), busy, now: NOW })
  assert.deepEqual(slots.map(utc), ['15:00', '15:30', '16:30'])
})

test('slot que cruza el cierre no se ofrece', () => {
  // 09:00-09:40, slot 30 → solo 09:00 (09:30 terminaría 10:00 > 09:40)
  const slots = computeFreeSlots({
    dayISO: DAY,
    settings: makeSettings({ weekly_hours: Array(7).fill(hours('09:00', '09:40')) }),
    busy: [],
    now: NOW,
  })
  assert.equal(slots.length, 1)
  assert.equal(utc(slots[0]), '15:00')
})

test('horario partido (mañana + tarde)', () => {
  const slots = computeFreeSlots({
    dayISO: DAY,
    settings: makeSettings({ weekly_hours: Array(7).fill(hours('09:00', '10:00', '12:00', '13:00')) }),
    busy: [],
    now: NOW,
  })
  // 09:00,09:30 (mañana) + 12:00,12:30 (tarde) → 15:00,15:30,18:00,18:30 UTC
  assert.deepEqual(slots.map(utc), ['15:00', '15:30', '18:00', '18:30'])
})

test('buffer entre citas', () => {
  // slot 30 + buffer 30 = paso 60 → 09:00, 10:00 (10:30 end 11:00 ok pero paso desde 10:00)
  const slots = computeFreeSlots({
    dayISO: DAY,
    settings: makeSettings({ buffer_minutes: 30 }),
    busy: [],
    now: NOW,
  })
  assert.deepEqual(slots.map(utc), ['15:00', '16:00'])
})

test('cap a max_slots_listed', () => {
  const slots = computeFreeSlots({ dayISO: DAY, settings: makeSettings({ max_slots_listed: 2 }), busy: [], now: NOW })
  assert.equal(slots.length, 2)
})

test('lead-time filtra slots de hoy demasiado próximos', () => {
  // now = 09:10 local (15:10 UTC) del mismo día, lead 120 min → earliest 11:10 local
  // ventana 09:00-13:00 → primer slot válido sería >= 11:30 local (17:30 UTC)
  const now = new Date('2026-06-15T15:10:00Z')
  const slots = computeFreeSlots({
    dayISO: DAY,
    settings: makeSettings({ weekly_hours: Array(7).fill(hours('09:00', '13:00')) }),
    busy: [],
    now,
  })
  // todos los slots deben ser >= 17:10 UTC (11:10 local)
  assert.ok(slots.every(s => s.getTime() >= new Date('2026-06-15T17:10:00Z').getTime()))
  assert.ok(slots.length > 0)
})

test('fuera de horizonte → []', () => {
  const slots = computeFreeSlots({
    dayISO: DAY,
    settings: makeSettings({ horizon_days: 5 }), // NOW=jun1 + 5 = jun6 < jun15
    busy: [],
    now: NOW,
  })
  assert.deepEqual(slots, [])
})

test('citas en DB (extraBusy) también bloquean (red de seguridad A1)', () => {
  // Mismo efecto que busy de Calendar — se pasan juntos en la capa de servicio.
  const busy: Interval[] = [{ start: new Date('2026-06-15T15:00:00Z'), end: new Date('2026-06-15T15:30:00Z') }]
  const slots = computeFreeSlots({ dayISO: DAY, settings: makeSettings(), busy, now: NOW })
  assert.equal(utc(slots[0]), '15:30') // el 15:00 quedó bloqueado
})

// ─── helpers ───────────────────────────────────────────────

test('addDaysISO suma días correctamente (incluye cruce de mes)', () => {
  assert.equal(addDaysISO('2026-06-15', 1), '2026-06-16')
  assert.equal(addDaysISO('2026-06-30', 1), '2026-07-01')
  assert.equal(addDaysISO('2026-12-31', 1), '2027-01-01')
})

test('dayBoundsUtc: inicio de día en México = 06:00 UTC', () => {
  const b = dayBoundsUtc('2026-06-15', TZ)
  assert.equal(b.start.toISOString(), '2026-06-15T06:00:00.000Z')
  assert.equal(b.end.toISOString(), '2026-06-16T06:00:00.000Z')
})
