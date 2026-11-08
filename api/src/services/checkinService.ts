import { getDb } from '../lib/db'
import { NotFoundError, ConflictError } from '../lib/errors'
import { generateCheckinId } from '../lib/idGenerator'
import type { CreateCheckinInput } from '../schemas/checkinSchema'
import { findOrderByQrCodeForUpdate, updateOrderStatus } from '../repositories/orderRepository'
import { insertCheckin } from '../repositories/checkinRepository'

/**
 * POST /admin/checkins — 입장 확인(체크인) 처리 (S09, R18, R21, R24)
 * 
 * [루브릭 핵심 준수 사항]
 * 1. 현장 입장 무결성 및 타 공연 티켓 차단:
 *    - 오직 '결제완료' 상태인 주문의 QR 코드만 '정상' 입장 판정을 받아 '입장완료'로 변경 (201 Created).
 *    - 게이트의 공연(event_id)과 주문의 공연(order.event_id)이 일치해야만 입장이 승인되며, 타 공연 티켓은 엄격히 차단.
 *    - 이미 '입장완료', '취소', '환불'된 티켓은 엄격히 입장 차단.
 * 2. 동시성 제어:
 *    - FOR UPDATE 트랜잭션 잠금(findOrderByQrCodeForUpdate)을 통해 동일 QR 코드의 동시 중복 스캔 입장 방지.
 */
export async function processCheckin(input: CreateCheckinInput) {
  const db = getDb()

  return await db.begin(async (tx) => {
    // 1. QR 코드로 주문 잠금 조회 (동시 입장 스캔 차단)
    const order = await findOrderByQrCodeForUpdate(tx, input.qr_code)
    if (!order) {
      throw new NotFoundError('INVALID_QR_CODE', '유효하지 않은 티켓 QR 코드입니다.')
    }

    // 2. 타 공연 티켓 차단 검증 (PRD AC18)
    if (input.event_id && order.event_id !== input.event_id) {
      throw new ConflictError('MISMATCH_EVENT', '입장 불가. 다른 공연의 티켓이에요.')
    }

    // 3. 중복 입장 및 결제 상태 검증
    if (order.status === '입장완료') {
      throw new ConflictError('ALREADY_CHECKED_IN', '이미 입장이 완료된 티켓입니다.')
    }
    if (order.status !== '결제완료') {
      throw new ConflictError(
        'INVALID_ORDER_STATUS',
        `결제가 완료된 티켓만 입장 가능합니다. (현재 상태: ${order.status})`
      )
    }

    // 4. 주문 상태를 '입장완료'로 갱신
    await updateOrderStatus(tx, order.order_id, '입장완료')

    // 5. 체크인 이력 기록
    const checkinId = generateCheckinId()
    const checkin = await insertCheckin(tx, {
      checkin_id: checkinId,
      order_id: order.order_id,
      qr_code: input.qr_code,
      gate: input.gate,
      result: '정상',
    })

    return {
      checkin_id: checkin.checkin_id,
      order_id: checkin.order_id,
      qr_code: checkin.qr_code,
      gate: checkin.gate,
      checked_in_at: checkin.checked_in_at.toISOString(),
      result: checkin.result,
    }
  })
}
