import { z } from 'zod'

export const ticketTypeInputSchema = z.object({
  ticket_type_id: z.string().optional(),
  grade: z.string().min(1, '등급명을 입력해 주세요.'),
  price: z.number().int().nonnegative('가격은 0원 이상이어야 합니다.'),
  total_quantity: z.number().int().nonnegative('총수량은 0 이상이어야 합니다.'),
})

export const createEventSchema = z.object({
  event_id: z.string().optional(),
  title: z.string().min(1, '공연 제목을 입력해 주세요.').max(200),
  category: z.string().min(1, '카테고리를 입력해 주세요.').max(50),
  venue: z.string().min(1, '장소를 입력해 주세요.').max(200),
  city: z.string().min(1, '도시를 입력해 주세요.').max(50),
  start_at: z.string().min(1, '시작일시를 입력해 주세요.'),
  end_at: z.string().min(1, '종료일시를 입력해 주세요.'),
  sales_status: z.enum(['판매중', '매진', '판매종료'], {
    message: "판매상태는 '판매중', '매진', '판매종료' 중 하나여야 합니다.",
  }).default('판매중'),
  organizer: z.string().max(100).default('(주)승승장구'),
  ticket_types: z
    .array(ticketTypeInputSchema)
    .min(1, '최소 1개 이상의 티켓 등급이 필요합니다.')
    .max(4, '티켓 등급은 최대 4개까지만 등록 가능합니다.'),
})

export const updateEventSchema = z.object({
  title: z.string().min(1, '공연 제목을 입력해 주세요.').max(200),
  category: z.string().min(1, '카테고리를 입력해 주세요.').max(50),
  venue: z.string().min(1, '장소를 입력해 주세요.').max(200),
  city: z.string().min(1, '도시를 입력해 주세요.').max(50),
  start_at: z.string().min(1, '시작일시를 입력해 주세요.'),
  end_at: z.string().min(1, '종료일시를 입력해 주세요.'),
  sales_status: z.enum(['판매중', '매진', '판매종료']),
  organizer: z.string().max(100).default('(주)승승장구'),
  ticket_types: z.array(ticketTypeInputSchema).min(1).max(4),
})

export type CreateEventInput = z.infer<typeof createEventSchema>
export type UpdateEventInput = z.infer<typeof updateEventSchema>
export type TicketTypeInput = z.infer<typeof ticketTypeInputSchema>
