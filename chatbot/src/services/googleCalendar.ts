import { google } from 'googleapis'
import https from 'https'
import http from 'http'

const TIMEZONE = 'America/Mexico_City'

export interface CalendarEvent {
  summary: string
  description?: string
  start: Date
  duration?: number
}

export class GoogleCalendarService {
  private calendarId: string
  private keyFileUrl: string

  constructor(calendarId: string, keyFileUrl: string) {
    this.calendarId = calendarId
    this.keyFileUrl = keyFileUrl
  }

  private downloadKeyFile(): Promise<string> {
    return new Promise((resolve, reject) => {
      const client = this.keyFileUrl.startsWith('https:') ? https : http
      client.get(this.keyFileUrl, res => {
        let data = ''
        res.on('data', chunk => (data += chunk))
        res.on('end', () => {
          try {
            JSON.parse(data)
            resolve(data)
          } catch {
            reject(new Error('Invalid key file JSON'))
          }
        })
      }).on('error', reject)
    })
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
