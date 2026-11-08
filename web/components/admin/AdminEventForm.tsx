"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AdminHeader } from "@/components/ui/AdminHeader";
import { AlertIcon } from "@/components/ui/Icons";
import { useAdminAuth } from "@/components/admin/AdminAuthContext";
import { createAdminEvent, updateAdminEvent } from "@/lib/api-client/admin";
import { AdminCreateEventInput, AdminTicketTypeInput, AdminUpdateEventInput } from "@/types/admin";
import { SalesStatus } from "@/types/event";
import { ApiClientError } from "@/types/api";

interface TicketRowState {
  ticket_type_id?: string;
  grade: string;
  price: string;
  total_quantity: string;
  sold_quantity?: number;
  remaining_quantity?: number;
}

interface AdminEventFormProps {
  mode: "new" | "edit";
  eventId?: string;
  initialData?: {
    event_id?: string;
    title: string;
    category: string;
    venue: string;
    city: string;
    start_at: string;
    end_at: string;
    sales_status: SalesStatus;
    ticket_types: TicketRowState[];
  };
}

export function AdminEventForm({ mode, eventId, initialData }: AdminEventFormProps) {
  const router = useRouter();
  const { adminPassword, isAuthenticated, logout } = useAdminAuth();

  const [title, setTitle] = useState(initialData?.title || "");
  const [category, setCategory] = useState(initialData?.category || "");
  const [venue, setVenue] = useState(initialData?.venue || "");
  const [city, setCity] = useState(initialData?.city || "");
  const [startAt, setStartAt] = useState(
    initialData?.start_at ? initialData.start_at.replace(" ", "T").slice(0, 16) : ""
  );
  const [endAt, setEndAt] = useState(
    initialData?.end_at ? initialData.end_at.replace(" ", "T").slice(0, 16) : ""
  );
  const [salesStatus, setSalesStatus] = useState<SalesStatus>(
    initialData?.sales_status || "판매종료" // D18: 새 공연은 판매종료로 골라 둔다
  );

  // 등급 줄 목록 (1~4개)
  const [rows, setRows] = useState<TicketRowState[]>(
    initialData?.ticket_types && initialData.ticket_types.length > 0
      ? initialData.ticket_types
      : [{ grade: "", price: "", total_quantity: "" }]
  );

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const handleAddRow = () => {
    if (rows.length < 4) {
      setRows((prev) => [...prev, { grade: "", price: "", total_quantity: "" }]);
    }
  };

  const handleRemoveRow = (index: number) => {
    setRows((prev) => prev.filter((_, i) => i !== index));
    setFieldErrors({});
  };

  const handleRowChange = (index: number, field: keyof TicketRowState, value: string) => {
    setRows((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
    setFieldErrors((prev) => {
      const next = { ...prev };
      delete next[`${field}-${index}`];
      return next;
    });
  };

  const validate = (): boolean => {
    const errors: Record<string, string> = {};

    if (!title.trim()) errors.title = "이 칸을 입력해 주세요.";
    if (!category.trim()) errors.category = "이 칸을 입력해 주세요.";
    if (!venue.trim()) errors.venue = "이 칸을 입력해 주세요.";
    if (!city.trim()) errors.city = "이 칸을 입력해 주세요.";
    if (!startAt) errors.startAt = "이 칸을 입력해 주세요.";
    if (!endAt) errors.endAt = "이 칸을 입력해 주세요.";

    rows.forEach((r, i) => {
      if (!r.grade.trim()) errors[`grade-${i}`] = "이 칸을 입력해 주세요.";
      if (!r.price.trim() || isNaN(Number(r.price)) || Number(r.price) < 0) {
        errors[`price-${i}`] = "이 칸을 입력해 주세요.";
      }
      if (
        !r.total_quantity.trim() ||
        isNaN(Number(r.total_quantity)) ||
        Number(r.total_quantity) < 0
      ) {
        errors[`total_quantity-${i}`] = "이 칸을 입력해 주세요.";
      } else if (
        r.sold_quantity != null &&
        Number(r.total_quantity) < r.sold_quantity
      ) {
        // AC44: 총수량을 판매수량보다 작게 바꿀 수 없음
        errors[`total_quantity-${i}`] =
          "총수량을 판매수량보다 작게 바꿀 수 없어요. 판매수량 이상으로 입력해 주세요.";
      }
    });

    if (rows.length === 0) {
      errors.rows = "이 칸을 입력해 주세요.";
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate() || isSaving) return;

    setIsSaving(true);
    setGlobalError(null);

    const formattedStartAt = startAt.includes("T") ? startAt.replace("T", " ") : startAt;
    const formattedEndAt = endAt.includes("T") ? endAt.replace("T", " ") : endAt;

    const ticketTypesPayload: AdminTicketTypeInput[] = rows.map((r, i) => {
      return {
        ticket_type_id: r.ticket_type_id || `TT_NEW_${i + 1}`,
        grade: r.grade.trim(),
        price: Number(r.price),
        total_quantity: Number(r.total_quantity),
      };
    });

    try {
      if (mode === "new") {
        // 새 공연 식별자 생성 (EV_...)
        const newEventId = `EV${Date.now().toString().slice(-3)}`;
        const payload: AdminCreateEventInput = {
          event_id: newEventId,
          title: title.trim(),
          category: category.trim(),
          venue: venue.trim(),
          city: city.trim(),
          start_at: formattedStartAt,
          end_at: formattedEndAt,
          sales_status: salesStatus,
          ticket_types: ticketTypesPayload,
        };
        await createAdminEvent(adminPassword, payload);
      } else {
        if (!eventId) throw new Error("공연 ID가 없습니다.");
        const payload: AdminUpdateEventInput = {
          title: title.trim(),
          category: category.trim(),
          venue: venue.trim(),
          city: city.trim(),
          start_at: formattedStartAt,
          end_at: formattedEndAt,
          sales_status: salesStatus,
          ticket_types: ticketTypesPayload,
        };
        await updateAdminEvent(adminPassword, eventId, payload);
      }

      // 저장 성공 시 S07로 돌아가며 저장 알림 표시 (AC42, AC45, S08-T8)
      router.push("/admin/events?saved=1");
    } catch (err: unknown) {
      setIsSaving(false);
      if (err instanceof ApiClientError) {
        if (err.code === "TOTAL_LESS_THAN_SOLD") {
          setGlobalError(
            "총수량을 판매수량보다 작게 바꿀 수 없어요. 판매수량 이상으로 입력해 주세요."
          );
        } else {
          setGlobalError(`${err.message} 값을 고친 뒤 다시 저장해 주세요.`);
        }
      } else {
        setGlobalError("저장 처리 중 오류가 발생했습니다. 값을 고친 뒤 다시 저장해 주세요.");
      }
    }
  };

  return (
    <main
      className="w-full max-w-[var(--layout-admin)] mx-auto min-h-screen bg-bg border-x border-border flex flex-col"
      aria-label="S08 공연 등록·수정"
    >
      <AdminHeader subTitle="운영 서비스" onLogout={logout} />

      <form onSubmit={handleSubmit} className="p-4 md:p-6 flex flex-col gap-6 flex-1" noValidate>
        <h1 className="text-title font-bold leading-tight">
          {mode === "new" ? "공연 등록" : "공연 수정"}
        </h1>

        {globalError && (
          <p className="flex gap-2 items-start text-error text-body" role="alert">
            <AlertIcon className="w-5 h-5 flex-none mt-0.5" />
            <span>{globalError}</span>
          </p>
        )}

        {/* 공연 정보 그리드 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1 md:col-span-2">
            <label htmlFor="f-title" className="text-caption text-text-muted font-medium">
              제목
            </label>
            <input
              id="f-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={`w-full min-h-[var(--tap-target)] px-3 bg-surface text-text border ${
                fieldErrors.title ? "border-error" : "border-border-strong"
              } rounded-md font-body text-body outline-none focus:outline focus:outline-[var(--focus-width)] focus:outline-focus`}
            />
            {fieldErrors.title && (
              <p className="text-caption text-error">{fieldErrors.title}</p>
            )}
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="f-category" className="text-caption text-text-muted font-medium">
              카테고리
            </label>
            <input
              id="f-category"
              type="text"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className={`w-full min-h-[var(--tap-target)] px-3 bg-surface text-text border ${
                fieldErrors.category ? "border-error" : "border-border-strong"
              } rounded-md font-body text-body outline-none focus:outline focus:outline-[var(--focus-width)] focus:outline-focus`}
            />
            {fieldErrors.category && (
              <p className="text-caption text-error">{fieldErrors.category}</p>
            )}
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="f-sales_status" className="text-caption text-text-muted font-medium">
              판매상태
            </label>
            <select
              id="f-sales_status"
              value={salesStatus}
              onChange={(e) => setSalesStatus(e.target.value as SalesStatus)}
              className="w-full min-h-[var(--tap-target)] px-3 bg-surface text-text border border-border-strong rounded-md font-body text-body outline-none focus:outline focus:outline-[var(--focus-width)] focus:outline-focus"
            >
              <option value="판매종료">판매종료</option>
              <option value="판매중">판매중</option>
              <option value="매진">매진</option>
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="f-venue" className="text-caption text-text-muted font-medium">
              장소
            </label>
            <input
              id="f-venue"
              type="text"
              value={venue}
              onChange={(e) => setVenue(e.target.value)}
              className={`w-full min-h-[var(--tap-target)] px-3 bg-surface text-text border ${
                fieldErrors.venue ? "border-error" : "border-border-strong"
              } rounded-md font-body text-body outline-none focus:outline focus:outline-[var(--focus-width)] focus:outline-focus`}
            />
            {fieldErrors.venue && (
              <p className="text-caption text-error">{fieldErrors.venue}</p>
            )}
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="f-city" className="text-caption text-text-muted font-medium">
              도시
            </label>
            <input
              id="f-city"
              type="text"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className={`w-full min-h-[var(--tap-target)] px-3 bg-surface text-text border ${
                fieldErrors.city ? "border-error" : "border-border-strong"
              } rounded-md font-body text-body outline-none focus:outline focus:outline-[var(--focus-width)] focus:outline-focus`}
            />
            {fieldErrors.city && (
              <p className="text-caption text-error">{fieldErrors.city}</p>
            )}
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="f-start_at" className="text-caption text-text-muted font-medium">
              시작일시
            </label>
            <input
              id="f-start_at"
              type="datetime-local"
              value={startAt}
              onChange={(e) => setStartAt(e.target.value)}
              className={`w-full min-h-[var(--tap-target)] px-3 bg-surface text-text border ${
                fieldErrors.startAt ? "border-error" : "border-border-strong"
              } rounded-md font-body text-body outline-none focus:outline focus:outline-[var(--focus-width)] focus:outline-focus`}
            />
            {fieldErrors.startAt && (
              <p className="text-caption text-error">{fieldErrors.startAt}</p>
            )}
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="f-end_at" className="text-caption text-text-muted font-medium">
              종료일시
            </label>
            <input
              id="f-end_at"
              type="datetime-local"
              value={endAt}
              onChange={(e) => setEndAt(e.target.value)}
              className={`w-full min-h-[var(--tap-target)] px-3 bg-surface text-text border ${
                fieldErrors.endAt ? "border-error" : "border-border-strong"
              } rounded-md font-body text-body outline-none focus:outline focus:outline-[var(--focus-width)] focus:outline-focus`}
            />
            {fieldErrors.endAt && (
              <p className="text-caption text-error">{fieldErrors.endAt}</p>
            )}
          </div>
        </div>

        {/* 등급 목록 섹션 */}
        <section className="flex flex-col gap-3">
          <h2 className="text-body font-bold text-text">등급</h2>

          <div className="flex flex-col gap-3">
            {rows.map((row, index) => {
              const isSaved = !!row.ticket_type_id;
              const gradeErr = fieldErrors[`grade-${index}`];
              const priceErr = fieldErrors[`price-${index}`];
              const totalQtyErr = fieldErrors[`total_quantity-${index}`];

              return (
                <div
                  key={index}
                  className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 items-start p-3 bg-surface rounded-md"
                >
                  <div className="flex flex-col gap-1">
                    <label className="text-caption text-text-muted font-medium">
                      등급
                    </label>
                    <input
                      type="text"
                      placeholder="VIP"
                      value={row.grade}
                      onChange={(e) => handleRowChange(index, "grade", e.target.value)}
                      className={`w-full min-h-[var(--tap-target)] px-3 bg-surface-2 text-text border ${
                        gradeErr ? "border-error" : "border-border-strong"
                      } rounded-md font-body text-body outline-none focus:outline focus:outline-[var(--focus-width)] focus:outline-focus`}
                    />
                    {gradeErr && (
                      <p className="text-caption text-error">{gradeErr}</p>
                    )}
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-caption text-text-muted font-medium">
                      가격(원)
                    </label>
                    <input
                      type="number"
                      inputMode="numeric"
                      placeholder="50000"
                      value={row.price}
                      onChange={(e) => handleRowChange(index, "price", e.target.value)}
                      className={`w-full min-h-[var(--tap-target)] px-3 bg-surface-2 text-text border ${
                        priceErr ? "border-error" : "border-border-strong"
                      } rounded-md font-body text-body num outline-none focus:outline focus:outline-[var(--focus-width)] focus:outline-focus`}
                    />
                    {priceErr && (
                      <p className="text-caption text-error">{priceErr}</p>
                    )}
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-caption text-text-muted font-medium">
                      총수량
                    </label>
                    <input
                      type="number"
                      inputMode="numeric"
                      placeholder="100"
                      value={row.total_quantity}
                      onChange={(e) =>
                        handleRowChange(index, "total_quantity", e.target.value)
                      }
                      className={`w-full min-h-[var(--tap-target)] px-3 bg-surface-2 text-text border ${
                        totalQtyErr ? "border-error" : "border-border-strong"
                      } rounded-md font-body text-body num outline-none focus:outline focus:outline-[var(--focus-width)] focus:outline-focus`}
                    />
                    {totalQtyErr && (
                      <p className="text-caption text-error">{totalQtyErr}</p>
                    )}
                  </div>

                  {/* 수정 시 읽기 전용 표시: 판매수량, 잔여수량 (D18) */}
                  <div className="flex flex-col gap-1">
                    <label className="text-caption text-text-muted font-medium">
                      판매수량
                    </label>
                    <input
                      readOnly
                      value={isSaved ? `${row.sold_quantity ?? 0}장` : "-"}
                      className="w-full min-h-[var(--tap-target)] px-3 bg-bg text-text-muted border border-border rounded-md font-body text-body num cursor-not-allowed"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-caption text-text-muted font-medium">
                      잔여수량
                    </label>
                    <input
                      readOnly
                      value={isSaved ? `${row.remaining_quantity ?? 0}장` : "-"}
                      className="w-full min-h-[var(--tap-target)] px-3 bg-bg text-text-muted border border-border rounded-md font-body text-body num cursor-not-allowed"
                    />
                  </div>

                  <div className="flex flex-col gap-1 justify-end h-full pt-6">
                    {/* 아직 저장하지 않은 새 줄에만 줄 빼기 제공 (D18) */}
                    {!isSaved && (
                      <button
                        type="button"
                        onClick={() => handleRemoveRow(index)}
                        className="inline-flex items-center justify-center min-h-[var(--tap-target)] px-3 bg-surface-2 text-text border border-border-strong rounded-md text-caption font-medium transition-colors hover:bg-surface-3"
                      >
                        줄 빼기
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* 등급 더하기 (S08-T4) */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              disabled={rows.length >= 4}
              onClick={handleAddRow}
              className="inline-flex items-center justify-center min-h-[var(--tap-target)] px-4 bg-surface-2 text-text border border-border-strong rounded-md text-body font-medium transition-colors hover:bg-surface-3 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              등급 더하기
            </button>
            {rows.length >= 4 && (
              <p className="text-caption text-text-muted">
                등급은 4개까지 넣을 수 있어요.
              </p>
            )}
          </div>
        </section>

        {/* 저장하기 및 취소 (S08-T6, S08-T7) */}
        <div className="flex items-center gap-4 pt-4 border-t border-border">
          <button
            type="submit"
            disabled={isSaving}
            className="inline-flex items-center justify-center min-h-[var(--tap-target)] px-6 bg-surface-2 text-text border border-border-strong rounded-md text-body font-medium transition-colors hover:bg-surface-3 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? (
              <span className="spinner" aria-label="저장하는 중" />
            ) : (
              "저장하기"
            )}
          </button>
          <Link
            href="/admin/events"
            className="text-body text-text underline underline-offset-4"
          >
            취소
          </Link>
        </div>
      </form>
    </main>
  );
}
