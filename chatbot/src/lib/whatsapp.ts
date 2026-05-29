import axios from 'axios'
import FormData from 'form-data'

const API_VERSION = process.env.WHATSAPP_API_VERSION ?? 'v20.0'
const BASE = `https://graph.facebook.com/${API_VERSION}`

export class WhatsAppWindowError extends Error {
  constructor(to: string) {
    super(`[WA] 24h window expired for ${to}`)
    this.name = 'WhatsAppWindowError'
  }
}

async function send(phoneNumberId: string, token: string, body: Record<string, unknown> & { to?: string }): Promise<void> {
  const type = body.type as string ?? 'unknown'
  await axios.post(`${BASE}/${phoneNumberId}/messages`, body, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  }).then(() => {
    console.log(`[WA] sent type=${type} to=${body.to}`)
  }).catch((err: any) => {
    const metaError = err.response?.data?.error
    if (metaError?.code === 131047) throw new WhatsAppWindowError(body.to ?? 'unknown')
    const detail = metaError?.message ?? err.message
    throw new Error(`[WA] Send failed (code ${metaError?.code ?? 'unknown'}): ${detail}`)
  })
}

export function sendText(phoneNumberId: string, token: string, to: string, text: string) {
  return send(phoneNumberId, token, {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: 'text',
    text: { body: text },
  })
}

export interface ListSection {
  title: string
  rows: { id: string; title: string; description?: string }[]
}

export function sendList(
  phoneNumberId: string,
  token: string,
  to: string,
  header: string,
  body: string,
  buttonText: string,
  sections: ListSection[]
) {
  return send(phoneNumberId, token, {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: 'interactive',
    interactive: {
      type: 'list',
      header: { type: 'text', text: header },
      body: { text: body },
      action: { button: buttonText, sections },
    },
  })
}

export interface ReplyButton {
  id: string
  title: string
}

export function sendButtons(
  phoneNumberId: string,
  token: string,
  to: string,
  body: string,
  buttons: ReplyButton[]
) {
  return send(phoneNumberId, token, {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: 'interactive',
    interactive: {
      type: 'button',
      body: { text: body },
      action: {
        buttons: buttons.map(b => ({
          type: 'reply',
          reply: { id: b.id, title: b.title },
        })),
      },
    },
  })
}

export function sendImage(
  phoneNumberId: string,
  token: string,
  to: string,
  imageUrl: string,
  caption?: string
) {
  return send(phoneNumberId, token, {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: 'image',
    image: { link: imageUrl, caption },
  })
}

// Manda una imagen ya subida a WhatsApp por su media_id. A diferencia de
// `link:`, WhatsApp ya tiene el archivo en sus servidores, así que se entrega
// sin descargarlo y respeta el orden secuencial (el menú no se le adelanta).
export function sendImageById(
  phoneNumberId: string,
  token: string,
  to: string,
  mediaId: string,
  caption?: string
) {
  return send(phoneNumberId, token, {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: 'image',
    image: { id: mediaId, caption },
  })
}

// Descarga la imagen desde su URL y la sube al endpoint /media de WhatsApp.
// Devuelve el media_id reutilizable. Se sube 1 vez por cliente y se cachea
// en clients.mascot_media_id; el media_id puede expirar, por eso el caller
// debe re-subir si un envío por id falla.
export async function uploadMedia(
  phoneNumberId: string,
  token: string,
  imageUrl: string
): Promise<string> {
  const download = await axios.get<ArrayBuffer>(imageUrl, { responseType: 'arraybuffer' })
  const buffer = Buffer.from(download.data)
  const contentType = (download.headers['content-type'] as string) ?? 'image/jpeg'
  const ext = contentType.split('/')[1]?.split(';')[0] ?? 'jpg'

  const form = new FormData()
  form.append('messaging_product', 'whatsapp')
  form.append('type', contentType)
  form.append('file', buffer, { filename: `mascot.${ext}`, contentType })

  const res = await axios.post(`${BASE}/${phoneNumberId}/media`, form, {
    headers: { ...form.getHeaders(), Authorization: `Bearer ${token}` },
  }).catch((err: any) => {
    const metaError = err.response?.data?.error
    const detail = metaError?.message ?? err.message
    throw new Error(`[WA] Media upload failed (code ${metaError?.code ?? 'unknown'}): ${detail}`)
  })

  const mediaId = (res.data as { id?: string }).id
  if (!mediaId) throw new Error('[WA] Media upload returned no id')
  console.log(`[WA] uploaded media id=${mediaId} type=${contentType}`)
  return mediaId
}
