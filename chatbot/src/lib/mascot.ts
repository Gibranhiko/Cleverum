import supabase from './supabase'
import { sendImage, sendImageById, uploadMedia } from './whatsapp'
import { ClientRow } from '../types'

/**
 * Manda la imagen del mascot por media_id (entrega rápida y en orden). Sube la
 * imagen 1 vez por cliente y cachea el media_id en clients.mascot_media_id. Si
 * el media_id está expirado/inválido, re-sube una vez. Último recurso: manda
 * por link (orden no garantizado, pero al menos llega).
 *
 * Compartido por el bot servicios y el bot informativo.
 */
export async function sendMascotGreeting(client: ClientRow, from: string, greeting: string) {
  const { wa_phone_number_id: pid, wa_access_token: token, id: clientId } = client
  const imageUrl = client.mascot_image_url!

  async function freshUpload(): Promise<string> {
    const mediaId = await uploadMedia(pid!, token!, imageUrl)
    await supabase.from('clients').update({ mascot_media_id: mediaId }).eq('id', clientId)
    client.mascot_media_id = mediaId
    return mediaId
  }

  try {
    const mediaId = client.mascot_media_id ?? (await freshUpload())
    try {
      await sendImageById(pid!, token!, from, mediaId, greeting)
    } catch {
      // media_id probablemente expirado → re-subir una vez y reintentar.
      await sendImageById(pid!, token!, from, await freshUpload(), greeting)
    }
  } catch (err) {
    console.error('[Mascot] media_id path failed, falling back to link:', err)
    await sendImage(pid!, token!, from, imageUrl, greeting)
  }
}
