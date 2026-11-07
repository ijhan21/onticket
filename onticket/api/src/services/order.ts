/**
 * 온티켓 주문 서비스 (OrderService)
 * 기획서(PRD) 및 아키텍처 가이드라인을 준수하는 주문 처리 로직
 */

export interface CreateOrderParams {
  eventId: string;
  ticketTypeId: string;
  purchaserEmail: string;
  quantity: number;
}

export interface TicketStock {
  ticketTypeId: string;
  totalQuantity: number;
  soldQuantity: number;
  price: number;
}

export class OrderService {
  /**
   * 주문 생성 및 재고 검증
   * 규칙: 
   * 1. 1회 예매 수량은 1~4매
   * 2. 초과 판매 원천 차단: soldQuantity + quantity <= totalQuantity
   */
  public validateOrder(stock: TicketStock, params: CreateOrderParams): { valid: boolean; totalAmount: number; error?: string } {
    if (params.quantity < 1 || params.quantity > 4) {
      return { valid: false, totalAmount: 0, error: '예매 수량은 1매에서 4매까지 가능합니다.' };
    }

    if (!params.purchaserEmail || !params.purchaserEmail.includes('@')) {
      return { valid: false, totalAmount: 0, error: '올바른 구매자 이메일을 입력해야 합니다.' };
    }

    // 초과 판매 방지 검증 (서버 측 독점 판정)
    if (stock.soldQuantity + params.quantity > stock.totalQuantity) {
      return { valid: false, totalAmount: 0, error: '남은 좌석이 부족하여 예매할 수 없습니다 (초과 판매 차단).' };
    }

    // 결제 금액 서버 계산
    const totalAmount = stock.price * params.quantity;
    return { valid: true, totalAmount };
  }
}
