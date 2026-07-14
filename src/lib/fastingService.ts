import { supabase } from "@/integrations/supabase/client";
import { logAudit } from "@/lib/auditLog";

export interface FastingProtocol {
  id: string;
  protocol_name: string;
  protocol_type: string;
  total_weeks: number;
  is_active: boolean;
  created_by: string | null;
  remarks: string | null;
  no_calories: boolean;
  allowed_items: string[];
  avoid_items: string[];
  breaking_fast_guide: string | null;
  safety_notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface WeeklyPlan {
  id: string;
  protocol_id: string;
  week_number: number;
  fasting_pattern: string;
  lmod_time: string;
  fmod_time: string;
  metabolic_push: boolean;
  push_pattern: string | null;
  push_days: number | null;
  remarks: string | null;
  requires_coach_guidance: boolean;
}

export interface UserProtocol {
  id: string;
  user_id: string;
  protocol_id: string;
  assigned_by: string | null;
  start_date: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface FastingTracking {
  id: string;
  user_id: string;
  date: string;
  lmod_actual_time: string | null;
  fmod_actual_time: string | null;
  fasting_hours_completed: number | null;
  compliance_status: string;
  symptoms_flag: boolean;
  symptoms_notes: string | null;
  created_at: string;
}

// ─── Protocol CRUD ─────────────────────────────
export async function fetchProtocols(): Promise<FastingProtocol[]> {
  const { data, error } = await supabase
    .from("fasting_protocols" as any)
    .select("*")
    .order("protocol_type");
  if (error) throw error;
  return (data as any) ?? [];
}

export async function fetchWeeklyPlans(protocolId: string): Promise<WeeklyPlan[]> {
  const { data, error } = await supabase
    .from("fasting_weekly_plans" as any)
    .select("*")
    .eq("protocol_id", protocolId)
    .order("week_number");
  if (error) throw error;
  return (data as any) ?? [];
}

export async function updateWeeklyPlan(id: string, updates: Partial<WeeklyPlan>) {
  const { error } = await supabase
    .from("fasting_weekly_plans" as any)
    .update(updates as any)
    .eq("id", id);
  if (error) throw error;
  logAudit({ module: "Fasting", action: "update", target_type: "weekly_plan", target_id: id, metadata: updates as any });
}

export async function toggleProtocolActive(id: string, isActive: boolean) {
  const { error } = await supabase
    .from("fasting_protocols" as any)
    .update({ is_active: isActive } as any)
    .eq("id", id);
  if (error) throw error;
  logAudit({ module: "Fasting", action: isActive ? "enable" : "disable", target_type: "protocol", target_id: id });
}

export async function updateProtocol(id: string, updates: Partial<FastingProtocol>) {
  const { error } = await supabase
    .from("fasting_protocols" as any)
    .update(updates as any)
    .eq("id", id);
  if (error) throw error;
  logAudit({ module: "Fasting", action: "update", target_type: "protocol", target_id: id, target_label: updates.protocol_name ?? undefined, metadata: updates as any });
}

export async function duplicateProtocol(sourceId: string): Promise<string> {
  const { data: proto } = await supabase
    .from("fasting_protocols" as any)
    .select("*")
    .eq("id", sourceId)
    .single();
  if (!proto) throw new Error("Protocol not found");

  const p = proto as any;
  const { data: newProto, error: e1 } = await supabase
    .from("fasting_protocols" as any)
    .insert({
      protocol_name: p.protocol_name + " (Copy)",
      protocol_type: p.protocol_type,
      total_weeks: p.total_weeks,
      remarks: p.remarks,
      no_calories: p.no_calories,
      allowed_items: p.allowed_items,
      avoid_items: p.avoid_items,
      breaking_fast_guide: p.breaking_fast_guide,
      safety_notes: p.safety_notes,
    } as any)
    .select("id")
    .single();
  if (e1 || !newProto) throw e1 || new Error("Insert failed");

  const newId = (newProto as any).id;

  const { data: weeks } = await supabase
    .from("fasting_weekly_plans" as any)
    .select("*")
    .eq("protocol_id", sourceId);
  if (weeks && (weeks as any[]).length > 0) {
    const rows = (weeks as any[]).map((w: any) => ({
      protocol_id: newId,
      week_number: w.week_number,
      fasting_pattern: w.fasting_pattern,
      lmod_time: w.lmod_time,
      fmod_time: w.fmod_time,
      metabolic_push: w.metabolic_push,
      push_pattern: w.push_pattern,
      push_days: w.push_days,
      remarks: w.remarks,
      requires_coach_guidance: w.requires_coach_guidance,
    }));
    await supabase.from("fasting_weekly_plans" as any).insert(rows as any);
  }
  logAudit({ module: "Fasting", action: "create", target_type: "protocol", target_id: newId, target_label: p.protocol_name + " (Copy)", metadata: { duplicated_from: sourceId } });
  return newId;
}

// ─── User Protocol ─────────────────────────────
export async function assignProtocolToUser(
  userId: string,
  protocolId: string,
  assignedBy: string,
  startDate: string
) {
  const { error } = await supabase.from("user_protocols" as any).insert({
    user_id: userId,
    protocol_id: protocolId,
    assigned_by: assignedBy,
    start_date: startDate,
    status: "active",
  } as any);
  if (error) throw error;
}

export async function fetchUserProtocol(userId: string): Promise<UserProtocol | null> {
  const { data, error } = await supabase
    .from("user_protocols" as any)
    .select("*")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data as any) ?? null;
}

export async function updateUserProtocolStatus(id: string, status: string) {
  const { error } = await supabase
    .from("user_protocols" as any)
    .update({ status } as any)
    .eq("id", id);
  if (error) throw error;
}

// ─── Tracking ─────────────────────────────
export async function upsertTracking(tracking: Partial<FastingTracking> & { user_id: string; date: string }) {
  const { error } = await supabase
    .from("fasting_tracking" as any)
    .upsert(tracking as any, { onConflict: "user_id,date" });
  if (error) throw error;
}

export async function fetchTrackingForUser(userId: string, days = 30): Promise<FastingTracking[]> {
  const since = new Date();
  since.setDate(since.getDate() - days);
  const { data, error } = await supabase
    .from("fasting_tracking" as any)
    .select("*")
    .eq("user_id", userId)
    .gte("date", since.toISOString().split("T")[0])
    .order("date", { ascending: false });
  if (error) throw error;
  return (data as any) ?? [];
}

// ─── Coach helpers ─────────────────────────────
export async function fetchCoachPatientProtocols(coachUserId: string) {
  // Get assignments for this coach
  const { data: coach } = await supabase
    .from("coaches" as any)
    .select("id")
    .eq("user_id", coachUserId)
    .single();
  if (!coach) return [];

  const { data: assignments } = await supabase
    .from("coach_assignments" as any)
    .select("user_id")
    .eq("coach_id", (coach as any).id)
    .eq("is_active", true);
  if (!assignments || (assignments as any[]).length === 0) return [];

  const userIds = (assignments as any[]).map((a: any) => a.user_id);
  const { data } = await supabase
    .from("user_protocols" as any)
    .select("*")
    .in("user_id", userIds)
    .order("created_at", { ascending: false });
  return (data as any) ?? [];
}

// ─── Helpers ─────────────────────────────
export function getCurrentWeek(startDate: string): number {
  const start = new Date(startDate);
  const now = new Date();
  const diffMs = now.getTime() - start.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  return Math.max(1, Math.min(24, Math.ceil((diffDays + 1) / 7)));
}

export function getCurrentDay(startDate: string): number {
  const start = new Date(startDate);
  const now = new Date();
  const diffMs = now.getTime() - start.getTime();
  return Math.max(1, Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1);
}

export function getPhaseInfo(hours: number) {
  if (hours >= 18) return { phase: "Deep Metabolic State", color: "text-primary", description: "Autophagy and deep cellular repair active", progress: 100 };
  if (hours >= 16) return { phase: "Fat Burning Zone", color: "text-primary", description: "Body is actively burning stored fat", progress: 85 };
  if (hours >= 14) return { phase: "Ketone Production", color: "text-amber-500", description: "Liver producing ketones for energy", progress: 70 };
  if (hours >= 12) return { phase: "Insulin Falling", color: "text-secondary", description: "Insulin levels dropping — switching fuel source", progress: 50 };
  return { phase: "Fed State", color: "text-muted-foreground", description: "Body still processing last meal", progress: 20 };
}

export function formatTime24to12(time24: string): string {
  const [h, m] = time24.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${m.toString().padStart(2, "0")} ${ampm}`;
}

/**
 * Coarse-grained bucket of the user's current fasting window, used to pick
 * matching session-breakdown presets for exercise, yoga, etc. Returns "12",
 * "14", "16", or null when the user has no active protocol / no plan for the
 * current week. Patterns like 13:11 or 18:06 round down to the nearest bucket.
 */
export type FastingBucket = "12" | "14" | "16";

export async function getUserFastingBucket(userId: string): Promise<FastingBucket | null> {
  try {
    const up = await fetchUserProtocol(userId);
    if (!up?.protocol_id || !up?.start_date) return null;
    const week = getCurrentWeek(up.start_date);
    const plans = await fetchWeeklyPlans(up.protocol_id);
    const plan = plans.find((p) => p.week_number === week) ?? plans[0];
    const pattern = plan?.fasting_pattern ?? "";
    const hours = parseInt(pattern.split(":")[0], 10);
    if (!Number.isFinite(hours)) return null;
    if (hours >= 16) return "16";
    if (hours >= 14) return "14";
    if (hours >= 12) return "12";
    return null;
  } catch {
    return null;
  }
}
