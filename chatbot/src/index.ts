import 'dotenv/config'
import express from 'express'
import { verifyWebhook } from './webhook/verify'
import { handleWebhook } from './webhook/handler'
import botsRouter from './routes/bots'
import { startReminderCron } from './services/reminder'

const app = express()
app.use(express.json())

// WhatsApp Cloud API webhook
app.get('/webhook', verifyWebhook)
app.post('/webhook', handleWebhook)

// Bot management API
app.use('/bots', botsRouter)

// Health check for Railway
app.get('/health', (_req, res) => res.json({ status: 'ok', ts: new Date().toISOString() }))

const PORT = process.env.PORT ?? 4000
app.listen(PORT, () => {
  console.log(`🤖 Cleverum chatbot running on port ${PORT}`)
  startReminderCron()
})
