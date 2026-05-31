import { google } from 'googleapis'
import supabase from '../lib/supabase'
import { AppointmentSettings } from '../types'
import {
  Interval,
  computeFreeSlots,
  dayBoundsUtc,
  addDaysISO,
} from '../lib/slots'

const TIMEZONE = 'America/Mexico_City'

function sameInterval(a: Interval, b: Interval): boolean {
  return a.start.getTime() === b.start.getTime() && a.end.getTime() === b.end.getTime()
}

export interface CalendarEvent {
  summary: string
  description?: string
  start: Date
  duration?: number
}

export class GoogleCalendarService {
  private calendarId: string
  private keyFilePath: string

  constructor(calendarId: string, keyFilePath: string) {
    this.calendarId = calendarId
    this.keyFilePath = keyFilePath
  }

  private async downloadKeyFile(): Promise<string> {
    const { data, error } = await supabase.storage
      .from('calendar-keys')
      .download(this.keyFilePath)

    if (error || !data) {
      throw new Error(`Failed to download calendar key: ${error?.message}`)
    }

    const text = await data.text()
    JSON.parse(text) // validates JSON before using it
    return text
  }

  private async getAuth() {
    const keyFileContent = await this.downloadKeyFile()
    return new google.auth.GoogleAuth({
      credentials: JSON.parse(keyFileContent),
      scopes: ['https://www.googleapis.com/auth/calendar'],
    })
  }

  async createEvent(
    eventName: string,
    description: string,
    date: Date,
    durationHours = 1
  ): Promise<string | null> {
    const auth = await this.getAuth()
    const authClient = await auth.getClient()
    google.options({ auth: authClient as any })

    const calendar = google.calendar({ version: 'v3' })
    const start = new Date(date)
    const end = new Date(start)
    end.setHours(start.getHours() + durationHours)

    const response = await calendar.events.insert({
      calendarId: this.calendarId,
      requestBody: {
        summary: eventName,
        description,
        start: { dateTime: start.toISOString(), timeZone: TIMEZONE },
        end: { dateTime: end.toISOString(), timeZone: TIMEZONE },
        colorId: '2',
      },
    })

    return response.data.id ?? null
  }

  async checkAvailability(date: Date, durationHours = 1): Promise<boolean> {
    try {
      const auth = await this.getAuth()
      const authClient = await auth.getClient()
      google.options({ auth: authClient as any })

      const calendar = google.calendar({ version: 'v3' })
      const start = new Date(date)
      const end = new Date(start)
      end.setHours(start.getHours() + durationHours)

      const response = await calendar.freebusy.query({
        requestBody: {
          timeMin: start.toISOString(),
          timeMax: end.toISOString(),
          timeZone: TIMEZONE,
          items: [{ id: this.calendarId }],
        },
      })

      const busy = response.data.calendars?.[this.calendarId]?.busy ?? []
      return busy.length === 0
    } catch (err) {
      console.error('[Calendar] checkAvailability error:', err)
      return true // assume available if check fails
    }
  }

  // Borra un evento (para cancelar una cita). Best-effort: 410/404 = ya no existe.
  async deleteEvent(eventId: string): Promise<void> {
    const auth = await this.getAuth()
    const authClient = await auth.getClient()
    google.options({ auth: authClient as any })
    const calendar = google.calendar({ version: 'v3' })
    await calendar.events.delete({ calendarId: this.calendarId, eventId })
  }

  // Mueve un evento a una nueva fecha/hora (para reagendar).
  async updateEvent(eventId: string, date: Date, durationHours = 1): Promise<void> {
    const auth = await this.getAuth()
    const authClient = await auth.getClient()
    google.options({ auth: authClient as any })
    const calendar = google.calendar({ version: 'v3' })
    const start = new Date(date)
    const end = new Date(start)
    end.setHours(start.getHours() + durationHours)
    await calendar.events.patch({
      calendarId: this.calendarId,
      eventId,
      requestBody: {
        start: { dateTime: start.toISOString(), timeZone: TIMEZONE },
        end: { dateTime: end.toISOString(), timeZone: TIMEZONE },
      },
    })
  }

  // Consulta freebusy en un rango y devuelve los intervalos ocupados (UTC).
  // Una sola llamada cubre varios días (clave para getNextAvailableDays).
  async getBusyIntervals(timeMin: Date, timeMax: Date): Promise<Interval[]> {
    const auth = await this.getAuth()
    const authClient = await auth.getClient()
    google.options({ auth: authClient as any })

    const calendar = google.calendar({ version: 'v3' })
    const response = await calendar.freebusy.query({
      requestBody: {
        timeMin: timeMin.toISOString(),
        timeMax: timeMax.toISOString(),
        timeZone: TIMEZONE,
        items: [{ id: this.calendarId }],
      },
    })

    const busy = response.data.calendars?.[this.calendarId]?.busy ?? []
    return busy
      .filter(b => b.start && b.end)
      .map(b => ({ start: new Date(b.start!), end: new Date(b.end!) }))
  }

  // Horarios libres de un día. `extraBusy` = citas en DB (red de seguridad A1).
  // `exclude` = intervalo a ignorar (al reagendar, el evento propio de la cita).
  // Lanza si la API falla — el caller decide el fallback (NO fabricar slots, edge #12).
  async getAvailableSlots(
    dayISO: string,
    settings: AppointmentSettings,
    extraBusy: Interval[] = [],
    now: Date = new Date(),
    exclude?: Interval,
    maxSlots?: number
  ): Promise<Date[]> {
    const bounds = dayBoundsUtc(dayISO, settings.timezone)
    let calendarBusy = await this.getBusyIntervals(bounds.start, bounds.end)
    if (exclude) calendarBusy = calendarBusy.filter(b => !sameInterval(b, exclude))
    return computeFreeSlots({
      dayISO,
      settings,
      busy: [...calendarBusy, ...extraBusy],
      now,
      maxSlots,
    })
  }

  // Primeros `n` días (desde fromDayISO inclusive) con ≥1 slot libre.
  // Hace UNA sola query freebusy de todo el rango y parte los busy por día
  // en memoria (edge #R4 — evita N llamadas a la API).
  async getNextAvailableDays(
    fromDayISO: string,
    settings: AppointmentSettings,
    extraBusy: Interval[] = [],
    n = 5,
    now: Date = new Date(),
    exclude?: Interval
  ): Promise<string[]> {
    const rangeStart = dayBoundsUtc(fromDayISO, settings.timezone).start
    const rangeEnd = dayBoundsUtc(addDaysISO(fromDayISO, settings.horizon_days), settings.timezone).start
    let calendarBusy = await this.getBusyIntervals(rangeStart, rangeEnd)
    if (exclude) calendarBusy = calendarBusy.filter(b => !sameInterval(b, exclude))
    const busy = [...calendarBusy, ...extraBusy]

    const days: string[] = []
    for (let i = 0; i <= settings.horizon_days && days.length < n; i++) {
      const dayISO = addDaysISO(fromDayISO, i)
      const free = computeFreeSlots({ dayISO, settings, busy, now })
      if (free.length > 0) days.push(dayISO)
    }
    return days
  }
}
