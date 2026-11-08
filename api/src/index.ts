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
  HYPERDRIVE?: {
    connectionString: string
  }
}

const app = new Hono<{ Bindings: Bindings }>()

// CORS 설정 (모든 도메인 허용 및 프리플라이트 처리)
app.use('*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'X-Admin-Password', 'Authorization'],
}))

// DB 초기화 미들웨어
app.use('*', async (c, next) => {
  const dbUrl = c.env?.HYPERDRIVE?.connectionString || c.env?.DATABASE_URL
  if (dbUrl) {
    setDatabaseUrl(dbUrl)
  }
  await next()
})

// 루트 접속 시 Swagger UI로 자동 리다이렉트
app.get('/', (c) => {
  return c.redirect('/ui')
})

// 서버 헬스체크
app.get('/health', (c) => {
  return c.json({ status: 'ok' })
})

// Swagger UI 및 OpenAPI 스펙 제공
app.get('/ui', swaggerUI({ url: '/openapi.json' }))
app.get('/swagger', swaggerUI({ url: '/openapi.json' }))
app.get('/openapi.json', (c) => {
  const origin = new URL(c.req.url).origin
  const spec = {
    ...openApiSpec,
    servers: [
      { url: origin, description: '현재 실행 중인 서버' },
      ...openApiSpec.servers,
    ],
  }
  return c.json(spec)
})

// 엔드포인트 라우터 마운트
app.route('/events', eventRouter)
app.route('/orders', orderRouter)
app.route('/admin', adminRouter)

export default app
