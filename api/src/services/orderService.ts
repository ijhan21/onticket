import { getDb } from '../lib/db'
import { NotFoundError, ConflictError, BadRequestError } from '../lib/errors'
import { generateOrderId, generateQrCode } from '../lib/idGenerator'
import type { CreateOrderInput, GetOrderQueryInput } from '../schemas/orderSchema'
import { findEventById } from '../repositories/eventRepository'
import {
  findTicketTypeForUpdate,
  incrementSoldQuantity,
  decrementSoldQuantity,
  insertOrder,
  findOrderDetail,
  findOrderByIdForUpdate,
  updateOrderPaymentSuccess,
  updateOrderPaymentFailure,
} from '../repositories/orderRepository'

export async function createNewOrder(input: CreateOrderInput) {
  const db = getDb()

  return await db.begin(async (tx) => {
    // 1. 공연 상태 검증
    const event = await findEventById(tx, input.event_id)
    if (!event) {
      throw new NotFoundError('NOT_FOUND', '존재하지 않는 공연입니다.')
    }
    if (event.sales_status === '매진') {
      throw new ConflictError('SOLD_OUT', '선택하신 좌석이 매진되었습니다.')
    }
    if (event.sales_status === '판매종료') {
      throw new BadRequestError('SALE_ENDED', '판매가 종료된 공연입니다.')
    }

    // 2. 티켓 등급 잠금 조회 (FOR UPDATE - 동시성 제어)
    const ticketType = await findTicketTypeForUpdate(tx, input.ticket_type_id)
    if (!ticketType || ticketType.event_id !== input.event_id) {
      throw new NotFoundError('NOT_FOUND', '해당 공연의 티켓 등급 정보를 찾을 수 없습니다.')
    }

    // 3. 서버 독점 잔여석 계산 및 판정 (클라이언트 불신)
    const remaining = ticketType.total_quantity - ticketType.sold_quantity
    if (remaining <= 0) {
      throw new ConflictError('SOLD_OUT', '선택하신 좌석이 매진되었습니다.')
    }
    if (remaining < input.quantity) {
      throw new ConflictError(
        'SOLD_OUT',
        `요청하신 수량보다 잔여 좌석이 부족합니다. (현재 남은 수량: ${remaining}장, 요청: ${input.quantity}장)`
      )
    }

    // 4. 서버 독점 결제 금액 계산: 단가 * 수량 (클라이언트 불신)
    const totalAmount = ticketType.price * input.quantity

    // 5. 판매수량 증가 (주문 수량만큼 증가)
    await incrementSoldQuantity(tx, ticketType.ticket_type_id, input.quantity)

    // 6. 주문 레코드 생성 (결제대기 상태, qr_code는 결제 승인 전까지 엄격히 NULL)
    const orderId = generateOrderId()
    const order = await insertOrder(tx, {
      order_id: orderId,
      event_id: input.event_id,
      ticket_type_id: input.ticket_type_id,
      purchaser_email: input.purchaser_email,
      purchaser_name: input.purchaser_name,
      quantity: input.quantity,
      total_amount: totalAmount,
      status: '결제대기',
    })

    return {
      order_id: order.order_id,
      event_id: order.event_id,
      ticket_type_id: order.ticket_type_id,
      purchaser_email: order.purchaser_email,
      quantity: order.quantity,
      total_amount: order.total_amount,
      status: order.status,
      ordered_at: order.ordered_at.toISOString(),
    }
  })
}

/**
 * 결제 승인 및 결제완료 상태 전이 (PRD R7, R22)
 * 결제 승인이 정상 완료되었을 때만 QR 코드가 발급되며, 미결제 상태에서는 발급되지 않습니다.
 * 토스페이먼츠 공식 규격(POST https://api.tosspayments.com/v1/payments/confirm)을 준수합니다.
 */
