import { supabase } from "@/integrations/supabase/client";

export interface PartnerRecord {
  id: string;
  user_id: string | null;
  partner_type: string;
  name: string;
  headline: string | null;
  bio: string | null;
  avatar_url: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  experience_years: number | null;
  certifications: string[];
  languages: string[];
  service_locations: string[];
  instagram_url: string | null;
  website_url: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  bank_name: string | null;
  bank_account_number: string | null;
  bank_ifsc: string | null;
  is_active: boolean;
  bbdo_commission_pct: number;
  partner_commission_pct: number;
}

export interface PartnerPackage {
  id: string;
  partner_id: string;
  package_type: "group" | "private";
  name: string;
  description: string | null;
  price_inr: number;
  classes_per_month: number | null;
  duration_minutes: number | null;
  is_active: boolean;
  sort_order: number;
}

export interface PartnerSlot {
  id: string;
  partner_id: string;
  package_id: string | null;
  package_type: "group" | "private";
  template_id?: string | null;
  template_label?: string | null;
  title: string | null;
  scheduled_at: string;
  duration_min: number;
  meet_link: string | null;
  capacity: number;
  booked_count: number;
  notes: string | null;
  is_active: boolean;
}

export interface PartnerBooking {
  id: string;
  user_id: string;
  partner_id: string;
  package_id: string;
  package_type: string;
  price_inr: number;
  selected_slot: string | null;
  preferred_time: string | null;
  preferred_days: string[] | null;
  slot_id: string | null;
  template_id?: string | null;
  status: string;
  payment_status: string;
  starts_on?: string | null;
  expires_on?: string | null;
  notes: string | null;
  created_at: string;
  booked_slot_ids?: string[];
  user_name?: string | null;
  user_phone?: string | null;
}

export async function isChannelPartner(userId: string): Promise<boolean> {
  const { data } = await supabase.rpc("has_role" as any, {
    _user_id: userId,
    _role: "channel_partner" as any,
  });
  return !!data;
}

export async function fetchMyPartner(): Promise<PartnerRecord | null> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;
  const { data } = await supabase
    .from("channel_partners" as any)
    .select("*")
    .eq("user_id", auth.user.id)
    .eq("is_active", true)
    .maybeSingle();
  return (data as any) ?? null;
}

export async function updateMyPartnerProfile(
  partnerId: string,
  updates: Partial<Pick<
    PartnerRecord,
    | "name"
    | "headline"
    | "bio"
    | "avatar_url"
    | "contact_email"
    | "contact_phone"
    | "experience_years"
    | "certifications"
    | "languages"
    | "service_locations"
    | "instagram_url"
    | "website_url"
    | "address_line1"
    | "address_line2"
    | "city"
    | "state"
    | "pincode"
    | "bank_name"
    | "bank_account_number"
    | "bank_ifsc"
  >>
) {
  const { error } = await supabase
    .from("channel_partners" as any)
    .update(updates as any)
    .eq("id", partnerId);
  if (error) throw error;
}

export async function fetchPartnerPackages(partnerId: string): Promise<PartnerPackage[]> {
  const { data } = await supabase
    .from("channel_partner_packages" as any)
    .select("*")
    .eq("partner_id", partnerId)
    .order("sort_order", { ascending: true });
  return (data as any) ?? [];
}

export async function fetchPartnerSlots(partnerId: string): Promise<PartnerSlot[]> {
  const { data } = await supabase
    .from("channel_partner_slots" as any)
    .select("*")
    .eq("partner_id", partnerId)
    .order("scheduled_at", { ascending: true });
  return (data as any) ?? [];
}

export async function fetchUpcomingSlotsForPackage(packageId: string): Promise<PartnerSlot[]> {
  const { data } = await supabase
    .from("channel_partner_slots" as any)
    .select("*")
    .eq("package_id", packageId)
    .eq("is_active", true)
    .gte("scheduled_at", new Date().toISOString())
    .order("scheduled_at", { ascending: true })
    .limit(20);
  return (data as any) ?? [];
}

export interface AvailableSlot {
  template_id: string;
  label: string;
  time_of_day: string;
  duration_min: number;
  days_of_week: number[];
  capacity_per_class: number;
  upcoming_count: number;
  booked_count_total: number;
  capacity_total: number;
  series_available_seats: number;
  seats_remaining_total: number;
  next_class_at: string | null;
  first_available_instance_id: string | null;
  meet_link: string | null;
  package_type: "group" | "private";
}

