import type { Context } from 'hono'
import type { ContentfulStatusCode } from 'hono/utils/http-status'

export interface ApiError {
  error: {
    code: string
    message: string
  }
}

/**
 * 통일된 에러 응답 헬퍼
 * docs/가이드/프로젝트구조.md 3.2: { error: { code, message } } + 상태코드
 */
export function errorResponse(
  c: Context,
  code: string,
  message: string,
  status: ContentfulStatusCode = 400
) {
  return c.json<ApiError>(
    {
      error: {
        code,
        message,
      },
    },
    status
  )
}
