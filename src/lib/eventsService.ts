import { supabase } from "@/integrations/supabase/client";

export type EventMode = "online" | "offline";
export type EventStatus = "draft" | "published" | "cancelled" | "completed";
export type RegistrationStatus = "registered" | "cancelled" | "attended" | "waitlisted";
export type PaymentStatus = "not_required" | "pending" | "paid" | "refunded";

export interface EventRow {
  id: string;
  title: string;
  description: string | null;
  cover_image_url: string | null;
  mode: EventMode;
  online_url: string | null;
  venue_name: string | null;
  venue_address: string | null;
  venue_city: string | null;
  venue_lat: number | null;
  venue_lng: number | null;
  starts_at: string;
  ends_at: string | null;
  timezone: string;
  organizer_type: "bbdo" | "coach" | "channel_partner" | "admin";
  organizer_id: string | null;
  organizer_name: string;
  organizer_avatar_url: string | null;
  is_paid: boolean;
  fee_inr: number;
  currency: string;
  capacity: number | null;
  registered_count: number;
  status: EventStatus;
  tags: string[];
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface EventRegistrationRow {
  id: string;
  event_id: string;
  user_id: string;
  status: RegistrationStatus;
  payment_status: PaymentStatus;
  amount_paid_inr: number;
  registered_at: string;
  cancelled_at: string | null;
  notes: string | null;
}

const db = supabase as any;

export async function listUpcomingEvents(): Promise<EventRow[]> {
  const { data, error } = await db
    .from("events")
    .select("*")
    .eq("status", "published")
    .gte("starts_at", new Date().toISOString())
    .order("starts_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as EventRow[];
}

export async function listMyRegistrations(): Promise<
  Array<EventRegistrationRow & { event: EventRow }>
> {
  const { data, error } = await db
    .from("event_registrations")
    .select("*, event:events(*)")
    .order("registered_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as any;
}

export async function registerForEvent(eventId: string) {
  const { data, error } = await db.rpc("register_for_event", { _event_id: eventId });
  if (error) throw error;
  return data as EventRegistrationRow;
}

export async function cancelEventRegistration(eventId: string) {
  const { data, error } = await db.rpc("cancel_event_registration", { _event_id: eventId });
  if (error) throw error;
  return data as EventRegistrationRow;
}

export function formatEventWhen(iso: string, tz = "Asia/Kolkata"): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString("en-IN", {
      timeZone: tz,
      weekday: "short",
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}