/** For end-user booking: recurring slots (templates) with real availability. */
export async function fetchAvailableSlotsForPackage(packageId: string): Promise<AvailableSlot[]> {
  const nowIso = new Date().toISOString();
  const { data: templates } = await supabase
    .from("channel_partner_slot_templates" as any)
    .select("*")
    .eq("package_id", packageId)
    .eq("is_active", true);

  const tmpls = ((templates as any) ?? []) as SlotTemplate[];
  if (!tmpls.length) return [];

  const { data: instances } = await supabase
    .from("channel_partner_slots" as any)
    .select("id, template_id, scheduled_at, capacity, booked_count, meet_link, is_active")
    .in("template_id", tmpls.map((t) => t.id))
    .eq("is_active", true)
    .gte("scheduled_at", nowIso)
    .order("scheduled_at", { ascending: true });

  const byTemplate = new Map<string, any[]>();
  ((instances as any) ?? []).forEach((s: any) => {
    if (!byTemplate.has(s.template_id)) byTemplate.set(s.template_id, []);
    byTemplate.get(s.template_id)!.push(s);
  });

  const result: AvailableSlot[] = tmpls.map((t) => {
    const list = byTemplate.get(t.id) ?? [];
    const bookedTotal = list.reduce((sum, s) => sum + (s.booked_count ?? 0), 0);
    const capacityTotal = list.reduce((sum, s) => sum + (s.capacity ?? 0), 0);
    const seriesSeats = list.length ? Math.min(...list.map((s) => Math.max(0, (s.capacity ?? 0) - (s.booked_count ?? 0)))) : 0;
    const firstAvail = seriesSeats > 0 ? (list.find((s) => s.booked_count < s.capacity) ?? null) : null;
    return {
      template_id: t.id,
      label: t.label,
      time_of_day: t.time_of_day.slice(0, 5),
      duration_min: t.duration_min,
      days_of_week: t.days_of_week,
      capacity_per_class: t.capacity,
      upcoming_count: list.length,
      booked_count_total: bookedTotal,
      capacity_total: capacityTotal,
      series_available_seats: seriesSeats,
      seats_remaining_total: seriesSeats,
      next_class_at: list[0]?.scheduled_at ?? null,
      first_available_instance_id: firstAvail?.id ?? null,
      meet_link: t.meet_link ?? firstAvail?.meet_link ?? null,
      package_type: t.package_type,
    };
  });

  // Always show upcoming slots (group + private). UI marks fully-booked as "Full".
  return result.filter((r) => r.upcoming_count > 0);
}




export async function fetchPartnerBookings(partnerId: string): Promise<PartnerBooking[]> {
  const { data: bookings } = await supabase
    .from("yoga_bookings" as any)
    .select("*")
    .eq("partner_id", partnerId)
    .order("created_at", { ascending: false });
  const list = ((bookings as any) ?? []) as PartnerBooking[];
  if (!list.length) return [];
  const ids = Array.from(new Set(list.map((b) => b.user_id)));
  const { data: profiles } = await supabase
    .from("profiles" as any)
    .select("user_id,name,phone")
    .in("user_id", ids);
  const byId = new Map<string, any>();
  ((profiles as any) ?? []).forEach((p: any) => byId.set(p.user_id, p));
  const bookingIds = list.map((b) => b.id);
  const { data: instances } = await supabase
    .from("yoga_booking_instances" as any)
    .select("booking_id, slot_id")
    .in("booking_id", bookingIds);
  const slotsByBooking = new Map<string, string[]>();
  ((instances as any) ?? []).forEach((row: any) => {
    if (!slotsByBooking.has(row.booking_id)) slotsByBooking.set(row.booking_id, []);
    slotsByBooking.get(row.booking_id)!.push(row.slot_id);
  });
  return list.map((b) => ({
    ...b,
    booked_slot_ids: slotsByBooking.get(b.id) ?? [],
    user_name: byId.get(b.user_id)?.name ?? null,
    user_phone: byId.get(b.user_id)?.phone ?? null,
  }));
}

export async function upsertSlot(input: Partial<PartnerSlot> & { partner_id: string; package_type: "group" | "private"; scheduled_at: string }) {
  const payload = {
    partner_id: input.partner_id,
    package_id: input.package_id ?? null,
    package_type: input.package_type,
    title: input.title ?? null,
    scheduled_at: input.scheduled_at,
    duration_min: input.duration_min ?? 60,
    meet_link: input.meet_link ?? null,
    capacity: input.capacity ?? 10,
    notes: input.notes ?? null,
    is_active: input.is_active ?? true,
  };
  if (input.id) {
    const { error } = await supabase.from("channel_partner_slots" as any).update(payload).eq("id", input.id);
    if (error) throw error;
    return input.id;
  }
  const { data, error } = await supabase.from("channel_partner_slots" as any).insert(payload).select("id").single();
  if (error) throw error;
  return (data as any).id as string;
}

export async function deleteSlot(id: string) {
  const { error } = await supabase.from("channel_partner_slots" as any).delete().eq("id", id);
  if (error) throw error;
}

export async function updateBookingSlot(bookingId: string, slotId: string | null, status?: string) {
  const patch: any = { slot_id: slotId };
  if (status) patch.status = status;
  const { error } = await supabase.from("yoga_bookings" as any).update(patch).eq("id", bookingId);
  if (error) throw error;
}

// ================= Recurring slot templates =================

