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
  const expectedPassword =
    c.env?.ADMIN_PASSWORD ||
    (typeof process !== 'undefined' ? process.env?.ADMIN_PASSWORD : undefined)

  if (!expectedPassword) {
    return errorResponse(c, 'SERVER_CONFIG_ERROR', '서버 인증 설정이 구성되지 않았습니다.', 500)
  }

  if (!adminPassword || adminPassword !== expectedPassword) {
    return errorResponse(c, 'UNAUTHORIZED', '관리자 인증이 필요합니다.', 401)
  }

  await next()
}
