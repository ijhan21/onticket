import { Hono } from 'hono'
import { handleRouteError } from '../lib/http'
import { getPublicEventList, getEventDetail } from '../services/eventService'

const eventRouter = new Hono()

/**
 * GET /events — 판매 가능한 공연 목록 조회 (S01, R1, R24)
 */
eventRouter.get('/', async (c) => {
  try {
    const result = await getPublicEventList()
    c.header('Cache-Control', 'public, max-age=5, stale-while-revalidate=30')
    return c.json(result, 200)
  } catch (err) {
    return handleRouteError(c, err)
  }
})

/**
 * GET /events/:event_id — 공연 상세 정보 및 등급별 잔여석 조회 (S02, R1, R5, R6)
 */
eventRouter.get('/:event_id', async (c) => {
  try {
    const eventId = c.req.param('event_id')
    const result = await getEventDetail(eventId)
    c.header('Cache-Control', 'public, max-age=3, stale-while-revalidate=15')
    return c.json(result, 200)
  } catch (err) {
    return handleRouteError(c, err)
  }
})

export default eventRouter
