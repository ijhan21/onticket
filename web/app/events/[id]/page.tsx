"use client";

import React, { useEffect, useState, useMemo, Suspense } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { CustomerHeader } from "@/components/ui/CustomerHeader";
import { Skeleton } from "@/components/ui/Skeleton";
import { AlertIcon, MinusIcon, PlusIcon } from "@/components/ui/Icons";
import { Badge } from "@/components/ui/Badge";
import { fetchEventById } from "@/lib/api-client/events";
import { createOrder } from "@/lib/api-client/orders";
import { EventDetail, TicketType } from "@/types/event";
import { formatDate, formatPrice } from "@/lib/utils/format";
import { ApiClientError } from "@/types/api";

interface EventDetailContentProps {
  propEventId?: string;
  propInitialTt?: string;
  propInitialQty?: number;
  propInitialEmail?: string;
}

function EventDetailContent({
  propEventId,
  propInitialTt,
  propInitialQty,
  propInitialEmail,
}: EventDetailContentProps) {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();

  const eventId = propEventId || String(params?.id || "");

  // 재시도 시 URL 쿼리로 넘겨받은 기본값 (D8)
  const initialTicketTypeId =
    propInitialTt !== undefined
      ? propInitialTt
      : searchParams.get("tt") || "";
  const initialQty =
    propInitialQty !== undefined
      ? propInitialQty
      : parseInt(searchParams.get("qty") || "1", 10);
  const initialEmail =
    propInitialEmail !== undefined
      ? propInitialEmail
      : searchParams.get("email") || "";

  const [event, setEvent] = useState<EventDetail | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // 폼 입력 상태
  const [selectedTicketTypeId, setSelectedTicketTypeId] = useState<string>(
    initialTicketTypeId
  );
  const [quantity, setQuantity] = useState<number>(
    isNaN(initialQty) || initialQty < 1 ? 1 : Math.min(4, initialQty)
  );
  const [email, setEmail] = useState<string>(initialEmail);
  const [emailTouched, setEmailTouched] = useState<boolean>(!!initialEmail);
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // 공연 데이터 불러오기
  const loadEvent = async () => {
    if (!eventId) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const data = await fetchEventById(eventId);
      setEvent(data);

      // 등급이 1개뿐이고 잔여석이 남아있으면 기본 선택 (D4)
      if (data.ticket_types && data.ticket_types.length === 1) {
        if (data.ticket_types[0].remaining_quantity > 0) {
          setSelectedTicketTypeId(data.ticket_types[0].ticket_type_id);
        }
      }
    } catch (err: unknown) {
      if (err instanceof ApiClientError && err.status === 404) {
        setErrorMsg("공연을 찾을 수 없어요. 공연 목록에서 다시 골라 주세요.");
      } else {
        setErrorMsg("공연 정보를 불러오지 못했어요. 잠시 뒤 다시 시도해 주세요.");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    if (!eventId) return;

    setLoading(true);
    setErrorMsg(null);

    fetchEventById(eventId)
      .then((data) => {
        if (!isMounted) return;
        setEvent(data);
        if (data.ticket_types && data.ticket_types.length === 1) {
          if (data.ticket_types[0].remaining_quantity > 0) {
            setSelectedTicketTypeId(data.ticket_types[0].ticket_type_id);
          }
        }
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (!isMounted) return;
        if (err instanceof ApiClientError && err.status === 404) {
          setErrorMsg("공연을 찾을 수 없어요. 공연 목록에서 다시 골라 주세요.");
        } else {
          setErrorMsg("공연 정보를 불러오지 못했어요. 잠시 뒤 다시 시도해 주세요.");
        }
        setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [eventId]);

  const selectedTicket = useMemo<TicketType | undefined>(() => {
    if (!event || !selectedTicketTypeId) return undefined;
    return event.ticket_types.find(
      (t) => t.ticket_type_id === selectedTicketTypeId
    );
  }, [event, selectedTicketTypeId]);

  // 수량 한계치: 서버가 준 잔여수량과 4 중 작은 값 (D2)
  const maxAvailableQty = useMemo(() => {
    if (!selectedTicket) return 4;
    return Math.min(4, selectedTicket.remaining_quantity);
  }, [selectedTicket]);

  // 이메일 유효성 검사 (D3: @ 하나, 앞뒤 글자, @ 뒤 점)
  const emailError = useMemo(() => {
    if (!email.trim()) {
      return "이메일을 입력해 주세요.";
    }
    const emailRegex = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
    if (!emailRegex.test(email.trim())) {
      return "이메일 형식이 맞지 않아요. 다시 확인해 주세요.";
    }
    return null;
  }, [email]);

  const canPay =
    !!selectedTicket &&
    selectedTicket.remaining_quantity > 0 &&
    !emailError &&
    !isSubmitting;

  const handleSelectTicket = (ticket: TicketType) => {
    if (ticket.remaining_quantity <= 0) return;
    setSelectedTicketTypeId(ticket.ticket_type_id);
    setServerError(null);

    // 수량이 새로운 등급의 잔여수량보다 크면 자동 보정
    const maxQty = Math.min(4, ticket.remaining_quantity);
    if (quantity > maxQty) {
      setQuantity(maxQty);
    }
  };

  const handleMinus = () => {
    if (quantity > 1) {
      setQuantity((prev) => prev - 1);
    }
  };

  const handlePlus = () => {
    if (quantity < maxAvailableQty) {
      setQuantity((prev) => prev + 1);
    }
  };

  // 예매하기 클릭 처리: 브라우저에서 직접 api로 주문 생성 후 결제 화면으로 이동
  const handlePay = async () => {
    if (!canPay || !selectedTicket) return;

    setIsSubmitting(true);
    setServerError(null);

    try {
      const order = await createOrder({
        event_id: eventId,
        ticket_type_id: selectedTicket.ticket_type_id,
        purchaser_email: email.trim(),
        quantity,
      });

      // 결제 화면으로 이동
      router.push(
        `/orders/payment?order_id=${encodeURIComponent(
          order.order_id
        )}&eid=${encodeURIComponent(eventId)}&tt=${encodeURIComponent(
          selectedTicket.ticket_type_id
        )}&qty=${quantity}&email=${encodeURIComponent(
          email.trim()
        )}&amount=${order.total_amount}`
      );
    } catch (err: unknown) {
      setIsSubmitting(false);
      if (err instanceof ApiClientError) {
        if (err.code === "SOLD_OUT" || err.status === 409) {
          setServerError(
            "남은 수량이 부족해 예매하지 못했어요. 수량을 줄이거나 다른 등급을 골라 주세요."
          );
          // 서버 값으로 등급 정보 재동기화
          loadEvent();
        } else if (err.code === "NOT_FOUND" && err.status === 404) {
          setServerError("이 공연의 등급이 아니에요. 등급을 다시 골라 주세요.");
          setSelectedTicketTypeId("");
        } else {
          setServerError(err.message || "주문 처리에 실패했습니다.");
        }
      } else {
        setServerError("주문 요청 중 오류가 발생했습니다. 다시 시도해 주세요.");
      }
    }
  };

  return (
    <main
      className="w-full max-w-[var(--layout-content-max)] mx-auto min-h-screen bg-bg border-x border-border flex flex-col"
      aria-label="S02 공연 상세·예매"
    >
      <CustomerHeader />

      <div className="p-4 flex flex-col gap-4 flex-1">
        {loading && (
          <div className="flex flex-col gap-4" aria-busy="true">
            <Skeleton className="w-[calc(var(--space-7)*2.5)] aspect-[var(--poster-ratio)] rounded-sm border border-border" />
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-14 w-full mt-4" />
            <Skeleton className="h-14 w-full" />
          </div>
        )}

        {!loading && errorMsg && (
          <div className="flex flex-col gap-3 items-start py-8">
            <p className="flex gap-2 items-start text-error text-body" role="alert">
              <AlertIcon className="w-5 h-5 flex-none mt-0.5" />
              <span>{errorMsg}</span>
            </p>
            <Link href="/" className="text-body text-text underline underline-offset-4">
              공연 목록 보기
            </Link>
          </div>
        )}

        {!loading && event && (
          <>
            {/* 판매종료 또는 판매상태 매진 공연 안내 (D7, AC5, AC45) */}
            {event.sales_status === "판매종료" || event.sales_status === "매진" ? (
              <div className="flex flex-col gap-4">
                <div className="flex gap-3">
                  <div
                    className="flex-none w-[calc(var(--space-7)*2.5)] aspect-[var(--poster-ratio)] flex items-end p-2 bg-bg rounded-sm border border-border text-caption font-bold leading-tight break-keep"
                    aria-hidden="true"
                  >
                    {event.title}
                  </div>
                  <div className="flex flex-col gap-1 justify-center">
                    <h1 className="text-title font-bold leading-tight break-keep">
                      {event.title}
                    </h1>
                    <p className="text-caption text-text-muted">{event.category}</p>
                    <p className="text-caption text-text-muted num">
                      {formatDate(event.start_at)} ~ {formatDate(event.end_at)}
                    </p>
                    <p className="text-caption text-text-muted">
                      {event.venue} · {event.city}
                    </p>
                  </div>
                </div>

                <div className="flex gap-2 items-start text-text-muted py-6">
                  <AlertIcon className="w-5 h-5 flex-none text-warning mt-0.5" />
                  <span className="text-body">
                    {event.sales_status === "판매종료"
                      ? "판매가 끝난 공연이에요. 다른 공연을 골라 주세요."
                      : "매진된 공연이에요. 다른 공연을 골라 주세요."}
                  </span>
                </div>
              </div>
            ) : (
              // 정상 판매중 공연 예매 폼
              <div className="flex flex-col gap-5">
                {/* 공연 기본 정보 */}
                <div className="flex gap-3">
                  <div
                    className="flex-none w-[calc(var(--space-7)*2.5)] aspect-[var(--poster-ratio)] flex items-end p-2 bg-bg rounded-sm border border-border text-caption font-bold leading-tight break-keep"
                    aria-hidden="true"
                  >
                    {event.title}
                  </div>
                  <div className="flex flex-col gap-1 justify-center">
                    <h1 className="text-title font-bold leading-tight break-keep">
                      {event.title}
                    </h1>
                    <p className="text-caption text-text-muted">{event.category}</p>
                    <p className="text-caption text-text-muted num">
                      {formatDate(event.start_at)} ~ {formatDate(event.end_at)}
                    </p>
                    <p className="text-caption text-text-muted">
                      {event.venue} · {event.city}
                    </p>
                  </div>
                </div>

                {/* 서버 에러 안내 */}
                {serverError && (
                  <p className="flex gap-2 items-start text-error text-body" role="alert">
                    <AlertIcon className="w-5 h-5 flex-none mt-0.5" />
                    <span>{serverError}</span>
                  </p>
                )}

                {/* 등급 목록 */}
                <section className="flex flex-col gap-2" aria-label="등급">
                  <div className="flex flex-col gap-2" role="radiogroup">
                    {event.ticket_types.map((ticket) => {
                      const isSoldOut = ticket.remaining_quantity <= 0;
                      const isSelected = selectedTicketTypeId === ticket.ticket_type_id;

                      return (
                        <button
                          key={ticket.ticket_type_id}
                          type="button"
                          role="radio"
                          aria-checked={isSelected}
                          disabled={isSoldOut}
                          onClick={() => handleSelectTicket(ticket)}
                          className={`flex justify-between items-center gap-3 w-full min-h-[var(--tap-target)] p-3 bg-surface rounded-md border text-left font-body text-body transition-colors duration-[120ms] ${
                            isSelected
                              ? "bg-surface-2 border-focus outline-none"
                              : "border-border hover:bg-surface-2"
                          } ${isSoldOut ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}`}
                        >
                          <span className="flex flex-col gap-1">
                            <span className="font-bold text-text">{ticket.grade}</span>
                            {isSoldOut ? (
                              <Badge>매진</Badge>
                            ) : (
                              <span className="text-caption text-text-muted num">
                                남은 수량 {ticket.remaining_quantity.toLocaleString("ko-KR")}
                              </span>
                            )}
                          </span>
                          <span
                            className={`price font-bold num ${
                              isSoldOut ? "text-text-muted" : "text-accent"
                            }`}
                          >
                            {formatPrice(ticket.price)}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </section>

                {/* 수량 선택기 */}
                <section className="flex flex-col gap-1">
                  <span className="text-caption text-text-muted font-medium">수량</span>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      aria-label="수량 빼기"
                      disabled={quantity <= 1 || !selectedTicket}
                      onClick={handleMinus}
                      className="w-[var(--tap-target)] h-[var(--tap-target)] flex items-center justify-center bg-surface text-text border border-border-strong rounded-md cursor-pointer disabled:text-border-strong disabled:border-border disabled:cursor-not-allowed"
                    >
                      <MinusIcon className="w-5 h-5" />
                    </button>
                    <span
                      className="min-w-[var(--space-6)] text-center text-title font-bold num"
                      aria-live="polite"
                    >
                      {quantity}
                    </span>
                    <button
                      type="button"
                      aria-label="수량 더하기"
                      disabled={quantity >= maxAvailableQty || !selectedTicket}
                      onClick={handlePlus}
                      className="w-[var(--tap-target)] h-[var(--tap-target)] flex items-center justify-center bg-surface text-text border border-border-strong rounded-md cursor-pointer disabled:text-border-strong disabled:border-border disabled:cursor-not-allowed"
                    >
                      <PlusIcon className="w-5 h-5" />
                    </button>
                  </div>
                  {selectedTicket && quantity >= maxAvailableQty && (
                    <p className="text-caption text-text-muted mt-1">
                      한 번에 살 수 있는 만큼 골랐어요.
                    </p>
                  )}
                </section>

                {/* 이메일 입력 칸 */}
                <section className="flex flex-col gap-1">
                  <label className="text-caption text-text-muted font-medium" htmlFor="email">
                    이메일
                  </label>
                  <input
                    id="email"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    placeholder="example@example.com"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setServerError(null);
                    }}
                    onBlur={() => setEmailTouched(true)}
                    className={`w-full min-h-[var(--tap-target)] px-3 bg-surface text-text border ${
                      emailTouched && emailError ? "border-error" : "border-border-strong"
                    } rounded-md font-body text-body outline-none focus:outline focus:outline-[var(--focus-width)] focus:outline-focus`}
                  />
                  {emailTouched && emailError && (
                    <p className="text-caption text-error">{emailError}</p>
                  )}
                  <p className="text-caption text-text-muted">
                    주문번호와 이 이메일로 티켓을 다시 볼 수 있어요.
                  </p>
                </section>
              </div>
            )}
          </>
        )}
      </div>

      {/* 하단 고정 예매 결제 막대 */}
      {!loading && event && event.sales_status === "판매중" && (
        <div className="sticky bottom-0 p-4 bg-bg border-t border-border flex flex-col gap-2">
          {selectedTicket && (
            <div className="flex justify-between items-baseline">
              <span className="text-caption text-text-muted font-medium">결제금액</span>
              <span className="amount text-display font-bold text-accent num">
                {formatPrice(selectedTicket.price * quantity)}
              </span>
            </div>
          )}
          <button
            type="button"
            disabled={!canPay}
            onClick={handlePay}
            className="w-full min-h-[var(--tap-target)] px-4 bg-accent text-on-accent border border-accent rounded-md font-bold text-body hover:bg-accent disabled:bg-surface-2 disabled:border-border disabled:text-text-muted disabled:cursor-not-allowed flex items-center justify-center transition-colors duration-[120ms]"
          >
            {isSubmitting ? (
              <span className="spinner" aria-label="기다리는 중" />
            ) : (
              "결제하기"
            )}
          </button>
        </div>
      )}
    </main>
  );
}

interface EventDetailPageProps {
  params: { id: string };
  searchParams?: { [key: string]: string | string[] | undefined };
}

export default function EventDetailPage({
  params,
  searchParams,
}: EventDetailPageProps) {
  const eventId = params?.id || "";
  const initialTt =
    typeof searchParams?.tt === "string" ? searchParams.tt : "";
  const initialQty =
    typeof searchParams?.qty === "string"
      ? parseInt(searchParams.qty, 10)
      : 1;
  const initialEmail =
    typeof searchParams?.email === "string" ? searchParams.email : "";

  return (
    <Suspense
      key={eventId}
      fallback={
        <main className="w-full max-w-[var(--layout-content-max)] mx-auto min-h-screen bg-bg border-x border-border flex flex-col p-4">
          <CustomerHeader />
          <div className="flex flex-col gap-4 py-8">
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-6 w-3/4" />
          </div>
        </main>
      }
    >
      <EventDetailContent
        key={eventId}
        propEventId={eventId}
        propInitialTt={initialTt}
        propInitialQty={initialQty}
        propInitialEmail={initialEmail}
      />
    </Suspense>
  );
}
