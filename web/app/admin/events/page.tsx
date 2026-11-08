"use client";

import React, { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AdminHeader } from "@/components/ui/AdminHeader";
import { AlertIcon, CheckIcon } from "@/components/ui/Icons";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { useAdminAuth } from "@/components/admin/AdminAuthContext";
import { fetchAdminEvents } from "@/lib/api-client/admin";
import { AdminEventItem } from "@/types/admin";
import { formatDate, formatPrice } from "@/lib/utils/format";

function AdminEventsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { adminPassword, isAuthenticated, logout } = useAdminAuth();

  const saved = searchParams.get("saved") === "1";

  const [events, setEvents] = useState<AdminEventItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);

  // 인증 검사: 메모리에 비밀번호가 없으면 S06으로 이동 (AC41)
  useEffect(() => {
    if (!isAuthenticated) {
      router.replace("/admin/login");
    }
  }, [isAuthenticated, router]);

  const loadAdminEvents = async () => {
    if (!adminPassword) return;
    setLoading(true);
    setErrorNotice(null);

    try {
      const data = await fetchAdminEvents(adminPassword);
      // 시작일시 빠른 순 정렬 (D20)
      const sorted = [...data].sort((a, b) => a.start_at.localeCompare(b.start_at));
      setEvents(sorted);
    } catch {
      setErrorNotice("현황을 불러오지 못했어요. 잠시 뒤 다시 시도해 주세요.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      loadAdminEvents();
    }
  }, [isAuthenticated]);

  if (!isAuthenticated) {
    return null;
  }

  return (
    <main
      className="w-full max-w-[var(--layout-admin)] mx-auto min-h-screen bg-bg border-x border-border flex flex-col"
      aria-label="S07 공연 현황"
    >
      <AdminHeader subTitle="운영 서비스" onLogout={logout} />

      <div className="p-4 md:p-6 flex flex-col gap-4 flex-1">
        {/* 저장 완료 알림 (S08-T8) */}
        {saved && !errorNotice && (
          <p className="flex gap-2 items-center text-success text-body font-medium" role="status">
            <CheckIcon className="w-5 h-5 flex-none" />
            <span>저장했어요.</span>
          </p>
        )}

        {/* 툴바: 공연 등록하기 버튼 (S07-T1) */}
        <div className="flex justify-between items-center flex-wrap gap-3">
          <Link
            href="/admin/events/new"
            className="inline-flex items-center justify-center min-h-[var(--tap-target)] px-4 bg-surface-2 text-text border border-border-strong rounded-md text-body font-medium transition-colors hover:bg-surface-3"
          >
            공연 등록하기
          </Link>
        </div>

        {/* 로딩 상태 */}
        {loading && (
          <div className="flex flex-col gap-3 py-4" aria-busy="true">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        )}

        {/* 에러 상태 (S07-T7) */}
        {!loading && errorNotice && (
          <div className="flex flex-col gap-3 items-start py-6">
            <p className="flex gap-2 items-start text-error text-body" role="alert">
              <AlertIcon className="w-5 h-5 flex-none mt-0.5" />
              <span>{errorNotice}</span>
            </p>
            <Button type="button" onClick={loadAdminEvents}>
              다시 시도
            </Button>
          </div>
        )}

        {/* 빈 목록 상태 (S07-T6) */}
        {!loading && !errorNotice && events.length === 0 && (
          <div className="flex flex-col items-start py-8 text-text-muted">
            <p className="text-body">등록된 공연이 없어요. 공연을 등록해 주세요.</p>
          </div>
        )}

        {/* 현황 표 (S07-T4, S07-T5) */}
        {!loading && !errorNotice && events.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-caption text-text-muted font-medium py-2 px-3 whitespace-nowrap">
                    제목
                  </th>
                  <th className="text-caption text-text-muted font-medium py-2 px-3 whitespace-nowrap">
                    시작일시
                  </th>
                  <th className="text-caption text-text-muted font-medium py-2 px-3 whitespace-nowrap">
                    장소
                  </th>
                  <th className="text-caption text-text-muted font-medium py-2 px-3 whitespace-nowrap">
                    판매상태
                  </th>
                  <th className="text-caption text-text-muted font-medium py-2 px-3 text-right whitespace-nowrap">
                    판매 수량
                  </th>
                  <th className="text-caption text-text-muted font-medium py-2 px-3 text-right whitespace-nowrap">
                    입금액
                  </th>
                  <th className="py-2 px-3" />
                </tr>
              </thead>
              <tbody>
                {events.map((e) => (
                  <tr
                    key={e.event_id}
                    className="border-b border-border transition-colors hover:bg-surface"
                  >
                    <td className="py-3 px-3 font-bold text-text break-keep">
                      {e.title}
                    </td>
                    <td className="py-3 px-3 num text-text whitespace-nowrap">
                      {formatDate(e.start_at)}
                    </td>
                    <td className="py-3 px-3 text-text">{e.venue || "-"}</td>
                    <td className="py-3 px-3 text-text whitespace-nowrap">
                      {e.sales_status}
                    </td>
                    <td className="py-3 px-3 text-right num text-text whitespace-nowrap">
                      {(e.sold_quantity || 0).toLocaleString("ko-KR")}장
                    </td>
                    <td className="py-3 px-3 text-right num text-text whitespace-nowrap">
                      {formatPrice(e.total_revenue || 0)}
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap text-right">
                      <div className="flex gap-2 justify-end">
                        <Link
                          href={`/admin/events/${encodeURIComponent(e.event_id)}/edit`}
                          className="inline-flex items-center justify-center min-h-[var(--tap-target)] px-3 bg-surface-2 text-text border border-border-strong rounded-md text-caption font-medium transition-colors hover:bg-surface-3"
                        >
                          수정하기
                        </Link>
                        <Link
                          href={`/admin/checkins?id=${encodeURIComponent(e.event_id)}`}
                          className="inline-flex items-center justify-center min-h-[var(--tap-target)] px-3 bg-surface-2 text-text border border-border-strong rounded-md text-caption font-medium transition-colors hover:bg-surface-3"
                        >
                          입장 확인하기
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}

export default function AdminEventsPage() {
  return (
    <Suspense
      fallback={
        <main className="w-full max-w-[var(--layout-admin)] mx-auto min-h-screen bg-bg border-x border-border flex flex-col p-6">
          <Skeleton className="h-10 w-full" />
        </main>
      }
    >
      <AdminEventsContent />
    </Suspense>
  );
}
