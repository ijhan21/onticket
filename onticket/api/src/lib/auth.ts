import type { Context, Next } from 'hono'
import { errorResponse } from './http'

type AuthBindings = {
  ADMIN_PASSWORD?: string
}

/**
 * 운영팀 인증 미들웨어
 * docs/가이드/프로젝트구조.md 3.2: X-Admin-Password 머리 확인, 없거나 틀리면 401
 */
export async function requireAdminAuth(c: Context<{ Bindings: AuthBindings }>, next: Next) {
  const adminPassword = c.req.header('X-Admin-Password')
  const expectedPassword = c.env?.ADMIN_PASSWORD

  if (!adminPassword || !expectedPassword || adminPassword !== expectedPassword) {
    return errorResponse(c, 'UNAUTHORIZED', '관리자 인증이 필요합니다.', 401)
  }

  await next()
}
