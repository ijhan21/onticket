import { apiFetch } from "./client";
import { EventDetail, EventItem } from "@/types/event";

export interface EventsResponse {
  events: EventItem[];
}

export async function fetchEvents(): Promise<EventItem[]> {
  const data = await apiFetch<EventsResponse>("/events", {
    method: "GET",
    cache: "no-store",
  });
  return data.events || [];
}

export async function fetchEventById(eventId: string): Promise<EventDetail> {
  return apiFetch<EventDetail>(`/events/${encodeURIComponent(eventId)}`, {
    method: "GET",
    cache: "no-store",
  });
}
