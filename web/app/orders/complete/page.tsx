"use client";

import React, { useEffect, useState, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import { CustomerHeader } from "@/components/ui/CustomerHeader";
import { confirmPayment, lookupOrder } from "@/lib/api-client/orders";
import { fetchEventById } from "@/lib/api-client/events";
import { OrderLookupResponse } from "@/types/order";
import { EventDetail } from "@/types/event";
import { formatDate, formatPrice } from "@/lib/utils/format";
import { ApiClientError } from "@/types/api";

function OrderCompleteContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const orderId =
    searchParams.get("order_id") || searchParams.get("orderId") || "";
  const paymentKey =
    searchParams.get("paymentKey") || searchParams.get("payment_key") || "";
  const eventId = searchParams.get("eid") || "";
  const email = searchParams.get("email") || "";
  const amountStr = searchParams.get("amount") || "0";
  const amount = parseInt(amountStr, 10);
  const tt = searchParams.get("tt") || "";
  const qty = searchParams.get("qty") || "1";

  const [isConfirming, setIsConfirming] = useState<boolean>(true);
  const [orderDetail, setOrderDetail] = useState<OrderLookupResponse | null>(null);
  const [eventDetail, setEventDetail] = useState<EventDetail | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const hasProcessedRef = useRef(false);

  useEffect(() => {
    if (!orderId) {
      setIsConfirming(false);
      setErrorMessage("주문번호가 없습니다. 공연 목록에서 다시 예매해 주세요.");
      return;
    }

    if (hasProcessedRef.current) return;
    hasProcessedRef.current = true;

    async function processOrder() {
      try {
        // 1. 이미 결제완료된 주문인지 먼저 확인 (새로고침 등 대비)
        if (email) {
          try {
            const existing = await lookupOrder(orderId, email);
            if (existing.status === "결제완료" || existing.status === "입장완료") {
              setOrderDetail(existing);
              setIsConfirming(false);
              return;
            }
          } catch {
            // 아직 조회가 안 되거나 결제대기 상태인 경우 승인 진행
          }
        }

        // 2. 서버 결제 승인 요청 (POST /orders/:order_id/payment)
        try {
          await confirmPayment(orderId, {
            payment_key: paymentKey || `toss_pay_${Date.now()}`,
            payment_method: "카드",
            total_amount: isNaN(amount) || amount <= 0 ? 10000 : amount,
          });
        } catch (confirmErr: unknown) {
          if (confirmErr instanceof ApiClientError) {
            // 이미 결제 완료된 건은 정상으로 처리 (AC14, AC27)
            if (confirmErr.code === "ALREADY_PAID") {
              // 성공으로 계속 진행
            } else if (
              confirmErr.code === "SOLD_OUT" ||
              confirmErr.code === "INSUFFICIENT_STOCK"
            ) {
              // 잔여수량 부족으로 승인 거절 시 결제 실패 화면(S04)으로 이동 (AC29)
              router.replace(
                `/orders/fail?reason=reject&eid=${encodeURIComponent(
                  eventId
                )}&tt=${encodeURIComponent(tt)}&qty=${encodeURIComponent(
                  qty
                )}&email=${encodeURIComponent(email)}&order_id=${encodeURIComponent(orderId)}`
              );
              return;
            } else {
              // 기타 승인 실패 시 결제 실패 화면(S04)으로 이동
              router.replace(
                `/orders/fail?reason=fail&code=${encodeURIComponent(
                  confirmErr.code || ""
                )}&message=${encodeURIComponent(
                  confirmErr.message || ""
                )}&eid=${encodeURIComponent(eventId)}&tt=${encodeURIComponent(
                  tt
                )}&qty=${encodeURIComponent(qty)}&email=${encodeURIComponent(
                  email
                )}&order_id=${encodeURIComponent(orderId)}`
              );
              return;
            }
          } else {
            throw confirmErr;
          }
        }

        // 3. 승인 완료 후 티켓 상세 정보 조회
        if (email) {
          try {
            const detail = await lookupOrder(orderId, email);
            setOrderDetail(detail);
          } catch {
            // lookup 조회 실패 시 eventDetail 로 대체
          }
        }

        if (eventId) {
          const ev = await fetchEventById(eventId).catch(() => null);
          if (ev) setEventDetail(ev);
        }
      } catch (err: unknown) {
        if (err instanceof ApiClientError) {
          if (
            err.code === "SOLD_OUT" ||
            err.code === "INSUFFICIENT_STOCK"
          ) {
            router.replace(
              `/orders/fail?reason=reject&eid=${encodeURIComponent(
                eventId
              )}&tt=${encodeURIComponent(tt)}&qty=${encodeURIComponent(
                qty
              )}&email=${encodeURIComponent(email)}&order_id=${encodeURIComponent(orderId)}`
            );
            return;
          }
        }

        // 에러 발생 시 재조회 시도
        if (email) {
          try {
            const detail = await lookupOrder(orderId, email);
            if (detail.status === "결제완료" || detail.status === "입장완료") {
              setOrderDetail(detail);
              setIsConfirming(false);
              return;
            }
          } catch {
            // 조회 불가 시 아래 메시지
          }
        }

        setErrorMessage(
          "결제를 확인하고 있어요. 잠시 뒤 티켓 조회에서 주문번호와 이메일로 확인해 주세요."
        );
      } finally {
        setIsConfirming(false);
      }
    }

    processOrder();
  }, [orderId, paymentKey, eventId, email, amount, tt, qty, router]);

  return (
    <main
      className="w-full max-w-[var(--layout-content-max)] mx-auto min-h-screen bg-bg border-x border-border flex flex-col"
      aria-label="S03 결제 완료"
    >
      <CustomerHeader />

      <div className="p-4 flex flex-col gap-5 flex-1">
        {/* 승인 확인 중 상태 (S03-T5) */}
        {isConfirming && (
          <div className="flex flex-col gap-4 py-8">
            <div className="flex items-center gap-3">
              <span className="spinner" aria-hidden="true" />
              <h1 className="text-title font-bold leading-tight">
                결제를 확인하고 있어요
              </h1>
            </div>
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-body">
              <dt className="text-caption text-text-muted pt-1">주문번호</dt>
              <dd className="font-bold num">{orderId}</dd>
            </dl>
            <p className="text-caption text-text-muted">
              화면을 닫아도 괜찮아요. 잠시 뒤 티켓 조회에서 주문번호와 이메일로 확인해 주세요.
            </p>
          </div>
        )}

        {/* 확인 실패 안내 */}
        {!isConfirming && errorMessage && !orderDetail && (
          <div className="flex flex-col gap-3 py-6">
            <p className="text-body text-text">{errorMessage}</p>
            <Link
              href="/orders/lookup"
              className="text-body text-text underline underline-offset-4"
            >
              티켓 조회 바로가기
            </Link>
            <p className="text-caption text-text-muted">
              이 화면을 닫아도 주문번호와 이메일로 티켓을 다시 볼 수 있어요.
            </p>
          </div>
        )}

        {/* 승인 완료 상태 (S03-T1) */}
        {!isConfirming && (orderDetail || orderId) && !errorMessage && (
          <div className="flex flex-col gap-4">
            <h1 className="text-display font-bold leading-tight">결제 완료</h1>

            {/* QR 티켓 영역 */}
            <div className="p-4 bg-surface rounded-lg flex flex-col gap-3 items-center border border-border">
              {orderDetail?.qr_code ? (
                <>
                  <div className="p-3 bg-white rounded-md flex items-center justify-center">
                    <QRCodeSVG
                      value={orderDetail.qr_code}
                      size={160}
                      level="M"
                    />
                  </div>
                  <p className="text-title font-bold num tracking-normal">
                    {orderDetail.qr_code}
                  </p>
                  <p className="text-caption text-text-muted">
                    공연장 입구에서 이 QR을 보여 주세요.
                  </p>
                  {(orderDetail?.quantity || parseInt(qty, 10)) >= 2 && (
                    <p className="text-caption text-text">
                      이 QR 하나로 함께 온 인원이 입장해요.
                    </p>
                  )}
                </>
              ) : (
                <div className="py-6 flex flex-col items-center gap-2">
                  <p className="text-body text-text font-medium">결제를 확인하고 있어요.</p>
                  <p className="text-caption text-text-muted">승인이 완료되면 QR 코드가 표시됩니다.</p>
                </div>
              )}
            </div>

            {/* 주문 정보 상세 */}
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 text-body">
              <dt className="text-caption text-text-muted pt-0.5">주문번호</dt>
              <dd className="font-bold num">{orderDetail?.order_id || orderId}</dd>

              <dt className="text-caption text-text-muted pt-0.5">공연</dt>
              <dd className="text-text break-keep">
                {orderDetail?.event_title || eventDetail?.title || "온티켓 공연"}
              </dd>

              <dt className="text-caption text-text-muted pt-0.5">일시</dt>
              <dd className="num text-text">
                {formatDate(orderDetail?.start_at || eventDetail?.start_at)}
              </dd>

              <dt className="text-caption text-text-muted pt-0.5">장소</dt>
              <dd className="text-text">
                {orderDetail?.venue || eventDetail?.venue || "공연장"}
              </dd>

              <dt className="text-caption text-text-muted pt-0.5">등급</dt>
              <dd className="text-text">{orderDetail?.grade || "지정석"}</dd>

              <dt className="text-caption text-text-muted pt-0.5">수량</dt>
              <dd className="num text-text">
                {orderDetail?.quantity || qty}장
              </dd>

              <dt className="text-caption text-text-muted pt-0.5">결제금액</dt>
              <dd className="price font-bold num text-accent">
                {formatPrice(orderDetail?.total_amount || amount)}
              </dd>

              <dt className="text-caption text-text-muted pt-0.5">이메일</dt>
              <dd className="text-text">{email}</dd>
            </dl>

            <p className="text-caption text-text-muted mt-2">
              이 화면을 닫아도 주문번호와 이메일로 티켓을 다시 볼 수 있어요.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}

export default function OrderCompletePage() {
  return (
    <Suspense
      fallback={
        <main className="w-full max-w-[var(--layout-content-max)] mx-auto min-h-screen bg-bg border-x border-border flex flex-col p-4">
          <CustomerHeader />
          <div className="flex flex-col gap-4 py-8">
            <span className="spinner" aria-label="기다리는 중" />
            <h1 className="text-title font-bold">결제를 확인하고 있어요</h1>
          </div>
        </main>
      }
    >
      <OrderCompleteContent />
    </Suspense>
  );
}