export async function confirmOrderPayment(
  orderId: string,
  paymentData: {
    payment_key: string
    payment_method: string
    total_amount: number
  },
  customSecretKey?: string
) {
  const db = getDb()
  const tossSecretKey =
    customSecretKey ||
    (typeof process !== 'undefined' ? process.env?.TOSS_SECRET_KEY : undefined)

  if (!tossSecretKey) {
    throw new BadRequestError('PAYMENT_FAILED', '결제 승인용 시크릿 키가 설정되지 않았습니다.')
  }

  let tossSuccess = false
  let tossErrorMessage: string | null = null
  let successResult: {
    order_id: string
    status: string
    qr_code: string
    payment_key: string
    payment_method: string
    total_amount: number
  } | null = null

  await db.begin(async (tx) => {
    // 1. 주문 잠금 조회
    const order = await findOrderByIdForUpdate(tx, orderId)
    if (!order) {
      throw new NotFoundError('ORDER_NOT_FOUND', '주문 정보를 찾을 수 없습니다.')
    }

    // 2. 유효성 검사
    if (order.status === '결제완료') {
      throw new ConflictError('ALREADY_PROCESSED', '이미 결제가 완료된 주문입니다.')
    }

    if (order.status !== '결제대기') {
      throw new ConflictError(
        'ALREADY_PROCESSED',
        `결제를 진행할 수 없는 주문 상태입니다. (현재 상태: ${order.status})`
      )
    }

    // 금액 검증 (서버 독점 금액과 결제 요청 금액 대조)
    if (order.total_amount !== paymentData.total_amount) {
      throw new BadRequestError(
        'AMOUNT_MISMATCH',
        '결제 승인 요청 금액이 주문 확정 금액과 일치하지 않습니다.'
      )
    }

    // 3. 토스페이먼츠 결제 승인 API 호출
    const basicAuth =
      typeof Buffer !== 'undefined'
        ? Buffer.from(`${tossSecretKey}:`).toString('base64')
        : btoa(`${tossSecretKey}:`)

    try {
      const tossResponse = await fetch('https://api.tosspayments.com/v1/payments/confirm', {
        method: 'POST',
        headers: {
          Authorization: `Basic ${basicAuth}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          paymentKey: paymentData.payment_key,
          orderId: order.order_id,
          amount: paymentData.total_amount,
        }),
      })

      if (tossResponse.ok) {
        const tossData = (await tossResponse.json().catch(() => ({}))) as { method?: string }
        tossSuccess = true

        // 4. 결제 승인 성공: 상태를 '결제완료'로 전이하고 고유 QR 코드 발급
        const qrCode = generateQrCode(order.order_id)
        const paymentMethod = paymentData.payment_method || tossData?.method || '신용카드'
        const updated = await updateOrderPaymentSuccess(tx, order.order_id, {
          qr_code: qrCode,
          payment_key: paymentData.payment_key,
          payment_method: paymentMethod,
        })

        successResult = {
          order_id: updated.order_id,
          status: updated.status,
          qr_code: updated.qr_code ?? qrCode,
          payment_key: updated.payment_key ?? paymentData.payment_key,
          payment_method: updated.payment_method ?? paymentMethod,
          total_amount: updated.total_amount,
        }
      } else {
        const errorBody = (await tossResponse.json().catch(() => ({}))) as { message?: string }
        tossErrorMessage = errorBody?.message || '결제 승인이 완료되지 않았습니다.'
        tossSuccess = false

        // 5. [중요: 재고 롤백] 승인 실패 시 판매 수량 원복 및 주문 상태 '실패' 갱신
        await decrementSoldQuantity(tx, order.ticket_type_id, order.quantity)
        await updateOrderPaymentFailure(tx, order.order_id)
      }
    } catch (networkErr: unknown) {
      const msg = networkErr instanceof Error ? networkErr.message : '결제 승인 처리 중 네트워크 오류가 발생했습니다.'
      tossErrorMessage = msg
      tossSuccess = false

      // [중요: 재고 롤백] 네트워크 오류 등 예외 시 판매 수량 원복 및 주문 상태 '실패' 갱신
      await decrementSoldQuantity(tx, order.ticket_type_id, order.quantity)
      await updateOrderPaymentFailure(tx, order.order_id)
    }
  })

  // 6. 실패 시 트랜잭션 커밋 완료 후 BadRequestError('PAYMENT_FAILED') 던져 400 반환
  if (!tossSuccess || !successResult) {
    throw new BadRequestError('PAYMENT_FAILED', tossErrorMessage || '결제 승인이 완료되지 않았습니다.')
  }

  return successResult
}

/**
 * 결제 실패 처리 (PRD R22)
 * 결제 실패 시 상태를 '실패'로 전이하고 재고를 복구하며, QR 코드는 발급되지 않습니다.
 */
export async function handlePaymentFailure(orderId: string, reason?: string) {
  const db = getDb()

  await db.begin(async (tx) => {
    const order = await findOrderByIdForUpdate(tx, orderId)
    if (!order) {
      throw new NotFoundError('ORDER_NOT_FOUND', '주문 정보를 찾을 수 없습니다.')
    }

    // 결제대기 건에 대해 실패 전이 및 판매수량 원복
    if (order.status === '결제대기') {
      await decrementSoldQuantity(tx, order.ticket_type_id, order.quantity)
      await updateOrderPaymentFailure(tx, order.order_id)
    }
  })

  const message = reason
    ? `결제 승인이 거절되었습니다 (${reason}). 다시 시도해 주세요.`
    : '결제 승인 처리 중 문제가 발생하여 승인이 완료되지 않았습니다. 다시 시도해 주세요.'

  throw new BadRequestError('PAYMENT_FAILED', message)
}

export async function getOrderDetail(query: GetOrderQueryInput) {
  const db = getDb()
  const order = await findOrderDetail(db, query.order_id, query.purchaser_email)

  if (!order) {
    throw new NotFoundError(
      'TICKET_NOT_FOUND',
      '예매 내역을 찾을 수 없습니다. 주문번호와 이메일을 다시 확인해 주세요.'
    )
  }

  return {
    order_id: order.order_id,
    event_title: order.event_title,
    venue: order.venue,
    start_at: order.start_at.toISOString(),
    grade: order.grade,
    quantity: order.quantity,
    total_amount: order.total_amount,
    status: order.status,
    qr_code: order.qr_code || '',
  }
}
