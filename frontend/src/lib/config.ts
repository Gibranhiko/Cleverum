export const CHATBOT_URL = import.meta.env.VITE_CHATBOT_URL ?? 'http://localhost:4000'
export const ADMIN_API_KEY = import.meta.env.VITE_ADMIN_API_KEY ?? ''

export const chatbotHeaders = {
  'Content-Type': 'application/json',
  'x-api-key': ADMIN_API_KEY,
}
