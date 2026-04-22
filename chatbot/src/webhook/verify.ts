import { Request, Response } from 'express'

export function verifyWebhook(req: Request, res: Response) {
  const mode = req.query['hub.mode']
  const token = req.query['hub.verify_token']
  const challenge = req.query['hub.challenge']

  if (mode === 'subscribe' && token === process.env.WHATSAPP_WEBHOOK_SECRET) {
    console.log('[Webhook] Verified by Meta')
    res.status(200).send(challenge)
  } else {
    console.warn('[Webhook] Verification failed')
    res.sendStatus(403)
  }
}
