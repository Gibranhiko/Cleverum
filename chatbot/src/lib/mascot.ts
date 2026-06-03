import supabase from './supabase'
import { sendImage, sendImageById, uploadMedia } from './whatsapp'
import { ClientRow } from '../types'

/**
 * Manda la imagen del mascot por media_id (entrega rápida y en orden). Sube la
 * imagen a WhatsApp y cachea el media_id + la URL con la que se subió
 * (clients.mascot_media_id / mascot_media_url).
 *
 * Auto-sanación: re-sube si no hay media_id, si el media_id está expirado, o si
 * la imagen cambió (mascot_media_url !== mascot_image_url actual). Último recurso:
 * manda por link.
 *
 * Compartido por el bot servicios y el bot informativo.
 */
export async function sendMascotGreeting(client: ClientRow, from: string, greeting: string) {
  const { wa_phone_number_id: pid, wa_access_token: token, id: clientId } = client
  const imageUrl = client.mascot_image_url!

  async function freshUpload(): Promise<string> {
    const mediaId = await uploadMedia(pid!, token!, imageUrl)
    await supabase
      .from('clients')
      .update({ mascot_media_id: mediaId, mascot_media_url: imageUrl })
      .eq('id', clientId)
    client.mascot_media_id = mediaId
    client.mascot_media_url = imageUrl
    return mediaId
  }

  try {
    // Re-subir si: no hay media_id, o la imagen cambió desde la última subida.
    const needsUpload = !client.mascot_media_id || client.mascot_media_url !== imageUrl
    const mediaId = needsUpload ? await freshUpload() : client.mascot_media_id!
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
