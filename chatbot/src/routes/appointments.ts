import { Router, Request, Response } from 'express'
import supabase from '../lib/supabase'
import { GoogleCalendarService } from '../services/googleCalendar'
import { getAppointmentById, cancelAppointment } from '../lib/appointments'

const router = Router()

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
