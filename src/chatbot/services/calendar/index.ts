import { GoogleAuth, OAuth2Client } from "google-auth-library";
import { google } from "googleapis";

const googleCalendarId = process.env.GOOGLE_CALENDAR_ID;

const auth = new google.auth.GoogleAuth({
  keyFile: "./dacosta-rs-chatbot-f7a9600b0256.json",
  scopes: ["https://www.googleapis.com/auth/calendar"],
});

const calendar = google.calendar({ version: "v3" });

const calendarID = googleCalendarId;
const timeZone = "America/Mexico_City";
const standardDuration = 1;

async function createEvent(
  eventName: string,
  description: string,
  date: Date,
  duration: number = standardDuration
) {
  try {
    const authClient = await auth.getClient();
    
     // Type checking to ensure authClient is of the expected type
     if (authClient instanceof OAuth2Client || authClient instanceof GoogleAuth) {
        google.options({ auth: authClient });
      } else {
        throw new Error("Unsupported auth client type");
      }

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
      calendarId: calendarID,
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

export { createEvent };
