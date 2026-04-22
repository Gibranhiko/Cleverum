import axios from 'axios'

const BASE = 'https://graph.facebook.com/v19.0'

async function send(phoneNumberId: string, token: string, body: object) {
  try {
    await axios.post(`${BASE}/${phoneNumberId}/messages`, body, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    })
  } catch (err: any) {
    console.error('[WA] Send error:', err.response?.data ?? err.message)
  }
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
