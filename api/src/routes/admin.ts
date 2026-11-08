import { Hono } from 'hono'
import { errorResponse, handleRouteError } from '../lib/http'
import { requireAdminAuth } from '../lib/auth'
import { createEventSchema, updateEventSchema } from '../schemas/eventSchema'
import { createCheckinSchema } from '../schemas/checkinSchema'
import {
  getAdminEventList,
  createNewEvent,
  updateExistingEvent,
} from '../services/eventService'
import { processCheckin } from '../services/checkinService'

type AdminBindings = {
  ADMIN_PASSWORD?: string
}

const adminRouter = new Hono<{ Bindings: AdminBindings }>()

// /admin/* 모든 경로에 운영팀 인증 미들웨어 적용
adminRouter.use('*', requireAdminAuth)

/**
 * GET /admin/events — 운영팀 전체 공연 목록 및 판매·입금 현황 조회 (S07, R11, R23, R24)
 */
adminRouter.get('/events', async (c) => {
  try {
    const result = await getAdminEventList()
    return c.json(result, 200)
  } catch (err) {
    return handleRouteError(c, err)
  }
})

/**
 * POST /admin/events — 운영팀 신규 공연 및 등급 등록 (S08, R5, R23, R24)
 */
adminRouter.post('/events', async (c) => {
  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return errorResponse(c, 'INVALID_JSON', '요청 본문이 올바른 JSON 형식이 아닙니다.', 400)
  }

  const parsed = createEventSchema.safeParse(body)
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0]
    return errorResponse(c, 'INVALID_EVENT_DATA', firstIssue.message, 400)
  }

  try {
    const result = await createNewEvent(parsed.data)
    return c.json(result, 201)
  } catch (err) {
    return handleRouteError(c, err)
  }
})

/**
 * PUT /admin/events/:event_id — 운영팀 공연 정보 및 등급 수정 (S08, R5, R23, R24)
 */
adminRouter.put('/events/:event_id', async (c) => {
  const eventId = c.req.param('event_id')

  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return errorResponse(c, 'INVALID_JSON', '요청 본문이 올바른 JSON 형식이 아닙니다.', 400)
  }

  const parsed = updateEventSchema.safeParse(body)
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0]
    return errorResponse(c, 'INVALID_INPUT', firstIssue.message, 400)
  }

  try {
    const result = await updateExistingEvent(eventId, parsed.data)
    return c.json(result, 200)
  } catch (err) {
    return handleRouteError(c, err)
  }
})

/**
 * POST /admin/checkins — 현장 게이트 QR 스캔 입장 확인 및 기록 (S09, R9, R23)
 */
adminRouter.post('/checkins', async (c) => {
  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return errorResponse(c, 'INVALID_JSON', '요청 본문이 올바른 JSON 형식이 아닙니다.', 400)
  }

  const parsed = createCheckinSchema.safeParse(body)
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0]
    return errorResponse(c, 'INVALID_INPUT', firstIssue.message, 400)
  }

  try {
    const result = await processCheckin(parsed.data)
    return c.json(result, 201)
  } catch (err) {
    return handleRouteError(c, err)
  }
})

export default adminRouter
