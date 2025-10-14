import { GoogleAuth, OAuth2Client, AuthClient } from "google-auth-library";
import { google } from "googleapis";
import https from "https";
import http from "http";

const timeZone = "America/Mexico_City";
const standardDuration = 1;

export interface CalendarEvent {
  summary: string;
  description?: string;
  start: Date;
  duration?: number;
}

export class GoogleCalendarService {
  private calendarId: string;
  private keyFileUrl: string;

  constructor(calendarId: string, keyFileUrl: string) {
    this.calendarId = calendarId;
    this.keyFileUrl = keyFileUrl;
  }

  private async downloadKeyFile(): Promise<string> {
    return new Promise((resolve, reject) => {
      const url = this.keyFileUrl;
      const client = url.startsWith('https:') ? https : http;

      client.get(url, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          try {
            // Validate that it's valid JSON
            JSON.parse(data);
            resolve(data);
          } catch (err) {
            reject(new Error('Invalid key file JSON'));
          }
        });
      }).on('error', (err) => {
        reject(err);
      });
    });
  }

  private async createAuth(): Promise<GoogleAuth<AuthClient>> {
    const keyFileContent = await this.downloadKeyFile();

    // Create a temporary file or use the content directly
    // For now, we'll create the auth with the key content
    const auth = new google.auth.GoogleAuth({
      credentials: JSON.parse(keyFileContent),
      scopes: ["https://www.googleapis.com/auth/calendar"],
    });

    return auth as unknown as GoogleAuth<AuthClient>;
  }

  async createEvent(
    eventName: string,
    description: string,
    date: Date,
    duration: number = standardDuration
  ): Promise<string | null> {
    try {
      const auth = await this.createAuth();
      const authClient = await auth.getClient();

      // Set auth for googleapis
      google.options({ auth: authClient as any });

      const calendar = google.calendar({ version: "v3" });
      const startDateTime = new Date(date);
      const endDateTime = new Date(startDateTime);
      endDateTime.setHours(startDateTime.getHours() + duration);

      const event = {
        summary: eventName,
        description: description,
        start: {
          dateTime: startDateTime.toISOString(),
          timeZone: timeZone,
        },
        end: {
          dateTime: endDateTime.toISOString(),
          timeZone: timeZone,
        },
        colorId: "2",
      };

      const response = await calendar.events.insert({
        calendarId: this.calendarId,
        requestBody: event,
      });

      const eventId = response.data.id;
      console.log("Evento creado con exito");
      return eventId;
    } catch (err) {
      console.error(
        "Hubo un error al cargar el evento en el servicio de calendar"
      );
      throw err;
    }
  }

  async checkAvailability(date: Date, duration: number = standardDuration): Promise<boolean> {
    try {
      const auth = await this.createAuth();
      const authClient = await auth.getClient();

      google.options({ auth: authClient as any });

      const calendar = google.calendar({ version: "v3" });
      const startDateTime = new Date(date);
      const endDateTime = new Date(startDateTime);
      endDateTime.setHours(startDateTime.getHours() + duration);

      const response = await calendar.freebusy.query({
        requestBody: {
          timeMin: startDateTime.toISOString(),
          timeMax: endDateTime.toISOString(),
          timeZone: timeZone,
          items: [{ id: this.calendarId }],
        },
      });

      const busyPeriods = response.data.calendars?.[this.calendarId]?.busy || [];
      return busyPeriods.length === 0;
    } catch (err) {
      console.error("Error checking calendar availability:", err);
      // If we can't check availability, assume it's available to not block appointments
      return true;
    }
  }
}