"use client";

import React, { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CustomerHeader } from "@/components/ui/CustomerHeader";
import { AlertIcon } from "@/components/ui/Icons";

function OrderFailContent() {
  const searchParams = useSearchParams();

  const reason = searchParams.get("reason") || "";
  const code = searchParams.get("code") || "";
  const message = searchParams.get("message") || "";
  const orderId =
    searchParams.get("order_id") || searchParams.get("orderId") || "";
  const eventId = searchParams.get("eid") || "";
  const tt = searchParams.get("tt") || "";
  const qty = searchParams.get("qty") || "";
  const email = searchParams.get("email") || "";

  // D8: 다시 시도하면 골랐던 등급·수량·이메일을 채운 S02로 이동
  const retryParams = new URLSearchParams();
  if (tt) retryParams.set("tt", tt);
  if (qty) retryParams.set("qty", qty);
  if (email) retryParams.set("email", email);

  const retryUrl = eventId
    ? `/events/${encodeURIComponent(eventId)}${
        retryParams.toString() ? `?${retryParams.toString()}` : ""
      }`
    : "/";

  // 브랜드가이드라인 5절: "무엇이 안 됐는지 + 다음에 할 일" 2조각 친절한 한국어 안내
  let titleMessage =
    "결제가 완료되지 않았어요. 결제 정보를 확인하고 다시 시도해 주세요.";

  if (
    reason === "cancel" ||
    code === "USER_CANCEL" ||
    code === "PAY_PROCESS_CANCELED" ||
    message.includes("취소")
  ) {
    titleMessage = "결제를 취소했어요. 예매하려면 다시 시도해 주세요.";
  } else if (
    reason === "reject" ||
    code === "SOLD_OUT" ||
    code === "INSUFFICIENT_STOCK" ||
    message.includes("수량") ||
    message.includes("매진")
  ) {
    titleMessage =
      "남은 수량이 부족해 결제가 완료되지 않았어요. 다른 등급이나 수량으로 다시 시도해 주세요.";
  } else if (
    code === "REJECT_CARD_COMPANY" ||
    code === "EXCEED_MAX_AMOUNT" ||
    code === "INVALID_CARD_NUMBER" ||
    code === "NOT_SUPPORTED_CARD"
  ) {
    titleMessage =
      "카드사에서 결제가 승인되지 않았어요. 카드 정보를 확인하거나 다른 카드로 다시 시도해 주세요.";
  } else if (code === "AMOUNT_MISMATCH") {
    titleMessage =
      "결제 금액이 일치하지 않아 결제가 완료되지 않았어요. 다시 예매를 시도해 주세요.";
  }

  return (
    <main
      className="w-full max-w-[var(--layout-content-max)] mx-auto min-h-screen bg-bg border-x border-border flex flex-col"
      aria-label="S04 결제 실패"
    >
      <CustomerHeader />

      <div className="p-4 flex flex-col gap-6 flex-1 justify-center py-12">
        <p
          className="flex gap-2 items-start text-error text-title font-bold leading-tight"
          role="alert"
        >
          <AlertIcon className="w-6 h-6 flex-none mt-0.5" />
          <span>{titleMessage}</span>
        </p>

        <div className="flex flex-col gap-3 items-start">
          <Link
            href={retryUrl}
            className="inline-flex items-center justify-center min-h-[var(--tap-target)] px-4 bg-surface-2 text-text border border-border-strong rounded-md text-body font-medium transition-colors hover:bg-surface-3"
          >
            다시 시도
          </Link>
          <Link
            href="/"
            className="text-body text-text underline underline-offset-4"
          >
            공연 목록 보기
          </Link>
        </div>
      </div>
    </main>
  );
}

export default function OrderFailPage() {
  return (
    <Suspense
      fallback={
        <main className="w-full max-w-[var(--layout-content-max)] mx-auto min-h-screen bg-bg border-x border-border flex flex-col p-4">
          <CustomerHeader />
        </main>
      }
    >
      <OrderFailContent />
    </Suspense>
  );
}
