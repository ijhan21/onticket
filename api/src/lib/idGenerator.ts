import crypto from 'crypto'

function getSecureRandom4(): string {
  if (typeof crypto !== 'undefined' && crypto.randomInt) {
    return crypto.randomInt(1000, 10000).toString()
  }
  return Math.floor(1000 + Math.random() * 9000).toString()
}

export function generateOrderId(): string {
  const now = new Date()
  const yyyy = now.getFullYear()
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  const random4 = getSecureRandom4()
  return `ORD-${yyyy}${mm}${dd}-${random4}`
}

export function generateEventId(): string {
  return `EV${getSecureRandom4()}`
}

export function generateTicketTypeId(): string {
  return `TT${getSecureRandom4()}`
}

export function generateCheckinId(): string {
  return `CHK${getSecureRandom4()}`
}

/**
 * PRD R7: OT-####-XXXX (####는 order_id 끝 4자리, XXXX는 16진수 4자리)
 */
export function generateQrCode(orderId: string): string {
  const digits = orderId.replace(/\D/g, '')
  const last4 = digits.length >= 4 ? digits.slice(-4) : '0001'
  let hex4: string
  if (typeof crypto !== 'undefined' && crypto.randomBytes) {
    hex4 = crypto.randomBytes(2).toString('hex').toUpperCase()
  } else {
    hex4 = Math.floor(Math.random() * 0x10000)
      .toString(16)
      .toUpperCase()
      .padStart(4, '0')
  }
  return `OT-${last4}-${hex4}`
}
