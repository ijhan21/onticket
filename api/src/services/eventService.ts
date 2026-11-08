import { getDb } from '../lib/db'
import { NotFoundError, BadRequestError, ConflictError } from '../lib/errors'
import { generateEventId, generateTicketTypeId } from '../lib/idGenerator'
import type { CreateEventInput, UpdateEventInput } from '../schemas/eventSchema'
import {
  findPublicEvents,
  findEventById,
  findTicketTypesByEventId,
  findAllEventsWithStats,
  insertEvent,
  insertTicketTypes,
  updateEvent,
  updateTicketType,
} from '../repositories/eventRepository'

export async function getPublicEventList() {
  const db = getDb()
  const events = await findPublicEvents(db)

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

export async function getAdminEventList() {
  const db = getDb()
  const stats = await findAllEventsWithStats(db)

  return {
    events: stats.map((e) => ({
      event_id: e.event_id,
      title: e.title,
      category: e.category,
      start_at: e.start_at.toISOString(),
      end_at: e.end_at ? e.end_at.toISOString() : e.start_at.toISOString(),
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
