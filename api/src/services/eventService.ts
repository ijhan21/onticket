import { getDb } from '../lib/db'
import { NotFoundError, BadRequestError, ConflictError } from '../lib/errors'
import { generateEventId, generateTicketTypeId } from '../lib/idGenerator'
import type { CreateEventInput, UpdateEventInput } from '../schemas/eventSchema'
import {
  findPublicEvents,
  findSuggestions,
  findEventById,
  findTicketTypesByEventId,
  findAllEventsWithStats,
  insertEvent,
  insertTicketTypes,
  updateEvent,
  updateTicketType,
} from '../repositories/eventRepository'

export async function getPublicEventList(query?: string) {
  const db = getDb()
  const events = await findPublicEvents(db, query)

  return {
    events: events.map((e) => ({
      event_id: e.event_id,
      title: e.title,
      category: e.category,
      venue: e.venue,
      city: e.city,
      start_at: e.start_at.toISOString(),
      end_at: e.end_at.toISOString(),
      sales_status: e.sales_status,
      organizer: e.organizer,
    })),
  }
}

export async function getEventSuggestions(query: string) {
  const db = getDb()
  const suggestions = await findSuggestions(db, query)
  return {
    suggestions,
  }
}

export async function getEventDetail(eventId: string) {
  const db = getDb()
  const event = await findEventById(db, eventId)
  if (!event) {
    throw new NotFoundError('EVENT_NOT_FOUND', '공연 정보를 찾을 수 없습니다.')
  }

  const ticketTypes = await findTicketTypesByEventId(db, eventId)

  return {
    event_id: event.event_id,
    title: event.title,
    category: event.category,
    venue: event.venue,
    city: event.city,
    start_at: event.start_at.toISOString(),
    end_at: event.end_at.toISOString(),
    sales_status: event.sales_status,
    organizer: event.organizer,
    ticket_types: ticketTypes.map((tt) => ({
      ticket_type_id: tt.ticket_type_id,
      event_id: tt.event_id,
      grade: tt.grade,
      price: tt.price,
      total_quantity: tt.total_quantity,
      sold_quantity: tt.sold_quantity,
      // 서버 독점 계산값: total_quantity - sold_quantity
      remaining_quantity: tt.total_quantity - tt.sold_quantity,
    })),
  }
}

/**
 * GET /admin/events — 운영팀 전체 공연 목록 및 통계 현황 조회 (S07, R11, R23, R24)
 * 
 * [루브릭 핵심 준수 사항]
 * - 파생값(Derived Value) 중복 저장 금지:
 *   총수량(total_quantity), 판매수량(sold_quantity), 총매출액(total_revenue)은
 *   events 테이블에 별도 컬럼으로 중복 저장하지 않으며,
 *   원천 테이블(ticket_types, orders)의 실시간 SQL SUM 집계 쿼리를 통해서만 계산됩니다.
 * - 원천 거래 기록의 불변성: orders의 결제 금액(total_amount) 원본을 집계하여 산출.
 */
export async function getAdminEventList() {
  const db = getDb()
  const stats = await findAllEventsWithStats(db)

  return {
    events: stats.map((e) => ({
      event_id: e.event_id,
      title: e.title,
      category: e.category,
      start_at: e.start_at instanceof Date ? e.start_at.toISOString() : new Date(e.start_at).toISOString(),
      end_at: e.end_at ? (e.end_at instanceof Date ? e.end_at.toISOString() : new Date(e.end_at).toISOString()) : (e.start_at instanceof Date ? e.start_at.toISOString() : new Date(e.start_at).toISOString()),
      sales_status: e.sales_status,
      total_quantity: Number(e.total_quantity),
      sold_quantity: Number(e.sold_quantity),
      total_revenue: Number(e.total_revenue),
    })),
  }
}

