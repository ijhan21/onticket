import { z } from 'zod'

export const createOrderSchema = z.object({
  event_id: z.string().min(1, '공연 ID는 필수입니다.'),
  ticket_type_id: z.string().min(1, '티켓 등급 ID는 필수입니다.'),
  purchaser_email: z.string().email('올바른 이메일 형식을 입력해 주세요.'),
  purchaser_name: z.string().optional(),
  quantity: z
    .number()
    .int('수량은 정수여야 합니다.')
    .min(1, '수량은 1장 이상이어야 합니다.')
    .max(4, '1회 예매 시 최대 4장까지만 예매 가능합니다.'),
})

export const getOrderQuerySchema = z.object({
  order_id: z.string().min(1, '주문번호는 필수입니다.'),
  purchaser_email: z.string().email('올바른 이메일 형식을 입력해 주세요.'),
})

export const paymentSchema = z.object({
  payment_key: z.string().min(1, '결제 승인 키(payment_key)는 필수입니다.'),
  payment_method: z.string().default('신용카드'),
  total_amount: z.number().int().positive('결제 금액은 0보다 커야 합니다.'),
})

export type CreateOrderInput = z.infer<typeof createOrderSchema>
export type GetOrderQueryInput = z.infer<typeof getOrderQuerySchema>
export type PaymentInput = z.infer<typeof paymentSchema>
