import { Hono } from 'hono'
import { errorResponse, handleRouteError } from '../lib/http'
import { createOrderSchema, getOrderQuerySchema, paymentSchema } from '../schemas/orderSchema'
import { createNewOrder, getOrderDetail, confirmOrderPayment } from '../services/orderService'

type OrderBindings = {
  TOSS_SECRET_KEY?: string
}

const orderRouter = new Hono<{ Bindings: OrderBindings }>()

/**
 * POST /orders — 비회원 티켓 예매 주문 생성 (S02, R1, R6, R20, R22)
 * 주문 생성 시 결제대기 상태로 생성되며, 잔여 수량이 차감(판매수량 증가)됩니다.
 */
orderRouter.post('/', async (c) => {
  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return errorResponse(c, 'INVALID_JSON', '요청 본문이 올바른 JSON 형식이 아닙니다.', 400)
  }

  const parsed = createOrderSchema.safeParse(body)
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0]
    return errorResponse(c, 'INVALID_INPUT', firstIssue.message, 400)
  }

  try {
    const result = await createNewOrder(parsed.data)
    return c.json(result, 201)
  } catch (err) {
    return handleRouteError(c, err)
  }
})

/**
 * GET /orders — 주문번호와 이메일로 비회원 티켓 조회 (S05, R7, R21, R22)
 * 다요소 식별 검증: order_id와 purchaser_email이 동시에 일치해야만 조회가 허용됩니다.
 */
orderRouter.get('/', async (c) => {
  const query = {
    order_id: c.req.query('order_id') || '',
    purchaser_email: c.req.query('purchaser_email') || '',
  }

  const parsed = getOrderQuerySchema.safeParse(query)
  if (!parsed.success) {
    return errorResponse(
      c,
      'MISSING_PARAMETERS',
      '주문번호(order_id)와 구매자 이메일(purchaser_email)을 모두 올바르게 입력해 주세요.',
      400
    )
  }

  try {
    const result = await getOrderDetail(parsed.data)
    return c.json(result, 200)
  } catch (err) {
    return handleRouteError(c, err)
  }
})

/**
 * POST /orders/:order_id/payment — 결제 승인 처리 및 QR 코드 발급 (S03, R5, R7, R22)
 * 서버 승인 완료 시에만 '결제완료' 상태로 전이되며 중복 없는 고유 QR 코드가 발급됩니다.
 */
orderRouter.post('/:order_id/payment', async (c) => {
  const orderId = c.req.param('order_id')

  let body: unknown = {}
  try {
    body = await c.req.json()
  } catch {
    // 본문이 비어있으면 기본값 사용
    body = {}
  }

  const parsed = paymentSchema.safeParse(body)
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0]
    return errorResponse(c, 'INVALID_INPUT', firstIssue.message, 400)
  }

  try {
    const tossSecretKey =
      c.env?.TOSS_SECRET_KEY ||
      (typeof process !== 'undefined' ? process.env?.TOSS_SECRET_KEY : undefined)
    const result = await confirmOrderPayment(orderId, parsed.data, tossSecretKey)
    return c.json(result, 200)
  } catch (err) {
    return handleRouteError(c, err)
  }
})

export default orderRouter
