"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CustomerHeader } from "@/components/ui/CustomerHeader";
import { EventItemSkeleton } from "@/components/ui/Skeleton";
import { Badge } from "@/components/ui/Badge";
import { AlertIcon, SearchIcon, XIcon } from "@/components/ui/Icons";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { fetchEvents, fetchEventSuggestions } from "@/lib/api-client/events";
import { EventItem, EventSuggestion } from "@/types/event";
import { formatDate } from "@/lib/utils/format";

export default function HomePage() {
  const router = useRouter();
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // 검색 및 추천 검색어 상태
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [activeQuery, setActiveQuery] = useState<string>("");
  const [suggestions, setSuggestions] = useState<EventSuggestion[]>([]);
  const [isSuggestionsOpen, setIsSuggestionsOpen] = useState<boolean>(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  const loadEvents = async (query?: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchEvents(query);
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

  // 글자 입력 시 실시간 추천 검색어 조회 (Debounce 200ms)
  useEffect(() => {
    const trimmed = searchTerm.trim();
    if (!trimmed) {
      setSuggestions([]);
      setIsSuggestionsOpen(false);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const list = await fetchEventSuggestions(trimmed);
        setSuggestions(list);
        setIsSuggestionsOpen(list.length > 0);
      } catch {
        setSuggestions([]);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  // 검색창 외부 클릭 시 추천 검색어 닫기
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(event.target as Node)
      ) {
        setIsSuggestionsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSuggestionsOpen(false);
    setActiveQuery(searchTerm.trim());
    loadEvents(searchTerm.trim());
  };

  const handleSelectSuggestion = (item: EventSuggestion) => {
    setIsSuggestionsOpen(false);
    if (item.type === "event" && item.eventId) {
      router.push(`/events/${encodeURIComponent(item.eventId)}`);
    } else {
      setSearchTerm(item.text);
      setActiveQuery(item.text);
      loadEvents(item.text);
    }
  };

  const handleClearSearch = () => {
    setSearchTerm("");
    setActiveQuery("");
    setSuggestions([]);
    setIsSuggestionsOpen(false);
    loadEvents("");
  };

  return (
    <main
      className="w-full max-w-[var(--layout-content-max)] mx-auto min-h-screen bg-bg border-x border-border flex flex-col"
      aria-label="S01 공연 목록 및 검색"
    >
      <CustomerHeader />

      <div className="p-4 flex flex-col gap-4 flex-1">
        {/* 검색창 및 실시간 추천 검색어 UI */}
        <div ref={searchContainerRef} className="relative w-full">
          <form onSubmit={handleSearchSubmit} className="relative flex items-center">
            <SearchIcon className="absolute left-3 w-5 h-5 text-text-muted pointer-events-none" />
            <Input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onFocus={() => {
                if (suggestions.length > 0) setIsSuggestionsOpen(true);
              }}
              placeholder="공연명, 장소, 카테고리 검색"
              aria-label="공연 검색어 입력"
              className="pl-10 pr-24"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={handleClearSearch}
                className="absolute right-14 p-1 text-text-muted hover:text-text cursor-pointer transition-colors"
                aria-label="검색어 지우기"
              >
                <XIcon className="w-4 h-4" />
              </button>
            )}
            <button
              type="submit"
              className="absolute right-2 px-3 py-1.5 text-caption font-medium bg-surface-2 hover:bg-surface-3 text-text rounded border border-border cursor-pointer transition-colors"
            >
              검색
            </button>
          </form>

          {/* 추천 검색어 드롭다운 */}
          {isSuggestionsOpen && suggestions.length > 0 && (
            <ul
              className="absolute left-0 right-0 top-full mt-1.5 z-30 bg-surface border border-border-strong rounded-md shadow-lg overflow-hidden list-none p-0 m-0 divide-y divide-border"
              role="listbox"
              aria-label="추천 검색어 목록"
            >
              {suggestions.map((item, idx) => (
                <li
                  key={`${item.type}-${item.text}-${idx}`}
                  role="option"
                  aria-selected={false}
                  onClick={() => handleSelectSuggestion(item)}
                  className="flex items-center justify-between p-3 cursor-pointer hover:bg-surface-2 transition-colors text-body"
                >
                  <div className="flex items-center gap-2.5 min-w-0 pr-2">
                    <SearchIcon className="w-4 h-4 text-text-muted flex-none" />
                    <div className="min-w-0 flex flex-col">
                      <span className="font-medium text-text truncate">
                        {item.text}
                      </span>
                      {item.subtext && (
                        <span className="text-caption text-text-muted truncate">
                          {item.subtext}
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="text-caption px-2 py-0.5 rounded bg-surface-2 text-text-muted border border-border flex-none">
                    {item.type === "category"
                      ? "카테고리"
                      : item.type === "venue"
                      ? "공연장"
                      : "공연"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* 검색 결과 건수 표시 */}
        {activeQuery && !loading && (
          <div className="flex items-center justify-between px-1 text-caption text-text-muted">
            <span>
              &apos;<span className="text-text font-medium">{activeQuery}</span>&apos; 검색 결과{" "}
              <span className="num font-bold text-text">{events.length}</span>건
            </span>
            <button
              type="button"
              onClick={handleClearSearch}
              className="text-text-muted hover:text-text underline cursor-pointer"
            >
              전체보기
            </button>
          </div>
        )}

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
            <Button type="button" onClick={() => loadEvents(activeQuery)}>
              다시 시도
            </Button>
          </div>
        )}

        {!loading && !error && events.length === 0 && (
          <div className="flex flex-col items-start py-12 gap-3 text-text-muted">
            <p className="text-body text-text">
              {activeQuery
                ? `'${activeQuery}'에 대한 검색 결과가 없어요.`
                : "지금 예매할 수 있는 공연이 없어요."}
            </p>
            {activeQuery && (
              <>
                <p className="text-caption">
                  다른 검색어로 찾아보시거나 전체 공연을 확인해 보세요.
                </p>
                <Button type="button" onClick={handleClearSearch}>
                  전체 공연 보기
                </Button>
              </>
            )}
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
