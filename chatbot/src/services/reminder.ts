import cron from 'node-cron'
import { format } from 'date-fns'
import { toZonedTime } from 'date-fns-tz'
import supabase from '../lib/supabase'
import { sendText } from '../lib/whatsapp'

const TIMEZONE = 'America/Mexico_City'

function shouldSend(reminder: any, now: Date): boolean {
  const local = toZonedTime(now, TIMEZONE)
  if (local.getHours() !== reminder.hour || local.getMinutes() !== reminder.minute) return false

  const { frequency, last_sent } = reminder
  if (!last_sent) return true

  const lastLocal = toZonedTime(new Date(last_sent), TIMEZONE)

  if (frequency === 'daily') {
    return format(local, 'yyyy-MM-dd') !== format(lastLocal, 'yyyy-MM-dd')
  }
  if (frequency === 'weekly') {
    return format(local, 'yyyy-ww') !== format(lastLocal, 'yyyy-ww')
  }
  if (frequency === 'monthly') {
    return format(local, 'yyyy-MM') !== format(lastLocal, 'yyyy-MM')
  }
  return false
}

async function runReminders() {
  const now = new Date()

  const { data: reminders } = await supabase
    .from('reminders')
    .select('*, clients(wa_phone_number_id, wa_access_token)')
    .eq('active', true)

  for (const reminder of reminders ?? []) {
    if (!shouldSend(reminder, now)) continue

    const client = reminder.clients as any
    if (!client?.wa_phone_number_id || !client?.wa_access_token) continue

    let recipients: string[] = reminder.phone_numbers ?? []
    if (recipients.length === 0) {
      const { data: sessions } = await supabase
        .from('conversation_sessions')
        .select('phone_number')
        .eq('client_id', reminder.client_id)
      recipients = (sessions ?? []).map((s: any) => s.phone_number)
    }

    for (const phone of recipients) {
      await sendText(client.wa_phone_number_id, client.wa_access_token, phone, reminder.message)
    }

    await supabase
      .from('reminders')
      .update({ last_sent: now.toISOString() })
      .eq('id', reminder.id)

    console.log(`[Reminders] Sent reminder ${reminder.id}`)
  }
}

export function startReminderCron() {
  // Run every 30 minutes (aligns with allowed minute values: 0 and 30)
  cron.schedule('0,30 8-21 * * *', runReminders, { timezone: TIMEZONE })
  console.log('[Reminders] Cron started')
}
