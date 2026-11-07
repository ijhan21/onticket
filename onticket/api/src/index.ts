import { Hono } from 'hono'
import { cors } from 'hono/cors'

type Bindings = {
  WEB_ORIGIN?: string
}

const app = new Hono<{ Bindings: Bindings }>()

app.use('*', async (c, next) => {
  const allowedOrigin = c.env?.WEB_ORIGIN || 'http://localhost:3000'
  const corsMiddleware = cors({
    origin: (requestOrigin) => {
      if (!requestOrigin || requestOrigin === allowedOrigin || requestOrigin === 'http://localhost:3000') {
        return requestOrigin || allowedOrigin
      }
      return allowedOrigin
    },
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'X-Admin-Password'],
  })
  return corsMiddleware(c, next)
})

app.get('/health', (c) => {
  return c.json({ status: 'ok' })
})

export default app
