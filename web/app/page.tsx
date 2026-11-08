"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { CustomerHeader } from "@/components/ui/CustomerHeader";
import { EventItemSkeleton } from "@/components/ui/Skeleton";
import { Badge } from "@/components/ui/Badge";
import { AlertIcon } from "@/components/ui/Icons";
import { Button } from "@/components/ui/Button";
import { fetchEvents } from "@/lib/api-client/events";
import { EventItem } from "@/types/event";
import { formatDate } from "@/lib/utils/format";

export default function HomePage() {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadEvents = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchEvents();
      // 판매중 또는 매진 공연만 시작일시 빠른 순으로 정렬 (D7, D20)
      const valid = (data || [])
        .filter((e) => e.sales_status === "판매중" || e.sales_status === "매진")
        .sort((a, b) => a.start_at.localeCompare(b.start_at));
      setEvents(valid);
    } catch {
      setError("공연 목록을 불러오지 못했어요. 잠시 뒤 다시 시도해 주세요.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEvents();
  }, []);

  return (
    <main
      className="w-full max-w-[var(--layout-content-max)] mx-auto min-h-screen bg-bg border-x border-border flex flex-col"
      aria-label="S01 공연 목록"
    >
      <CustomerHeader />

      <div className="p-4 flex flex-col gap-4 flex-1">
        {loading && (
          <div className="flex flex-col gap-2" aria-busy="true">
            <EventItemSkeleton />
            <EventItemSkeleton />
            <EventItemSkeleton />
          </div>
        )}

        {!loading && error && (
          <div className="flex flex-col gap-3 items-start py-8">
            <p className="flex gap-2 items-start text-error text-body" role="alert">
              <AlertIcon className="w-5 h-5 flex-none mt-0.5" />
              <span>{error}</span>
            </p>
            <Button type="button" onClick={loadEvents}>
              다시 시도
            </Button>
          </div>
        )}

        {!loading && !error && events.length === 0 && (
          <div className="flex flex-col items-start py-12 text-text-muted">
            <p className="text-body">지금 예매할 수 있는 공연이 없어요.</p>
          </div>
        )}

        {!loading && !error && events.length > 0 && (
          <ul className="list-none m-0 p-0 flex flex-col gap-2">
            {events.map((e) => {
              const isSoldOut = e.sales_status === "매진";
              return (
                <li key={e.event_id}>
                  <Link
                    href={`/events/${encodeURIComponent(e.event_id)}`}
                    prefetch={false}
                    className="flex gap-3 p-3 bg-surface rounded-md text-text no-underline transition-colors duration-[120ms] hover:bg-surface-3 active:bg-surface-2"
                  >
                    <div
                      className="flex-none w-[calc(var(--space-7)*1.75)] aspect-[var(--poster-ratio)] flex items-end p-2 bg-bg rounded-sm text-caption font-bold leading-tight overflow-hidden break-keep"
                      aria-hidden="true"
                    >
                      {e.title}
                    </div>
                    <div className="min-w-0 flex flex-col gap-1">
                      <h2 className="text-body font-bold leading-tight break-keep">
                        {e.title}
                      </h2>
                      <p className="text-caption text-text-muted">
                        {e.category}
                      </p>
                      <p className="text-caption text-text-muted num">
                        {formatDate(e.start_at)}
                      </p>
                      <p className="text-caption text-text-muted">
                        {e.venue} · {e.city}
                      </p>
                      {isSoldOut && <Badge>매진</Badge>}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </main>
  );
}
