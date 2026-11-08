import { SalesStatus } from "./event";

export interface AdminEventItem {
  event_id: string;
  title: string;
  sales_status: SalesStatus;
  start_at: string;
  end_at: string;
  sold_quantity: number;
  total_revenue: number;
  category?: string;
  venue?: string;
  city?: string;
}

export interface AdminTicketTypeInput {
  ticket_type_id?: string;
  grade: string;
  price: number;
  total_quantity: number;
  sold_quantity?: number;
  remaining_quantity?: number;
}

export interface AdminCreateEventInput {
  event_id: string;
  title: string;
  category: string;
  venue: string;
  city: string;
  start_at: string;
  end_at: string;
  sales_status: SalesStatus;
  ticket_types: AdminTicketTypeInput[];
}

export interface AdminUpdateEventInput {
  title: string;
  category: string;
  venue: string;
  city: string;
  start_at: string;
  end_at: string;
  sales_status: SalesStatus;
  ticket_types: AdminTicketTypeInput[];
}

export interface CheckinInput {
  qr_code: string;
  gate: string;
  event_id?: string;
}

export interface CheckinResponse {
  checkin_id: string;
  order_id: string;
  qr_code: string;
  gate: string;
  checked_in_at: string;
  result: "정상";
  grade?: string;
  quantity?: number;
}
