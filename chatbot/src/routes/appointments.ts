import { Router, Request, Response } from 'express'
import { formatInTimeZone } from 'date-fns-tz'
import { es } from 'date-fns/locale'
import supabase from '../lib/supabase'
import { GoogleCalendarService } from '../services/googleCalendar'
import {
  getAppointmentById,
  cancelAppointment,
  getAppointmentSettings,
  getDbBusyForDay,
  getDbBusyForHorizon,
  rescheduleAppointment,
} from '../lib/appointments'
import { todayISO, type Interval } from '../lib/slots'
import { AppointmentRow, AppointmentSettings } from '../types'

const router = Router()

// Carga la cita, valida permiso (super_admin o dueño) y arma settings + calendar.
// Si el cliente no tiene agenda configurada, responde 409 y devuelve null.
async function loadForReschedule(
  req: Request,
  res: Response
): Promise<{ appt: AppointmentRow; settings: AppointmentSettings; calendar: GoogleCalendarService; exclude: Interval } | null> {
  const appt = await getAppointmentById(req.params.id)
  if (!appt) {
    res.status(404).json({ error: 'Cita no encontrada' })
    return null
  }
  if (req.user?.role !== 'super_admin' && req.user?.client_id !== appt.client_id) {
    res.status(403).json({ error: 'Forbidden' })
    return null
  }
  const settings = await getAppointmentSettings(appt.client_id)
  const { data: client } = await supabase
    .from('clients')
    .select('google_calendar_id, google_calendar_key_url')
    .eq('id', appt.client_id)
    .single()

  const hasCalendar = !!(client?.google_calendar_id && client?.google_calendar_key_url)
  if (!settings?.enabled || !hasCalendar) {
    res.status(409).json({ error: 'Este cliente no tiene agenda configurada' })
    return null
  }

  const calendar = new GoogleCalendarService(client!.google_calendar_id!, client!.google_calendar_key_url!)
  // Excluir la propia cita del cálculo, para que su horario actual aparezca libre.
  const exclude: Interval = { start: new Date(appt.starts_at), end: new Date(appt.ends_at) }
  return { appt, settings, calendar, exclude }
}

// Próximos días con disponibilidad (para el date-picker).
router.get('/:id/days', async (req: Request, res: Response) => {
  try {
    const ctx = await loadForReschedule(req, res)
    if (!ctx) return
    const { appt, settings, calendar, exclude } = ctx
    const from = todayISO(settings.timezone)
    const extraBusy = await getDbBusyForHorizon(appt.client_id, from, settings, appt.id)
    const days = await calendar.getNextAvailableDays(from, settings, extraBusy, 14, new Date(), exclude)
    res.json({
      days: days.map(d => ({
        value: d,
        label: formatInTimeZone(new Date(`${d}T12:00:00Z`), 'UTC', "EEEE d 'de' MMMM", { locale: es }),
      })),
    })
  } catch (err: any) {
    console.error('[Appointments] days error:', err)
    res.status(500).json({ error: err.message })
  }
})

// Horarios libres de un día (chips de horas).
router.get('/:id/slots', async (req: Request, res: Response) => {
  try {
    const ctx = await loadForReschedule(req, res)
    if (!ctx) return
    const { appt, settings, calendar, exclude } = ctx
    const day = String(req.query.day ?? '')
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) {
      res.status(400).json({ error: 'Parámetro day inválido (YYYY-MM-DD)' })
      return
    }
    const extraBusy = await getDbBusyForDay(appt.client_id, day, settings.timezone, appt.id)
    const slots = await calendar.getAvailableSlots(day, settings, extraBusy, new Date(), exclude)
    res.json({
      slots: slots.map(s => ({ value: s.toISOString(), label: formatInTimeZone(s, settings.timezone, 'HH:mm') })),
    })
  } catch (err: any) {
    console.error('[Appointments] slots error:', err)
    res.status(500).json({ error: err.message })
  }
})

// Reagenda la cita al nuevo horario (re-check + DB + Calendar).
router.post('/:id/reschedule', async (req: Request, res: Response) => {
  try {
    const ctx = await loadForReschedule(req, res)
    if (!ctx) return
    const { appt, settings, calendar } = ctx
    const newStart = new Date(req.body?.start)
    if (isNaN(newStart.getTime())) {
      res.status(400).json({ error: 'start inválido' })
      return
    }
    // Mismo horario → no-op (evita falso "ocupado" por su propio evento).
    if (newStart.getTime() === new Date(appt.starts_at).getTime()) {
      res.json({ ok: true })
      return
    }
    const result = await rescheduleAppointment(appt, newStart, settings, calendar)
    if (!result.ok) {
      res.status(result.reason === 'slot_taken' ? 409 : 500).json({
        error: result.reason === 'slot_taken' ? 'Ese horario se acaba de ocupar' : 'No se pudo reagendar',
      })
      return
    }
    res.json({ ok: true })
  } catch (err: any) {
    console.error('[Appointments] reschedule error:', err)
    res.status(500).json({ error: err.message })
  }
})

// Cancelar una cita desde el panel: status=cancelada + borra el evento de Calendar
// (libera el slot). Permiso: super_admin o el user dueño del cliente de la cita.
router.post('/:id/cancel', async (req: Request, res: Response) => {
  try {
    const appt = await getAppointmentById(req.params.id)
    if (!appt) {
      res.status(404).json({ error: 'Cita no encontrada' })
      return
    }

    const isSuperAdmin = req.user?.role === 'super_admin'
    const isOwner = req.user?.client_id === appt.client_id
    if (!isSuperAdmin && !isOwner) {
      res.status(403).json({ error: 'Forbidden' })
      return
    }

    if (appt.status === 'cancelada') {
      res.json({ ok: true })
      return
    }

    // Calendar del cliente (para borrar el evento)
    const { data: client } = await supabase
      .from('clients')
      .select('google_calendar_id, google_calendar_key_url')
      .eq('id', appt.client_id)
      .single()

    const calendar = client?.google_calendar_id && client?.google_calendar_key_url
      ? new GoogleCalendarService(client.google_calendar_id, client.google_calendar_key_url)
      : null

    const ok = await cancelAppointment(appt, calendar)
    if (!ok) {
      res.status(500).json({ error: 'No se pudo cancelar la cita' })
      return
    }

    res.json({ ok: true })
  } catch (err: any) {
    console.error('[Appointments] cancel endpoint error:', err)
    res.status(500).json({ error: err.message })
  }
})

export default router
