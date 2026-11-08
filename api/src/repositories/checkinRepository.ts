import postgres from 'postgres'

export interface CheckinRow {
  checkin_id: string
  order_id: string
  qr_code: string
  gate: string
  checked_in_at: Date
  result: string
  created_at: Date
}

export async function insertCheckin(
  db: postgres.Sql | postgres.TransactionSql,
  checkin: {
    checkin_id: string
    order_id: string
    qr_code: string
    gate: string
    result: string
  }
): Promise<CheckinRow> {
  const rows = await db<CheckinRow[]>`
    INSERT INTO checkins (
      checkin_id, order_id, qr_code, gate, checked_in_at, result, created_at
    ) VALUES (
      ${checkin.checkin_id}, ${checkin.order_id}, ${checkin.qr_code},
      ${checkin.gate}, NOW(), ${checkin.result}, NOW()
    )
    RETURNING *
  `
  return rows[0]
}
