import 'dotenv/config'
import express from 'express'
import rateLimit from 'express-rate-limit'
import { verifyWebhook } from './webhook/verify'
import { handleWebhook } from './webhook/handler'
import botsRouter from './routes/bots'
import documentsRouter from './routes/documents'
import { requireApiKey } from './middleware/auth'
import { startReminderCron } from './services/reminder'

const app = express()
app.use(express.json())

const webhookLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests' },
})

// WhatsApp Cloud API webhook
app.get('/webhook', verifyWebhook)
app.post('/webhook', webhookLimiter, handleWebhook)

// Bot management API (requires ADMIN_API_KEY header)
app.use('/bots', requireApiKey, botsRouter)

// Document indexing API (requires ADMIN_API_KEY header)
app.use('/documents', requireApiKey, documentsRouter)

// Health check for Railway
app.get('/health', (_req, res) => res.json({ status: 'ok', ts: new Date().toISOString() }))

const PORT = process.env.PORT ?? 4000
app.listen(PORT, () => {
  console.log(`🤖 Cleverum chatbot running on port ${PORT}`)
  startReminderCron()
})
