import { apiFetch } from "./client";
import {
  CreateOrderInput,
  CreateOrderResponse,
  OrderLookupResponse,
  PaymentConfirmInput,
  PaymentConfirmResponse,
} from "@/types/order";

/**
 * 브라우저에서 직접 API로 비회원 주문 생성 (POST /orders)
 */
export async function createOrder(
  data: CreateOrderInput
): Promise<CreateOrderResponse> {
  return apiFetch<CreateOrderResponse>("/orders", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

/**
 * 결제 승인 요청 (POST /orders/:order_id/payment)
 */
export async function confirmPayment(
  orderId: string,
  data: PaymentConfirmInput
): Promise<PaymentConfirmResponse> {
  return apiFetch<PaymentConfirmResponse>(
    `/orders/${encodeURIComponent(orderId)}/payment`,
    {
      method: "POST",
      body: JSON.stringify(data),
    }
  );
}

/**
 * 비회원 티켓 조회 (GET /orders?order_id=...&purchaser_email=...)
 */
export async function lookupOrder(
  orderId: string,
  purchaserEmail: string
): Promise<OrderLookupResponse> {
  const query = new URLSearchParams({
    order_id: orderId.trim().toUpperCase(),
    purchaser_email: purchaserEmail.trim(),
  });
  return apiFetch<OrderLookupResponse>(`/orders?${query.toString()}`, {
    method: "GET",
    cache: "no-store",
  });
}
