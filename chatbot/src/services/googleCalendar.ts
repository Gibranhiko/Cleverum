import { google } from 'googleapis'
import supabase from '../lib/supabase'

const TIMEZONE = 'America/Mexico_City'

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
}
