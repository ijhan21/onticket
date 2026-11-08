"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AdminEventForm } from "@/components/admin/AdminEventForm";
import { useAdminAuth } from "@/components/admin/AdminAuthContext";
import { fetchEventById } from "@/lib/api-client/events";
import { EventDetail } from "@/types/event";
import { Skeleton } from "@/components/ui/Skeleton";
import { AdminHeader } from "@/components/ui/AdminHeader";

export default function AdminEditEventPage() {
  const params = useParams();
  const router = useRouter();
  const { isAuthenticated, logout } = useAdminAuth();

  const eventId = String(params.id || "");
  const [eventData, setEventData] = useState<EventDetail | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace("/admin/login");
    }
  }, [isAuthenticated, router]);

  useEffect(() => {
    if (!eventId || !isAuthenticated) return;

    async function loadData() {
      try {
        const data = await fetchEventById(eventId);
        setEventData(data);
      } catch {
        setError("공연 정보를 불러오지 못했습니다.");
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [eventId, isAuthenticated]);

  if (!isAuthenticated) return null;

  if (loading) {
    return (
      <main className="w-full max-w-[var(--layout-admin)] mx-auto min-h-screen bg-bg border-x border-border flex flex-col">
        <AdminHeader subTitle="운영 서비스" onLogout={logout} />
        <div className="p-6 flex flex-col gap-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </main>
    );
  }

  if (error || !eventData) {
    return (
      <main className="w-full max-w-[var(--layout-admin)] mx-auto min-h-screen bg-bg border-x border-border flex flex-col">
        <AdminHeader subTitle="운영 서비스" onLogout={logout} />
        <div className="p-6 flex flex-col gap-4">
          <p className="text-error">{error || "공연을 찾을 수 없습니다."}</p>
        </div>
      </main>
    );
  }

  const initialRows = eventData.ticket_types.map((t) => ({
    ticket_type_id: t.ticket_type_id,
    grade: t.grade,
    price: String(t.price),
    total_quantity: String(t.total_quantity),
    sold_quantity: t.sold_quantity,
    remaining_quantity: t.remaining_quantity,
  }));

  return (
    <AdminEventForm
      mode="edit"
      eventId={eventId}
      initialData={{
        event_id: eventData.event_id,
        title: eventData.title,
        category: eventData.category,
        venue: eventData.venue,
        city: eventData.city,
        start_at: eventData.start_at,
        end_at: eventData.end_at,
        sales_status: eventData.sales_status,
        ticket_types: initialRows,
      }}
    />
  );
}
