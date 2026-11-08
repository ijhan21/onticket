import { apiFetch } from "./client";
import {
  AdminCreateEventInput,
  AdminEventItem,
  AdminUpdateEventInput,
  CheckinInput,
  CheckinResponse,
} from "@/types/admin";

export interface AdminEventsResponse {
  events: AdminEventItem[];
}

export async function fetchAdminEvents(
  adminPassword: string
): Promise<AdminEventItem[]> {
  const data = await apiFetch<AdminEventsResponse>("/admin/events", {
    method: "GET",
    headers: {
      "X-Admin-Password": adminPassword,
    },
    cache: "no-store",
  });
  return data.events || [];
}

export async function createAdminEvent(
  adminPassword: string,
  data: AdminCreateEventInput
): Promise<{ event_id: string; title: string }> {
  return apiFetch<{ event_id: string; title: string }>("/admin/events", {
    method: "POST",
    headers: {
      "X-Admin-Password": adminPassword,
    },
    body: JSON.stringify(data),
  });
}

export async function updateAdminEvent(
  adminPassword: string,
  eventId: string,
  data: AdminUpdateEventInput
): Promise<{ event_id: string; title: string }> {
  return apiFetch<{ event_id: string; title: string }>(
    `/admin/events/${encodeURIComponent(eventId)}`,
    {
      method: "PUT",
      headers: {
        "X-Admin-Password": adminPassword,
      },
      body: JSON.stringify(data),
    }
  );
}

export async function checkinTicket(
  adminPassword: string,
  data: CheckinInput
): Promise<CheckinResponse> {
  return apiFetch<CheckinResponse>("/admin/checkins", {
    method: "POST",
    headers: {
      "X-Admin-Password": adminPassword,
    },
    body: JSON.stringify(data),
  });
}
