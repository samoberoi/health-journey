import { supabase } from "@/integrations/supabase/client";

export type RecStatus = "recommended" | "accepted" | "ordered" | "completed" | "dismissed";

export interface TestRecommendation {
  id: string;
  coach_id: string;
  user_id: string;
  product_codes: string[];
  note: string | null;
  status: RecStatus;
  created_at: string;
}

export interface SupplementRecItem {
  supplement_id: string;
  name?: string;
  dose?: string;
  timing?: string;
  duration_days?: number;
}
export interface SupplementRecommendation {
  id: string;
  coach_id: string;
  user_id: string;
  items: SupplementRecItem[];
  note: string | null;
  status: RecStatus;
  created_at: string;
}

// TESTS
export async function fetchTestRecsForUser(userId: string) {
  const { data, error } = await supabase
    .from("coach_test_recommendations")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) return [] as TestRecommendation[];
  return (data ?? []) as TestRecommendation[];
}

export async function createTestRec(input: { coach_id: string; user_id: string; product_codes: string[]; note?: string }) {
  const { data, error } = await supabase
    .from("coach_test_recommendations")
    .insert({ ...input, note: input.note ?? null })
    .select()
    .single();
  if (error) throw error;
  return data as TestRecommendation;
}

export async function updateTestRecStatus(id: string, status: RecStatus) {
  const { error } = await supabase.from("coach_test_recommendations").update({ status }).eq("id", id);
  if (error) throw error;
}

// SUPPLEMENTS
export async function fetchSupplementRecsForUser(userId: string) {
  const { data, error } = await supabase
    .from("coach_supplement_recommendations")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) return [] as SupplementRecommendation[];
  return ((data ?? []) as any[]).map((r) => ({ ...r, items: (r.items as any) || [] })) as SupplementRecommendation[];
}

export async function createSupplementRec(input: {
  coach_id: string;
  user_id: string;
  items: SupplementRecItem[];
  note?: string;
}) {
  const { data, error } = await supabase
    .from("coach_supplement_recommendations")
    .insert({
      coach_id: input.coach_id,
      user_id: input.user_id,
      items: input.items as any,
      note: input.note ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return data as any as SupplementRecommendation;
}

export async function updateSupplementRecStatus(id: string, status: RecStatus) {
  const { error } = await supabase.from("coach_supplement_recommendations").update({ status }).eq("id", id);
  if (error) throw error;
}

// CONSULTATION REQUESTS
export interface ConsultationRequest {
  id: string;
  user_id: string;
  coach_id: string | null;
  topic: string;
  urgency: string;
  preferred_slots: any;
  status: "pending" | "scheduled" | "declined" | "completed";
  meeting_id: string | null;
  coach_response: string | null;
  requested_at: string;
}

export async function createConsultationRequest(input: {
  user_id: string;
  coach_id: string | null;
  topic: string;
  urgency?: "normal" | "urgent";
  preferred_slots?: string[];
}) {
  const { data, error } = await supabase
    .from("consultation_requests")
    .insert({
      user_id: input.user_id,
      coach_id: input.coach_id,
      topic: input.topic,
      urgency: input.urgency ?? "normal",
      preferred_slots: (input.preferred_slots ?? []) as any,
    })
    .select()
    .single();
  if (error) throw error;
  return data as any as ConsultationRequest;
}

export async function fetchConsultationRequestsForCoach(coachId: string) {
  const { data, error } = await supabase
    .from("consultation_requests")
    .select("*")
    .eq("coach_id", coachId)
    .order("requested_at", { ascending: false });
  if (error) return [] as ConsultationRequest[];
  return (data ?? []) as any[] as ConsultationRequest[];
}

export async function fetchConsultationRequestsForUser(userId: string) {
  const { data, error } = await supabase
    .from("consultation_requests")
    .select("*")
    .eq("user_id", userId)
    .order("requested_at", { ascending: false });
  if (error) return [] as ConsultationRequest[];
  return (data ?? []) as any[] as ConsultationRequest[];
}

export async function updateConsultationRequest(id: string, patch: Partial<ConsultationRequest>) {
  const { error } = await supabase.from("consultation_requests").update(patch as any).eq("id", id);
  if (error) throw error;
}
