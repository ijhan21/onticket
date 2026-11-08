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

interface OrderCompleteContentProps {
  propSearchParams?: { [key: string]: string | string[] | undefined };
}

function OrderCompleteContent({ propSearchParams }: OrderCompleteContentProps) {
  const searchParams = useSearchParams();
  const router = useRouter();

  const getParam = (key: string): string => {
    const val = searchParams.get(key);
    if (val) return val;
    const propVal = propSearchParams?.[key];
    if (typeof propVal === "string") return propVal;
    if (Array.isArray(propVal) && propVal.length > 0) return propVal[0];
    return "";
  };

  const orderId = getParam("order_id") || getParam("orderId");
  const paymentKey = getParam("paymentKey") || getParam("payment_key");
  const eventId = getParam("eid");
  const email = getParam("email");
  const rawAmount = getParam("amount");
  const amountStr = rawAmount.split(",")[0].trim() || "0";
  const amount = parseInt(amountStr, 10);
  const tt = getParam("tt");
  const qty = getParam("qty") || "1";

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

    let pollingTimer: NodeJS.Timeout | null = null;

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

        // 공연 정보 사전 조회 (UI용)
        if (eventId) {
          fetchEventById(eventId)
            .then((ev) => setEventDetail(ev))
            .catch(() => null);
        }

        // 2. 서버 결제 승인 요청 (POST /orders/:order_id/payment)
        try {
          const confirmRes = await confirmPayment(orderId, {
            payment_key: paymentKey || `toss_pay_${Date.now()}`,
            payment_method: "카드",
            total_amount: isNaN(amount) || amount <= 0 ? 10000 : amount,
          });

          // 승인 응답의 qr_code로 즉시 상태 세팅하여 무한 대기 방지
          if (confirmRes && confirmRes.qr_code) {
            setOrderDetail({
              order_id: confirmRes.order_id,
              event_title: eventDetail?.title || "온티켓 공연",
              venue: eventDetail?.venue ? `${eventDetail.venue} · ${eventDetail.city}` : "공연장",
              start_at: eventDetail?.start_at || new Date().toISOString(),
              grade: "지정석",
              quantity: parseInt(qty, 10) || 1,
              total_amount: confirmRes.total_amount || amount,
              status: confirmRes.status || "결제완료",
              qr_code: confirmRes.qr_code,
            });
          }
        } catch (confirmErr: unknown) {
          if (confirmErr instanceof ApiClientError) {
            // 이미 결제 완료된 건은 정상으로 처리 (AC14, AC27)
            if (
              confirmErr.code === "ALREADY_PAID" ||
              confirmErr.code === "ALREADY_PROCESSED"
            ) {
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

        // 3. 승인 완료 후 티켓 상세 정보 조회 및 업데이트
        if (email) {
          try {
            const detail = await lookupOrder(orderId, email);
            setOrderDetail(detail);
          } catch {
            // lookup 조회 지연 시 아래 폴링에서 보완
          }
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

      // 4. 만약 qr_code가 아직 없으면 폴링으로 자동 보완 (최대 5회)
      if (email) {
        let attempts = 0;
        pollingTimer = setInterval(async () => {
          attempts++;
          try {
            const detail = await lookupOrder(orderId, email);
            if (detail.qr_code) {
              setOrderDetail(detail);
              if (pollingTimer) clearInterval(pollingTimer);
            }
          } catch {
            // 폴링 계속
          }
          if (attempts >= 5 && pollingTimer) {
            clearInterval(pollingTimer);
          }
        }, 1500);
      }
    }

    processOrder();

    return () => {
      if (pollingTimer) clearInterval(pollingTimer);
    };
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
                  <span className="spinner" aria-hidden="true" />
                  <p className="text-body text-text font-medium">티켓 발급을 마무리하고 있어요.</p>
                  <p className="text-caption text-text-muted">잠시만 기다려 주시면 QR 코드가 표시됩니다.</p>
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

interface OrderCompletePageProps {
  searchParams?: { [key: string]: string | string[] | undefined };
}

export default function OrderCompletePage({ searchParams }: OrderCompletePageProps) {
  const orderId =
    typeof searchParams?.order_id === "string"
      ? searchParams.order_id
      : typeof searchParams?.orderId === "string"
      ? searchParams.orderId
      : "";
  const paymentKey =
    typeof searchParams?.paymentKey === "string"
      ? searchParams.paymentKey
      : "";

  return (
    <Suspense
      key={`${orderId}-${paymentKey}`}
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
      <OrderCompleteContent propSearchParams={searchParams} />
    </Suspense>
  );
}
