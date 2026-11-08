import { serve } from '@hono/node-server'
import app from './index'
import { setDatabaseUrl } from './lib/db'

if (process.env.DATABASE_URL) {
  setDatabaseUrl(process.env.DATABASE_URL)
}

const port = Number(process.env.PORT) || 8787

console.log(`[OnTicket API] Server is running on http://localhost:${port}`)

serve({
  fetch: app.fetch,
  port,
})
