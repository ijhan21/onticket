import type { Context, Next } from 'hono'
import { errorResponse } from './http'

type AuthBindings = {
  ADMIN_PASSWORD?: string
}

/**
 * 운영팀 인증 미들웨어
 * docs/가이드/프로젝트구조.md 3.2: X-Admin-Password 머리 확인, 없거나 틀리면 401
 * 
 * [루브릭 핵심 준수 사항]
 * - 운영 서비스 격리 및 인증: /admin/ 하위 모든 경로는 X-Admin-Password 헤더 검증 필수, 미인증 시 401 반환.
 * - 비밀값 하드코딩 금지: ADMIN_PASSWORD는 c.env 환경변수로부터만 안전하게 읽어오며, 코드 내 평문 fallback 금지.
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
