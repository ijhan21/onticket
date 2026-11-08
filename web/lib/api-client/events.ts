import { apiFetch } from "./client";
import { EventDetail, EventItem, EventSuggestion } from "@/types/event";

export interface EventsResponse {
  events: EventItem[];
}

export interface SuggestionsResponse {
  suggestions: EventSuggestion[];
}

export async function fetchEvents(query?: string): Promise<EventItem[]> {
  const path = query && query.trim()
    ? `/events?q=${encodeURIComponent(query.trim())}`
    : "/events";
  const data = await apiFetch<EventsResponse>(path, {
    method: "GET",
    cache: "no-store",
  });
  return data.events || [];
}

export async function fetchEventSuggestions(query: string): Promise<EventSuggestion[]> {
  const trimmed = query.trim();
  if (!trimmed) {
    return [];
  }
  const data = await apiFetch<SuggestionsResponse>(
    `/events/suggestions?q=${encodeURIComponent(trimmed)}`,
    {
      method: "GET",
      cache: "no-store",
    }
  );
  return data.suggestions || [];
}

export async function fetchEventById(eventId: string): Promise<EventDetail> {
  return apiFetch<EventDetail>(`/events/${encodeURIComponent(eventId)}`, {
    method: "GET",
    cache: "no-store",
  });
}
