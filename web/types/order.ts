export type OrderStatus =
  | "결제대기"
  | "결제완료"
  | "입장완료"
  | "취소"
  | "환불"
  | "실패";

export interface CreateOrderInput {
  event_id: string;
  ticket_type_id: string;
  purchaser_email: string;
  purchaser_name?: string;
  quantity: number;
}

export interface CreateOrderResponse {
  order_id: string;
  event_id: string;
  ticket_type_id: string;
  purchaser_email: string;
  quantity: number;
  total_amount: number;
  status: OrderStatus;
  ordered_at: string;
}

export interface PaymentConfirmInput {
  payment_key: string;
  payment_method: string;
  total_amount: number;
}

export interface PaymentConfirmResponse {
  order_id: string;
  status: OrderStatus;
  qr_code: string;
  payment_method: string;
  total_amount: number;
}

export interface OrderLookupResponse {
  order_id: string;
  event_title: string;
  venue: string;
  start_at: string;
  grade: string;
  quantity: number;
  total_amount: number;
  status: OrderStatus;
  qr_code: string;
  checked_in_at?: string;
  gate?: string;
}