export interface SlotTemplate {
  id: string;
  partner_id: string;
  package_id: string;
  package_type: "group" | "private";
  label: string;
  time_of_day: string; // "HH:MM:SS"
  duration_min: number;
  days_of_week: number[]; // 0=Sun..6=Sat
  start_date: string; // YYYY-MM-DD
  weeks_count: number;
  meet_link: string | null;
  capacity: number;
  notes: string | null;
  is_active: boolean;
}

export const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const DAY_SHORT = ["S", "M", "T", "W", "T", "F", "S"];

export function formatDays(days: number[]): string {
  const sorted = [...days].sort();
  return sorted.map((d) => DAY_LABELS[d]).join("/");
}

export async function fetchTemplatesForPackage(packageId: string): Promise<SlotTemplate[]> {
  const { data } = await supabase
    .from("channel_partner_slot_templates" as any)
    .select("*")
    .eq("package_id", packageId)
    .order("start_date", { ascending: true });
  return (data as any) ?? [];
}

/** Generate class-instance rows in channel_partner_slots from a template. */
function generateInstances(t: SlotTemplate) {
  const rows: any[] = [];
  const [h, m] = t.time_of_day.split(":").map((n) => Number(n));
  const start = new Date(`${t.start_date}T00:00:00`);
  const end = new Date(start);
  end.setDate(end.getDate() + t.weeks_count * 7);
  for (let d = new Date(start); d < end; d.setDate(d.getDate() + 1)) {
    if (!t.days_of_week.includes(d.getDay())) continue;
    const at = new Date(d);
    at.setHours(h, m ?? 0, 0, 0);
    rows.push({
      partner_id: t.partner_id,
      package_id: t.package_id,
      package_type: t.package_type,
      title: t.label,
      scheduled_at: at.toISOString(),
      duration_min: t.duration_min,
      meet_link: t.meet_link,
      capacity: t.package_type === "private" ? 1 : t.capacity,
      notes: t.notes,
      is_active: t.is_active,
      template_id: t.id,
      template_label: t.label,
    });
  }
  return rows;
}

export async function saveTemplateWithInstances(input: Partial<SlotTemplate> & {
  partner_id: string;
  package_id: string;
  package_type: "group" | "private";
  label: string;
  time_of_day: string;
  days_of_week: number[];
  start_date: string;
  weeks_count: number;
}) {
  const payload = {
    partner_id: input.partner_id,
    package_id: input.package_id,
    package_type: input.package_type,
    label: input.label,
    time_of_day: input.time_of_day,
    duration_min: input.duration_min ?? 60,
    days_of_week: input.days_of_week,
    start_date: input.start_date,
    weeks_count: input.weeks_count,
    meet_link: input.meet_link ?? null,
    capacity: input.capacity ?? 10,
    notes: input.notes ?? null,
    is_active: input.is_active ?? true,
  };

  let templateId = input.id;
  if (templateId) {
    const { error } = await supabase
      .from("channel_partner_slot_templates" as any)
      .update(payload)
      .eq("id", templateId);
    if (error) throw error;
    // Wipe only *unbooked, future* instances so bookings survive
    await supabase
      .from("channel_partner_slots" as any)
      .delete()
      .eq("template_id", templateId)
      .eq("booked_count", 0)
      .gte("scheduled_at", new Date().toISOString());
  } else {
    const { data, error } = await supabase
      .from("channel_partner_slot_templates" as any)
      .insert(payload)
      .select("id")
      .single();
    if (error) throw error;
    templateId = (data as any).id;
  }

  const template: SlotTemplate = { ...(payload as any), id: templateId! };
  const rows = generateInstances(template);
  if (rows.length) {
    const { error } = await supabase.from("channel_partner_slots" as any).insert(rows);
    if (error) throw error;
  }
  return templateId!;
}

export async function deleteTemplate(id: string) {
  // Cascade removes generated instances (FK ON DELETE CASCADE)
  const { error } = await supabase
    .from("channel_partner_slot_templates" as any)
    .delete()
    .eq("id", id);
  if (error) throw error;
}

/** Clone a template to the next calendar month (start_date + 1 month). */
export async function copyTemplateToNextMonth(t: SlotTemplate): Promise<string> {
  const d = new Date(`${t.start_date}T00:00:00`);
  const day = d.getDate();
  d.setMonth(d.getMonth() + 1);
  if (d.getDate() < day) d.setDate(0);
  const nextStart = d.toISOString().slice(0, 10);

  return saveTemplateWithInstances({
    partner_id: t.partner_id,
    package_id: t.package_id,
    package_type: t.package_type,
    label: t.label,
    time_of_day: t.time_of_day,
    duration_min: t.duration_min,
    days_of_week: t.days_of_week,
    start_date: nextStart,
    weeks_count: t.weeks_count,
    meet_link: t.meet_link,
    capacity: t.capacity,
    notes: t.notes,
    is_active: t.is_active,
  });
}

