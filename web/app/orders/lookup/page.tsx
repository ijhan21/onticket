"use client";

import React, { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { CustomerHeader } from "@/components/ui/CustomerHeader";
import { AlertIcon, CheckIcon } from "@/components/ui/Icons";
import { lookupOrder } from "@/lib/api-client/orders";
import { OrderLookupResponse } from "@/types/order";
import { formatDate, formatPrice } from "@/lib/utils/format";
import { ApiClientError } from "@/types/api";

export default function TicketLookupPage() {
  const [orderIdInput, setOrderIdInput] = useState<string>("");
  const [emailInput, setEmailInput] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [result, setResult] = useState<OrderLookupResponse | null>(null);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);

  const canSubmit = orderIdInput.trim() !== "" && emailInput.trim() !== "";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || isLoading) return;

    // D13: 앞뒤 빈칸을 지우고 영문 소문자는 대문자로 변환
    const cleanOrderId = orderIdInput.trim().toUpperCase();
    setOrderIdInput(cleanOrderId);
    const cleanEmail = emailInput.trim();

    setIsLoading(true);
    setResult(null);
    setErrorNotice(null);

    try {
      const order = await lookupOrder(cleanOrderId, cleanEmail);
      setResult(order);
    } catch (err: unknown) {
      if (err instanceof ApiClientError && err.status === 404) {
        // D12: 어느 값이 틀렸는지 말하지 않는다
        setErrorNotice(
          "주문번호와 이메일이 맞는 주문이 없어요. 두 값을 다시 확인해 주세요."
        );
      } else {
        setErrorNotice(
          "주문번호와 이메일이 맞는 주문이 없어요. 두 값을 다시 확인해 주세요."
        );
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main
      className="w-full max-w-[var(--layout-content-max)] mx-auto min-h-screen bg-bg border-x border-border flex flex-col"
      aria-label="S05 티켓 조회"
    >
      <CustomerHeader />

      <div className="p-4 flex flex-col gap-6 flex-1">
        {/* 조회 폼 */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
          <div className="flex flex-col gap-1">
            <label
              htmlFor="order-id"
              className="text-caption text-text-muted font-medium"
            >
              주문번호
            </label>
            <input
              id="order-id"
              type="text"
              autoComplete="off"
              autoCapitalize="characters"
              placeholder="ORD-20261106-0001"
              value={orderIdInput}
              onChange={(e) => {
                setOrderIdInput(e.target.value);
                setErrorNotice(null);
              }}
              className="w-full min-h-[var(--tap-target)] px-3 bg-surface text-text border border-border-strong rounded-md font-body text-body num outline-none focus:outline focus:outline-[var(--focus-width)] focus:outline-focus"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label
              htmlFor="email"
              className="text-caption text-text-muted font-medium"
            >
              예매할 때 입력한 이메일
            </label>
            <input
              id="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="example@example.com"
              value={emailInput}
              onChange={(e) => {
                setEmailInput(e.target.value);
                setErrorNotice(null);
              }}
              className="w-full min-h-[var(--tap-target)] px-3 bg-surface text-text border border-border-strong rounded-md font-body text-body outline-none focus:outline focus:outline-[var(--focus-width)] focus:outline-focus"
            />
          </div>

          <button
            type="submit"
            disabled={!canSubmit || isLoading}
            className="inline-flex items-center justify-center min-h-[var(--tap-target)] px-4 bg-surface-2 text-text border border-border-strong rounded-md text-body font-medium transition-colors hover:bg-surface-3 disabled:bg-surface disabled:border-border disabled:text-text-muted disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <span className="spinner" aria-label="기다리는 중" />
            ) : (
              "티켓 보기"
            )}
          </button>
        </form>

        {/* 오류 안내 (S05-T5) */}
        {errorNotice && (
          <p className="flex gap-2 items-start text-error text-body" role="alert">
            <AlertIcon className="w-5 h-5 flex-none mt-0.5" />
            <span>{errorNotice}</span>
          </p>
        )}

        {/* 조회 결과 영역 */}
        {result && (
          <div className="flex flex-col gap-4 pt-2" aria-live="polite">
            {/* 승인 대기 주문 (S05-T6) */}
            {result.status === "결제대기" ? (
              <p className="flex gap-2 items-start text-body text-text" role="alert">
                <AlertIcon className="w-5 h-5 flex-none mt-0.5 text-warning" />
                <span>결제를 확인하고 있어요. 잠시 뒤 다시 조회해 주세요.</span>
              </p>
            ) : result.status === "취소" ||
              result.status === "환불" ||
              result.status === "실패" ? (
              /* 결제 안 된 주문 (S05-T8) */
              <p className="flex gap-2 items-start text-body text-text" role="alert">
                <AlertIcon className="w-5 h-5 flex-none mt-0.5 text-error" />
                <span>
                  결제가 완료되지 않은 주문이에요. 공연 목록에서 다시 예매해 주세요.
                </span>
              </p>
            ) : (
              /* 결제완료 및 입장완료 정상 주문 */
              <div className="flex flex-col gap-4">
                {/* QR 티켓 */}
                <div className="p-4 bg-surface rounded-lg flex flex-col gap-3 items-center">
                  <div className="p-3 bg-white rounded-md flex items-center justify-center">
                    <QRCodeSVG value={result.qr_code} size={160} level="M" />
                  </div>
                  <p className="text-title font-bold num tracking-normal">
                    {result.qr_code}
                  </p>
                  <p className="text-caption text-text-muted">
                    공연장 입구에서 이 QR을 보여 주세요.
                  </p>
                  {result.quantity >= 2 && (
                    <p className="text-caption text-text">
                      이 QR 하나로 함께 온 인원이 입장해요.
                    </p>
                  )}

                  {/* 입장 완료 상태 표시 (S05-T7) */}
                  {result.status === "입장완료" && (
                    <p className="flex gap-1.5 items-center text-success text-body font-medium mt-1">
                      <CheckIcon className="w-5 h-5" />
                      <span>
                        입장 확인됨{" "}
                        {result.checked_in_at && (
                          <span className="num text-caption">
                            {formatDate(result.checked_in_at)}
                          </span>
                        )}
                      </span>
                    </p>
                  )}
                </div>

                {/* 주문 정보 */}
                <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 text-body">
                  <dt className="text-caption text-text-muted pt-0.5">주문번호</dt>
                  <dd className="font-bold num">{result.order_id}</dd>

                  <dt className="text-caption text-text-muted pt-0.5">공연</dt>
                  <dd className="text-text break-keep">{result.event_title}</dd>

                  <dt className="text-caption text-text-muted pt-0.5">일시</dt>
                  <dd className="num text-text">{formatDate(result.start_at)}</dd>

                  <dt className="text-caption text-text-muted pt-0.5">장소</dt>
                  <dd className="text-text">{result.venue}</dd>

                  <dt className="text-caption text-text-muted pt-0.5">등급</dt>
                  <dd className="text-text">{result.grade}</dd>

                  <dt className="text-caption text-text-muted pt-0.5">수량</dt>
                  <dd className="num text-text">{result.quantity}장</dd>

                  <dt className="text-caption text-text-muted pt-0.5">결제금액</dt>
                  <dd className="price font-bold num text-accent">
                    {formatPrice(result.total_amount)}
                  </dd>

                  <dt className="text-caption text-text-muted pt-0.5">이메일</dt>
                  <dd className="text-text">{emailInput.trim()}</dd>
                </dl>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
