"use client";

import React, { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AdminHeader } from "@/components/ui/AdminHeader";
import { CheckIcon, XIcon, AlertIcon, ScanIcon } from "@/components/ui/Icons";
import { Skeleton } from "@/components/ui/Skeleton";
import { useAdminAuth } from "@/components/admin/AdminAuthContext";
import { fetchEventById } from "@/lib/api-client/events";
import { checkinTicket } from "@/lib/api-client/admin";
import { EventDetail } from "@/types/event";
import { CheckinResponse } from "@/types/admin";
import { formatDate } from "@/lib/utils/format";
import { ApiClientError } from "@/types/api";

type CheckinResultType =
  | { type: "허용"; data: CheckinResponse }
  | { type: "다른공연"; message: string }
  | { type: "이미입장"; message: string; checkedInAt?: string; gate?: string }
  | { type: "불가"; message: string }
  | { type: "판정못받음"; message: string };

function AdminCheckinContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { adminPassword, isAuthenticated, logout } = useAdminAuth();

  const eventId = searchParams.get("id") || "";

  const [event, setEvent] = useState<EventDetail | null>(null);
  const [gate, setGate] = useState<string>("");
  const [isEditingGate, setIsEditingGate] = useState<boolean>(true);
  const [gateInput, setGateInput] = useState<string>("");

  const [ticketCodeInput, setTicketCodeInput] = useState<string>("");
  const [isWaiting, setIsWaiting] = useState<boolean>(false);
  const [result, setResult] = useState<CheckinResultType | null>(null);

  // 인증 검사: 메모리에 비밀번호가 없으면 S06으로 이동 (AC41)
  useEffect(() => {
    if (!isAuthenticated) {
      router.replace("/admin/login");
    }
  }, [isAuthenticated, router]);

  // 공연 정보 로드
  useEffect(() => {
    if (!eventId || !isAuthenticated) return;

    async function loadEvent() {
      try {
        const ev = await fetchEventById(eventId);
        setEvent(ev);
      } catch {
        // 이벤트 정보 없을 때의 fallback
      }
    }

    loadEvent();
  }, [eventId, isAuthenticated]);

  if (!isAuthenticated) return null;

  const handleGateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!gateInput.trim()) return;
    setGate(gateInput.trim());
    setIsEditingGate(false);
  };

  const handleCheckin = async (codeToVerify?: string) => {
    const rawCode = codeToVerify || ticketCodeInput;
    if (!rawCode.trim() || isWaiting || !gate) return;

    const code = rawCode.trim().toUpperCase();
    setTicketCodeInput(code);
    setIsWaiting(true);
    setResult(null);

    try {
      const res = await checkinTicket(adminPassword, {
        qr_code: code,
        gate,
        event_id: eventId || undefined,
      });

      setResult({
        type: "허용",
        data: res,
      });
    } catch (err: unknown) {
      if (err instanceof ApiClientError) {
        if (err.code === "ALREADY_CHECKED_IN") {
          // 이미 입장한 티켓 (AC30, S09-T5)
          setResult({
            type: "이미입장",
            message: "입장 불가. 이미 입장한 티켓이에요.",
          });
        } else if (err.code === "MISMATCH_EVENT") {
          // 다른 공연의 티켓 (AC18, S09-T4)
          setResult({
            type: "불가",
            message: "입장 불가. 다른 공연의 티켓이에요.",
          });
        } else if (err.code === "INVALID_ORDER_STATUS") {
          // 결제 미완료 또는 취소 (AC20, S09-T6)
          setResult({
            type: "불가",
            message: "입장 불가. 결제가 완료된 티켓이 아니에요.",
          });
        } else if (err.status === 404) {
          // 존재하지 않는 티켓
          setResult({
            type: "불가",
            message: "입장 불가. 결제가 완료된 티켓이 아니에요.",
          });
        } else {
          setResult({
            type: "판정못받음",
            message: "판정을 받지 못했어요. 같은 티켓을 다시 확인해 주세요.",
          });
        }
      } else {
        setResult({
          type: "판정못받음",
          message: "판정을 받지 못했어요. 같은 티켓을 다시 확인해 주세요.",
        });
      }
    } finally {
      setIsWaiting(false);
    }
  };

  const handleNext = () => {
    setResult(null);
    setTicketCodeInput("");
  };

  const headerSubTitle = event
    ? `${event.title} · ${formatDate(event.start_at)}`
    : "입장 확인";

  return (
    <main
      className="w-full max-w-[var(--layout-mobile)] mx-auto min-h-screen bg-bg border-x border-border flex flex-col relative"
      aria-label="S09 입장 확인"
    >
      <AdminHeader subTitle={headerSubTitle} onLogout={logout} />

      {/* 게이트 미입력 상태: 게이트 입력 폼 (S09-T1) */}
      {isEditingGate ? (
        <form onSubmit={handleGateSubmit} className="p-4 flex flex-col gap-4 flex-1 justify-center" noValidate>
          <div className="flex flex-col gap-1">
            <label htmlFor="gate" className="text-caption text-text-muted font-medium">
              게이트
            </label>
            <input
              id="gate"
              type="text"
              autoComplete="off"
              placeholder="A게이트"
              value={gateInput}
              onChange={(e) => setGateInput(e.target.value)}
              className="w-full min-h-[var(--tap-target)] px-3 bg-surface text-text border border-border-strong rounded-md font-body text-body outline-none focus:outline focus:outline-[var(--focus-width)] focus:outline-focus"
            />
            <p className="text-caption text-text-muted">
              이 기기가 맡은 게이트 이름을 입력해 주세요.
            </p>
          </div>
          <button
            type="submit"
            disabled={!gateInput.trim()}
            className="inline-flex items-center justify-center min-h-[var(--tap-target)] px-4 bg-surface-2 text-text border border-border-strong rounded-md text-body font-medium transition-colors hover:bg-surface-3 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            확인하기
          </button>
        </form>
      ) : (
        /* 게이트 입력 완료 후: 게이트 띠 및 검표 화면 */
        <div className="flex flex-col flex-1">
          {/* 게이트 띠 (S09-T10) */}
          <div className="flex justify-between items-center px-4 py-2 bg-surface border-b border-border">
            <span className="text-caption text-text">
              게이트 <span className="font-bold">{gate}</span>
            </span>
            <button
              type="button"
              onClick={() => {
                setGateInput(gate);
                setIsEditingGate(true);
                setResult(null);
              }}
              className="inline-flex items-center justify-center min-h-[var(--tap-target)] px-3 bg-surface-2 text-text border border-border-strong rounded-md text-caption font-medium transition-colors hover:bg-surface-3"
            >
              바꾸기
            </button>
          </div>

          <div className="p-4 flex flex-col gap-4 flex-1">
            {/* QR 읽기 카메라 영역 (휴대폰 카메라 대기 화면) */}
            <div
              className="aspect-square bg-surface-2 rounded-lg flex flex-col items-center justify-center text-text-muted p-5 text-center relative"
              aria-label="QR 읽기"
            >
              {isWaiting ? (
                <span className="spinner w-8 h-8" aria-label="판정을 기다리는 중" />
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <ScanIcon className="w-16 h-16 stroke-[1]" />
                  <p className="text-caption text-text-muted">
                    카메라를 쓸 수 없어요. 아래 칸에 티켓 코드를 입력해 주세요.
                  </p>
                </div>
              )}
            </div>

            {/* 코드 직접 입력 칸과 확인하기 버튼 (S09-T2, S09-T11) */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleCheckin();
              }}
              className="flex gap-2 items-end"
              noValidate
            >
              <div className="flex-1 flex flex-col gap-1">
                <label htmlFor="ticket-code" className="text-caption text-text-muted font-medium">
                  티켓 코드
                </label>
                <input
                  id="ticket-code"
                  type="text"
                  placeholder="OT-0001-A1B2"
                  autoComplete="off"
                  autoCapitalize="characters"
                  value={ticketCodeInput}
                  onChange={(e) => setTicketCodeInput(e.target.value)}
                  className="w-full min-h-[var(--tap-target)] px-3 bg-surface text-text border border-border-strong rounded-md font-body text-body num outline-none focus:outline focus:outline-[var(--focus-width)] focus:outline-focus"
                />
              </div>
              <button
                type="submit"
                disabled={isWaiting || !ticketCodeInput.trim()}
                className="inline-flex items-center justify-center min-h-[var(--tap-target)] px-4 bg-surface-2 text-text border border-border-strong rounded-md text-body font-medium transition-colors hover:bg-surface-3 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
              >
                확인하기
              </button>
            </form>
          </div>

          {/* 판정 결과 판: 화면 위 절반을 덮는 결과 판 (D17, S09-T3~T9) */}
          {result && (
            <div
              className={`absolute left-0 right-0 top-0 min-h-[50%] p-5 bg-surface-2 border-b-2 flex flex-col gap-4 shadow-2xl z-20 ${
                result.type === "허용" ? "border-success" : "border-error"
              }`}
              role="alert"
            >
              {result.type === "허용" ? (
                <>
                  <div className="flex items-center gap-3 text-success">
                    <CheckIcon className="w-8 h-8 flex-none" />
                    <p className="text-display font-bold">입장 확인됨</p>
                  </div>
                  {result.data.grade && (
                    <p className="text-title font-bold text-text">
                      {result.data.grade} ·{" "}
                      <span className="num">{result.data.quantity || 1}장</span>
                    </p>
                  )}
                  <p className="text-title font-bold num text-text">
                    {result.data.qr_code}
                  </p>
                  <p className="text-caption text-text-muted num">
                    {result.data.gate} · {formatDate(result.data.checked_in_at)}
                  </p>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-3 text-error">
                    {result.type === "판정못받음" ? (
                      <AlertIcon className="w-8 h-8 flex-none" />
                    ) : (
                      <XIcon className="w-8 h-8 flex-none" />
                    )}
                    <p className="text-title font-bold leading-tight">
                      {result.message}
                    </p>
                  </div>
                  {result.type === "이미입장" && result.gate && (
                    <p className="text-caption text-text-muted num">
                      {result.gate} · {formatDate(result.checkedInAt)}
                    </p>
                  )}
                </>
              )}

              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleNext}
                  className="w-full inline-flex items-center justify-center min-h-[var(--tap-target)] px-4 bg-surface text-text border border-border-strong rounded-md text-body font-medium transition-colors hover:bg-surface-3"
                >
                  다음 티켓 확인
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </main>
  );
}

export default function AdminCheckinPage() {
  return (
    <Suspense
      fallback={
        <main className="w-full max-w-[var(--layout-mobile)] mx-auto min-h-screen bg-bg border-x border-border flex flex-col p-4">
          <Skeleton className="h-10 w-full" />
        </main>
      }
    >
      <AdminCheckinContent />
    </Suspense>
  );
}
