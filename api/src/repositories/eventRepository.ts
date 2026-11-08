import postgres from 'postgres'

export interface EventRow {
  event_id: string
  title: string
  category: string
  venue: string
  city: string
  start_at: Date
  end_at: Date
  sales_status: string
  organizer: string
  created_at: Date
  updated_at: Date
}

export interface PublicEventRow extends EventRow {
  is_closing_soon: boolean
  is_sold_out: boolean
}

export interface TicketTypeRow {
  ticket_type_id: string
  event_id: string
  grade: string
  price: number
  total_quantity: number
  sold_quantity: number
  created_at: Date
  updated_at: Date
}

export interface AdminEventStatRow {
  event_id: string
  title: string
  category: string
  start_at: Date
  end_at: Date
  sales_status: string
  total_quantity: number
  sold_quantity: number
  total_revenue: number
}

export interface EventSuggestion {
  text: string
  type: 'event' | 'category' | 'venue'
  eventId?: string
  subtext?: string
}

export async function findPublicEvents(
  db: postgres.Sql | postgres.TransactionSql,
  query?: string
): Promise<PublicEventRow[]> {
  if (query && query.trim()) {
    const pattern = `%${query.trim()}%`
    const rows = await db<PublicEventRow[]>`
      SELECT 
        e.event_id, e.title, e.category, e.venue, e.city, 
        e.start_at, e.end_at, e.sales_status, e.organizer, 
        e.created_at, e.updated_at,
        (
          e.sales_status = '매진' OR NOT EXISTS (
            SELECT 1 FROM ticket_types tt 
            WHERE tt.event_id = e.event_id 
              AND (tt.total_quantity - tt.sold_quantity) > 0
          )
        ) AS is_sold_out,
        (
          e.sales_status = '판매중'
          AND EXISTS (
            SELECT 1 FROM ticket_types tt 
            WHERE tt.event_id = e.event_id 
              AND (tt.total_quantity - tt.sold_quantity) > 0
          )
          AND EXISTS (
            SELECT 1 FROM ticket_types tt 
            WHERE tt.event_id = e.event_id 
              AND (tt.total_quantity - tt.sold_quantity) >= 1 
              AND (tt.total_quantity - tt.sold_quantity) <= 5
          )
        ) AS is_closing_soon
      FROM events e
      WHERE e.sales_status IN ('판매중', '매진')
        AND (
          e.title ILIKE ${pattern} OR 
          e.category ILIKE ${pattern} OR 
          e.venue ILIKE ${pattern} OR 
          e.city ILIKE ${pattern}
        )
      ORDER BY e.start_at ASC
    `
    return rows
  }

  const rows = await db<PublicEventRow[]>`
    SELECT 
      e.event_id, e.title, e.category, e.venue, e.city, 
      e.start_at, e.end_at, e.sales_status, e.organizer, 
      e.created_at, e.updated_at,
      (
        e.sales_status = '매진' OR NOT EXISTS (
          SELECT 1 FROM ticket_types tt 
          WHERE tt.event_id = e.event_id 
            AND (tt.total_quantity - tt.sold_quantity) > 0
        )
      ) AS is_sold_out,
      (
        e.sales_status = '판매중'
        AND EXISTS (
          SELECT 1 FROM ticket_types tt 
          WHERE tt.event_id = e.event_id 
            AND (tt.total_quantity - tt.sold_quantity) > 0
        )
        AND EXISTS (
          SELECT 1 FROM ticket_types tt 
          WHERE tt.event_id = e.event_id 
            AND (tt.total_quantity - tt.sold_quantity) >= 1 
            AND (tt.total_quantity - tt.sold_quantity) <= 5
        )
      ) AS is_closing_soon
    FROM events e
    WHERE e.sales_status IN ('판매중', '매진')
    ORDER BY e.start_at ASC
  `
  return rows
}

export async function findSuggestions(
  db: postgres.Sql | postgres.TransactionSql,
  query: string
): Promise<EventSuggestion[]> {
  const trimmed = query.trim()
  if (!trimmed) {
    return []
  }

  const pattern = `%${trimmed}%`
  const rows = await db<EventRow[]>`
    SELECT 
      event_id, title, category, venue, city, 
      start_at, end_at, sales_status, organizer, 
      created_at, updated_at
    FROM events
    WHERE sales_status IN ('판매중', '매진')
      AND (
        title ILIKE ${pattern} OR 
        category ILIKE ${pattern} OR 
        venue ILIKE ${pattern} OR 
        city ILIKE ${pattern}
      )
    ORDER BY start_at ASC
    LIMIT 10
  `

  const suggestions: EventSuggestion[] = []
  const seenTexts = new Set<string>()
  const lowerQ = trimmed.toLowerCase()

  // 1. 카테고리 매칭
  for (const row of rows) {
    if (row.category.toLowerCase().includes(lowerQ) && !seenTexts.has(row.category)) {
      seenTexts.add(row.category)
      suggestions.push({
        text: row.category,
        type: 'category',
        subtext: '카테고리',
      })
    }
  }

  // 2. 공연 제목 매칭
  for (const row of rows) {
    if (row.title.toLowerCase().includes(lowerQ) && !seenTexts.has(row.title)) {
      seenTexts.add(row.title)
      suggestions.push({
        text: row.title,
        type: 'event',
        eventId: row.event_id,
        subtext: `${row.category} · ${row.venue}`,
      })
    }
  }

  // 3. 공연장 매칭
  for (const row of rows) {
    if (row.venue.toLowerCase().includes(lowerQ) && !seenTexts.has(row.venue)) {
      seenTexts.add(row.venue)
      suggestions.push({
        text: row.venue,
        type: 'venue',
        subtext: '공연장',
      })
    }
  }

  return suggestions.slice(0, 8)
}

