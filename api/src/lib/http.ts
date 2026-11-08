import type { Context } from 'hono'
import type { ContentfulStatusCode } from 'hono/utils/http-status'
import { AppError } from './errors'

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

/**
 * 예외 객체를 표준 HTTP 에러 응답으로 변환하는 통합 핸들러
 */
export function handleRouteError(c: Context, err: unknown) {
  if (err instanceof AppError) {
    return errorResponse(c, err.code, err.message, err.statusCode as ContentfulStatusCode)
  }

  console.error('Unhandled Server Error:', err)
  return errorResponse(c, 'INTERNAL_SERVER_ERROR', '서버 내부 처리 중 오류가 발생했습니다.', 500)
}
