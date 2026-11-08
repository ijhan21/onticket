export type SalesStatus = "판매중" | "매진" | "판매종료";

export interface TicketType {
  ticket_type_id: string;
  grade: string;
  price: number;
  total_quantity: number;
  sold_quantity: number;
  remaining_quantity: number;
}

export interface EventItem {
  event_id: string;
  title: string;
  category: string;
  venue: string;
  city: string;
  start_at: string;
  end_at: string;
  sales_status: SalesStatus;
}

export interface EventDetail extends EventItem {
  organizer?: string;
  ticket_types: TicketType[];
}