export async function findEventById(
  db: postgres.Sql | postgres.TransactionSql,
  eventId: string
): Promise<EventRow | null> {
  const rows = await db<EventRow[]>`
    SELECT 
      event_id, title, category, venue, city, 
      start_at, end_at, sales_status, organizer, 
      created_at, updated_at
    FROM events
    WHERE event_id = ${eventId}
  `
  return rows.length > 0 ? rows[0] : null
}

export async function findTicketTypesByEventId(
  db: postgres.Sql | postgres.TransactionSql,
  eventId: string
): Promise<TicketTypeRow[]> {
  const rows = await db<TicketTypeRow[]>`
    SELECT 
      ticket_type_id, event_id, grade, price, 
      total_quantity, sold_quantity, created_at, updated_at
    FROM ticket_types
    WHERE event_id = ${eventId}
    ORDER BY price DESC, created_at ASC
  `
  return rows
}

export async function findAllEventsWithStats(
  db: postgres.Sql | postgres.TransactionSql
): Promise<AdminEventStatRow[]> {
  const rows = await db<AdminEventStatRow[]>`
    SELECT 
      e.event_id,
      e.title,
      e.category,
      e.start_at,
      e.end_at,
      e.sales_status,
      COALESCE(SUM(tt.total_quantity), 0)::int AS total_quantity,
      COALESCE(SUM(tt.sold_quantity), 0)::int AS sold_quantity,
      COALESCE((
        SELECT SUM(o.total_amount)
        FROM orders o
        WHERE o.event_id = e.event_id
          AND o.status IN ('결제완료', '입장완료')
      ), 0)::int AS total_revenue
    FROM events e
    LEFT JOIN ticket_types tt ON e.event_id = tt.event_id
    GROUP BY e.event_id, e.title, e.category, e.start_at, e.end_at, e.sales_status
    ORDER BY e.start_at ASC
  `
  return rows
}

export async function insertEvent(
  db: postgres.Sql | postgres.TransactionSql,
  event: {
    event_id: string
    title: string
    category: string
    venue: string
    city: string
    start_at: string
    end_at: string
    sales_status: string
    organizer: string
  }
): Promise<EventRow> {
  const rows = await db<EventRow[]>`
    INSERT INTO events (
      event_id, title, category, venue, city, 
      start_at, end_at, sales_status, organizer, 
      created_at, updated_at
    ) VALUES (
      ${event.event_id}, ${event.title}, ${event.category}, ${event.venue}, ${event.city},
      ${event.start_at}, ${event.end_at}, ${event.sales_status}, ${event.organizer},
      NOW(), NOW()
    )
    RETURNING *
  `
  return rows[0]
}

export async function insertTicketTypes(
  db: postgres.Sql | postgres.TransactionSql,
  ticketTypes: {
    ticket_type_id: string
    event_id: string
    grade: string
    price: number
    total_quantity: number
  }[]
): Promise<TicketTypeRow[]> {
  const results: TicketTypeRow[] = []
  for (const tt of ticketTypes) {
    const rows = await db<TicketTypeRow[]>`
      INSERT INTO ticket_types (
        ticket_type_id, event_id, grade, price, 
        total_quantity, sold_quantity, created_at, updated_at
      ) VALUES (
        ${tt.ticket_type_id}, ${tt.event_id}, ${tt.grade}, ${tt.price},
        ${tt.total_quantity}, 0, NOW(), NOW()
      )
      RETURNING *
    `
    results.push(rows[0])
  }
  return results
}

export async function updateEvent(
  db: postgres.Sql | postgres.TransactionSql,
  eventId: string,
  event: {
    title: string
    category: string
    venue: string
    city: string
    start_at: string
    end_at: string
    sales_status: string
    organizer: string
  }
): Promise<EventRow> {
  const rows = await db<EventRow[]>`
    UPDATE events
    SET 
      title = ${event.title},
      category = ${event.category},
      venue = ${event.venue},
      city = ${event.city},
      start_at = ${event.start_at},
      end_at = ${event.end_at},
      sales_status = ${event.sales_status},
      organizer = ${event.organizer},
      updated_at = NOW()
    WHERE event_id = ${eventId}
    RETURNING *
  `
  return rows[0]
}

export async function updateTicketType(
  db: postgres.Sql | postgres.TransactionSql,
  ticketTypeId: string,
  data: {
    grade: string
    price: number
    total_quantity: number
  }
): Promise<TicketTypeRow> {
  const rows = await db<TicketTypeRow[]>`
    UPDATE ticket_types
    SET
      grade = ${data.grade},
      price = ${data.price},
      total_quantity = ${data.total_quantity},
      updated_at = NOW()
    WHERE ticket_type_id = ${ticketTypeId}
    RETURNING *
  `
  return rows[0]
}
