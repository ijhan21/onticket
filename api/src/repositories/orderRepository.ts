import postgres from 'postgres'
import type { TicketTypeRow } from './eventRepository'

export interface OrderRow {
  order_id: string
  user_id: string | null
  event_id: string
  ticket_type_id: string
  purchaser_email: string
  purchaser_name: string | null
  quantity: number
  total_amount: number
  payment_method: string | null
  status: string
  ordered_at: Date
  qr_code: string | null
  payment_key: string | null
  created_at: Date
  updated_at: Date
}

export interface OrderDetailRow {
  order_id: string
  event_title: string
  venue: string
  start_at: Date
  grade: string
  quantity: number
  total_amount: number
  status: string
  qr_code: string | null
}

export async function findTicketTypeForUpdate(
  db: postgres.Sql | postgres.TransactionSql,
  ticketTypeId: string
): Promise<TicketTypeRow | null> {
  const rows = await db<TicketTypeRow[]>`
    SELECT 
      ticket_type_id, event_id, grade, price, 
      total_quantity, sold_quantity, created_at, updated_at
    FROM ticket_types
    WHERE ticket_type_id = ${ticketTypeId}
    FOR UPDATE
  `
  return rows.length > 0 ? rows[0] : null
}

export async function incrementSoldQuantity(
  db: postgres.Sql | postgres.TransactionSql,
  ticketTypeId: string,
  quantity: number
): Promise<TicketTypeRow> {
  const rows = await db<TicketTypeRow[]>`
    UPDATE ticket_types
    SET 
      sold_quantity = sold_quantity + ${quantity},
      updated_at = NOW()
    WHERE ticket_type_id = ${ticketTypeId}
    RETURNING *
  `
  return rows[0]
}

export async function decrementSoldQuantity(
  db: postgres.Sql | postgres.TransactionSql,
  ticketTypeId: string,
  quantity: number
): Promise<TicketTypeRow> {
  const rows = await db<TicketTypeRow[]>`
    UPDATE ticket_types
    SET 
      sold_quantity = GREATEST(0, sold_quantity - ${quantity}),
      updated_at = NOW()
    WHERE ticket_type_id = ${ticketTypeId}
    RETURNING *
  `
  return rows[0]
}

export async function insertOrder(
  db: postgres.Sql | postgres.TransactionSql,
  order: {
    order_id: string
    event_id: string
    ticket_type_id: string
    purchaser_email: string
    purchaser_name?: string
    quantity: number
    total_amount: number
    status: string
  }
): Promise<OrderRow> {
  const rows = await db<OrderRow[]>`
    INSERT INTO orders (
      order_id, user_id, event_id, ticket_type_id,
      purchaser_email, purchaser_name, quantity, total_amount,
      status, ordered_at, created_at, updated_at
    ) VALUES (
      ${order.order_id}, NULL, ${order.event_id}, ${order.ticket_type_id},
      ${order.purchaser_email}, ${order.purchaser_name || null}, ${order.quantity}, ${order.total_amount},
      ${order.status}, NOW(), NOW(), NOW()
    )
    RETURNING *
  `
  return rows[0]
}

export async function findOrderByIdForUpdate(
  db: postgres.Sql | postgres.TransactionSql,
  orderId: string
): Promise<OrderRow | null> {
  const rows = await db<OrderRow[]>`
    SELECT *
    FROM orders
    WHERE order_id = ${orderId}
    FOR UPDATE
  `
  return rows.length > 0 ? rows[0] : null
}

export async function updateOrderPaymentSuccess(
  db: postgres.Sql | postgres.TransactionSql,
  orderId: string,
  data: {
    qr_code: string
    payment_key: string
    payment_method: string
  }
): Promise<OrderRow> {
  const rows = await db<OrderRow[]>`
    UPDATE orders
    SET 
      status = '결제완료',
      qr_code = ${data.qr_code},
      payment_key = ${data.payment_key},
      payment_method = ${data.payment_method},
      updated_at = NOW()
    WHERE order_id = ${orderId}
    RETURNING *
  `
  return rows[0]
}

export async function updateOrderPaymentFailure(
  db: postgres.Sql | postgres.TransactionSql,
  orderId: string
): Promise<OrderRow> {
  const rows = await db<OrderRow[]>`
    UPDATE orders
    SET 
      status = '실패',
      qr_code = NULL,
      updated_at = NOW()
    WHERE order_id = ${orderId}
    RETURNING *
  `
  return rows[0]
}

export async function findOrderDetail(
  db: postgres.Sql | postgres.TransactionSql,
  orderId: string,
  purchaserEmail: string
): Promise<OrderDetailRow | null> {
  const rows = await db<OrderDetailRow[]>`
    SELECT 
      o.order_id,
      e.title AS event_title,
      e.venue,
      e.start_at,
      tt.grade,
      o.quantity,
      o.total_amount,
      o.status,
      o.qr_code
    FROM orders o
    INNER JOIN events e ON o.event_id = e.event_id
    INNER JOIN ticket_types tt ON o.ticket_type_id = tt.ticket_type_id
    WHERE o.order_id = ${orderId}
      AND o.purchaser_email = ${purchaserEmail}
  `
  return rows.length > 0 ? rows[0] : null
}

export async function findOrderByQrCodeForUpdate(
  db: postgres.Sql | postgres.TransactionSql,
  qrCode: string
): Promise<OrderRow | null> {
  const rows = await db<OrderRow[]>`
    SELECT *
    FROM orders
    WHERE qr_code = ${qrCode}
    FOR UPDATE
  `
  return rows.length > 0 ? rows[0] : null
}

export async function updateOrderStatus(
  db: postgres.Sql | postgres.TransactionSql,
  orderId: string,
  status: string
): Promise<OrderRow> {
  const rows = await db<OrderRow[]>`
    UPDATE orders
    SET 
      status = ${status},
      updated_at = NOW()
    WHERE order_id = ${orderId}
    RETURNING *
  `
  return rows[0]
}
