import { z } from 'zod'

export const createCheckinSchema = z.object({
  qr_code: z.string().min(1, 'QR 코드는 필수입니다.'),
  gate: z.string().min(1, '게이트 정보는 필수입니다.'),
  event_id: z.string().optional(),
})

export type CreateCheckinInput = z.infer<typeof createCheckinSchema>