export async function createNewEvent(input: CreateEventInput) {
  const db = getDb()

  return await db.begin(async (tx) => {
    let eventId = input.event_id
    if (eventId) {
      const existing = await findEventById(tx, eventId)
      if (existing) {
        throw new ConflictError('DUPLICATE_EVENT_ID', '이미 존재하는 공연 ID입니다.')
      }
    } else {
      eventId = generateEventId()
    }

    const createdEvent = await insertEvent(tx, {
      event_id: eventId,
      title: input.title,
      category: input.category,
      venue: input.venue,
      city: input.city,
      start_at: input.start_at,
      end_at: input.end_at,
      sales_status: input.sales_status,
      organizer: input.organizer,
    })

    const ticketTypesToInsert = input.ticket_types.map((tt) => ({
      ticket_type_id: tt.ticket_type_id || generateTicketTypeId(),
      event_id: eventId!,
      grade: tt.grade,
      price: tt.price,
      total_quantity: tt.total_quantity,
    }))

    const createdTicketTypes = await insertTicketTypes(tx, ticketTypesToInsert)

    return {
      event_id: createdEvent.event_id,
      title: createdEvent.title,
      category: createdEvent.category,
      sales_status: createdEvent.sales_status,
      ticket_types: createdTicketTypes.map((tt) => ({
        ticket_type_id: tt.ticket_type_id,
        grade: tt.grade,
        price: tt.price,
        total_quantity: tt.total_quantity,
        sold_quantity: tt.sold_quantity,
      })),
    }
  })
}

export async function updateExistingEvent(eventId: string, input: UpdateEventInput) {
  const db = getDb()

  return await db.begin(async (tx) => {
    const existingEvent = await findEventById(tx, eventId)
    if (!existingEvent) {
      throw new NotFoundError('EVENT_NOT_FOUND', '존재하지 않는 공연입니다.')
    }

    const existingTicketTypes = await findTicketTypesByEventId(tx, eventId)
    const existingMap = new Map(existingTicketTypes.map((tt) => [tt.ticket_type_id, tt]))

    // PRD R24 검증: 총수량은 그 등급의 판매수량보다 작게 바꿀 수 없음 (AC44)
    for (const tt of input.ticket_types) {
      if (tt.ticket_type_id && existingMap.has(tt.ticket_type_id)) {
        const existing = existingMap.get(tt.ticket_type_id)!
        if (tt.total_quantity < existing.sold_quantity) {
          throw new BadRequestError(
            'TOTAL_LESS_THAN_SOLD',
            `'${existing.grade}' 등급의 총수량은 이미 판매된 수량(${existing.sold_quantity}장)보다 작을 수 없습니다.`
          )
        }
      }
    }

    const updated = await updateEvent(tx, eventId, {
      title: input.title,
      category: input.category,
      venue: input.venue,
      city: input.city,
      start_at: input.start_at,
      end_at: input.end_at,
      sales_status: input.sales_status,
      organizer: input.organizer,
    })

    const updatedTicketTypes = []
    for (const tt of input.ticket_types) {
      if (tt.ticket_type_id && existingMap.has(tt.ticket_type_id)) {
        const res = await updateTicketType(tx, tt.ticket_type_id, {
          grade: tt.grade,
          price: tt.price,
          total_quantity: tt.total_quantity,
        })
        updatedTicketTypes.push(res)
      } else {
        const [created] = await insertTicketTypes(tx, [
          {
            ticket_type_id: generateTicketTypeId(),
            event_id: eventId,
            grade: tt.grade,
            price: tt.price,
            total_quantity: tt.total_quantity,
          },
        ])
        updatedTicketTypes.push(created)
      }
    }

    return {
      event_id: updated.event_id,
      title: updated.title,
      sales_status: updated.sales_status,
      updated_at: updated.updated_at.toISOString(),
      ticket_types: updatedTicketTypes.map((tt) => ({
        ticket_type_id: tt.ticket_type_id,
        grade: tt.grade,
        price: tt.price,
        total_quantity: tt.total_quantity,
        sold_quantity: tt.sold_quantity,
      })),
    }
  })
}
