import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { swaggerUI } from '@hono/swagger-ui'
import { setDatabaseUrl } from './lib/db'
import openApiSpec from './openapi.json'
import eventRouter from './routes/events'
import orderRouter from './routes/orders'
import adminRouter from './routes/admin'

type Bindings = {
  WEB_ORIGIN?: string
  DATABASE_URL?: string
  ADMIN_PASSWORD?: string
  TOSS_SECRET_KEY?: string
}

const app = new Hono<{ Bindings: Bindings }>()

// 공통 환경변수 초기화 및 CORS 미들웨어
app.use('*', async (c, next) => {
  if (c.env?.DATABASE_URL) {
    setDatabaseUrl(c.env.DATABASE_URL)
  }

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

// 서버 헬스체크
app.get('/health', (c) => {
  return c.json({ status: 'ok' })
})

// Swagger UI 및 OpenAPI 스펙 제공
app.get('/ui', swaggerUI({ url: '/openapi.json' }))
app.get('/swagger', swaggerUI({ url: '/openapi.json' }))
app.get('/openapi.json', (c) => {
  return c.json(openApiSpec)
})

// 엔드포인트 라우터 마운트
app.route('/events', eventRouter)
app.route('/orders', orderRouter)
app.route('/admin', adminRouter)

export default app
