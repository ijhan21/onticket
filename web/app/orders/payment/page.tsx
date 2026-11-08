"use client";

import React, { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { loadTossPayments, ANONYMOUS } from "@tosspayments/tosspayments-sdk";
import { CustomerHeader } from "@/components/ui/CustomerHeader";
import { AlertIcon } from "@/components/ui/Icons";
import { fetchEventById } from "@/lib/api-client/events";
import { EventDetail } from "@/types/event";
import { formatDate, formatPrice } from "@/lib/utils/format";

interface OrderPaymentContentProps {
  propSearchParams?: { [key: string]: string | string[] | undefined };
}

function OrderPaymentContent({ propSearchParams }: OrderPaymentContentProps) {
  const router = useRouter();
  const hookSearchParams = useSearchParams();

  const getParam = (key: string) => {
    if (propSearchParams && typeof propSearchParams[key] === "string") {
      return propSearchParams[key] as string;
    }
    return hookSearchParams.get(key) || "";
  };

  const orderId = getParam("order_id");
  const eventId = getParam("eid");
  const ticketTypeId = getParam("tt");
  const qtyStr = getParam("qty") || "1";
  const quantity = parseInt(qtyStr, 10);
  const email = getParam("email");
  const amountStr = getParam("amount") || "0";
  const totalAmount = parseInt(amountStr, 10);

  const [event, setEvent] = useState<EventDetail | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (eventId) {
      fetchEventById(eventId)
        .then((ev) => setEvent(ev))
        .catch(() => {});
    }
  }, [eventId]);

  const selectedTicket = event?.ticket_types.find(
    (t) => t.ticket_type_id === ticketTypeId
  );

  const handlePaymentError = (err: unknown) => {
    const errorObj = err as { code?: string; message?: string };
    const errorCode = errorObj?.code || "";
    const errorMsg = errorObj?.message || "";

    // 사용자가 결제창을 닫거나 취소한 경우
    if (
      errorCode === "USER_CANCEL" ||
      errorCode === "PAY_PROCESS_CANCELED" ||
      errorMsg.includes("취소")
    ) {
      const failQuery = new URLSearchParams({
        reason: "cancel",
        order_id: orderId,
        eid: eventId,
        tt: ticketTypeId,
        qty: String(quantity),
        email: email,
        ...(errorCode ? { code: errorCode } : {}),
        ...(errorMsg ? { message: errorMsg } : {}),
      });
      router.push(`/orders/fail?${failQuery.toString()}`);
      return;
    }

    // 초기화/인증 에러 등 결제창 호출 실패 시 화면에 안내 메시지 표시
    setErrorMessage(
      errorMsg || "결제창을 불러오는 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요."
    );
  };

  const handleConfirm = async () => {
    if (!orderId || isProcessing) return;

    setIsProcessing(true);
    setErrorMessage(null);

    const clientKey = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY || "";
    if (!clientKey) {
      setIsProcessing(false);
      setErrorMessage("결제 클라이언트 키 환경변수가 설정되지 않았습니다.");
      return;
    }

    const eventTitle = event?.title || "온티켓 공연";
    const successUrl = `${window.location.origin}/orders/complete?order_id=${encodeURIComponent(
      orderId
    )}&email=${encodeURIComponent(email)}&eid=${encodeURIComponent(
      eventId
    )}&amount=${totalAmount}&tt=${encodeURIComponent(
      ticketTypeId
    )}&qty=${quantity}`;
    const failUrl = `${window.location.origin}/orders/fail?order_id=${encodeURIComponent(
      orderId
    )}&eid=${encodeURIComponent(eventId)}&tt=${encodeURIComponent(
      ticketTypeId
    )}&qty=${quantity}&email=${encodeURIComponent(email)}`;

    try {
      const tossPayments = await loadTossPayments(clientKey);

      // v2 주문서형·결제창형 키 (test_gck_* / live_gck_*)
      if (clientKey.startsWith("test_gck") || clientKey.startsWith("live_gck")) {
        const widgets = tossPayments.widgets({ customerKey: ANONYMOUS });
        await widgets.setAmount({
          value: totalAmount,
          currency: "KRW",
        });

        const paymentWindow = await widgets.renderPaymentWindow({
          orderName: eventTitle,
          variantKey: {
            paymentMethod: "DEFAULT",
            agreement: "AGREEMENT",
          },
        });

        paymentWindow.on("paymentRequest", async () => {
          try {
            await widgets.requestPayment({
              orderId,
              orderName: eventTitle,
              successUrl,
              failUrl,
              customerEmail: email,
            });
          } catch (requestErr: unknown) {
            setIsProcessing(false);
            handlePaymentError(requestErr);
          }
        });
      } else {
        // 레거시 API 개별 연동 키 (test_ck_* / live_ck_*)
        const payment = tossPayments.payment({ customerKey: ANONYMOUS });
        await payment.requestPayment({
          method: "CARD",
          amount: { currency: "KRW", value: totalAmount },
          orderId,
          orderName: eventTitle,
          successUrl,
          failUrl,
          customerEmail: email,
        });
      }
    } catch (err: unknown) {
      setIsProcessing(false);
      handlePaymentError(err);
    }
  };

  const handleCancel = () => {
    const backQuery = new URLSearchParams({
      reason: "cancel",
      order_id: orderId,
      eid: eventId,
      tt: ticketTypeId,
      qty: String(quantity),
      email: email,
    });
    router.push(`/orders/fail?${backQuery.toString()}`);
  };

  if (!orderId) {
    return (
      <main className="w-full max-w-[var(--layout-content-max)] mx-auto min-h-screen bg-bg border-x border-border flex flex-col">
        <CustomerHeader />
        <div className="p-4 flex flex-col gap-4 py-8">
          <p className="text-body text-text">
            주문 정보가 없습니다. 공연 목록에서 다시 예매해 주세요.
          </p>
          <Link href="/" className="text-body text-text underline underline-offset-4">
            공연 목록 보기
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main
      className="w-full max-w-[var(--layout-content-max)] mx-auto min-h-screen bg-bg border-x border-border flex flex-col"
      aria-label="결제 화면"
    >
      <CustomerHeader />

      <div className="p-4 flex flex-col gap-5 flex-1">
        <h1 className="text-display font-bold leading-tight">결제</h1>

        {errorMessage && (
          <p className="flex gap-2 items-start text-error text-body" role="alert">
            <AlertIcon className="w-5 h-5 flex-none mt-0.5" />
            <span>{errorMessage}</span>
          </p>
        )}

        {/* 주문 내역 확인 카드 */}
        <div className="p-4 bg-surface rounded-lg flex flex-col gap-3 border border-border">
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 text-body">
            <dt className="text-caption text-text-muted pt-0.5">주문번호</dt>
            <dd className="font-bold num">{orderId}</dd>

            <dt className="text-caption text-text-muted pt-0.5">공연</dt>
            <dd className="text-text break-keep">
              {event?.title || "온티켓 공연"}
            </dd>

            {event && (
              <>
                <dt className="text-caption text-text-muted pt-0.5">일시</dt>
                <dd className="num text-text">{formatDate(event.start_at)}</dd>

                <dt className="text-caption text-text-muted pt-0.5">장소</dt>
                <dd className="text-text">
                  {event.venue} · {event.city}
                </dd>
              </>
            )}

            <dt className="text-caption text-text-muted pt-0.5">등급</dt>
            <dd className="text-text">{selectedTicket?.grade || "지정석"}</dd>

            <dt className="text-caption text-text-muted pt-0.5">수량</dt>
            <dd className="num text-text">{quantity}장</dd>

            <dt className="text-caption text-text-muted pt-0.5">결제금액</dt>
            <dd className="price font-bold num text-accent">
              {formatPrice(totalAmount)}
            </dd>

            <dt className="text-caption text-text-muted pt-0.5">이메일</dt>
            <dd className="text-text">{email}</dd>
          </dl>
        </div>

        <p className="text-caption text-text-muted">
          주문이 정상 접수되었습니다. 결제를 진행하면 예매가 확정되고 QR 티켓이 발급됩니다.
        </p>

        {/* 결제 버튼 및 취소 링크 */}
        <div className="flex flex-col gap-3 pt-2">
          <button
            type="button"
            disabled={isProcessing}
            onClick={handleConfirm}
            className="w-full min-h-[var(--tap-target)] px-4 bg-accent text-on-accent border border-accent rounded-md font-bold text-body hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center transition-colors duration-[120ms]"
          >
            {isProcessing ? (
              <span className="spinner" aria-label="결제 진행 중" />
            ) : (
              "결제하기"
            )}
          </button>

          <button
            type="button"
            onClick={handleCancel}
            disabled={isProcessing}
            className="inline-flex items-center justify-center min-h-[var(--tap-target)] px-4 bg-surface-2 text-text border border-border-strong rounded-md text-body font-medium transition-colors hover:bg-surface-3 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            결제 취소
          </button>
        </div>
      </div>
    </main>
  );
}

interface OrderPaymentPageProps {
  searchParams?: { [key: string]: string | string[] | undefined };
}

export default function OrderPaymentPage({ searchParams }: OrderPaymentPageProps) {
  const orderId =
    typeof searchParams?.order_id === "string" ? searchParams.order_id : "";

  return (
    <Suspense
      key={orderId}
      fallback={
        <main className="w-full max-w-[var(--layout-content-max)] mx-auto min-h-screen bg-bg border-x border-border flex flex-col p-4">
          <CustomerHeader />
        </main>
      }
    >
      <OrderPaymentContent propSearchParams={searchParams} />
    </Suspense>
  );
}
