import { supabase } from "@/integrations/supabase/client";

export interface NotificationCategory {
  id: string;
  key: string;
  label: string;
  icon: string;
  color: string;
  sort_order: number;
  is_active: boolean;
}

export interface NotificationTemplate {
  id: string;
  category_id: string;
  key: string;
  title: string;
  description: string | null;
  trigger_type: string;
  audience_filter: Record<string, boolean>;
  message_variants: string[];
  icon: string;
  action_url: string | null;
  send_time_local: string;
  send_days: number[];
  cooldown_hours: number;
  timezone: string;
  is_active: boolean;
  updated_at: string;
}

export const AUDIENCE_KEYS: { key: string; label: string; module: string }[] = [
  { key: "all_active_users",         label: "All active users",             module: "general" },
  { key: "has_supplements",          label: "Has a supplement plan",        module: "supplements" },
  { key: "missed_supplement_today",  label: "Hasn't taken supplements today", module: "supplements" },
  { key: "has_movement_goal",        label: "Has a movement goal set",      module: "movement" },
  { key: "missed_movement_today",    label: "Hasn't met steps goal today",  module: "movement" },
  { key: "movement_goal_met_today",  label: "Hit steps goal today",         module: "movement" },
  { key: "no_movement_started_today",label: "Zero steps logged today",      module: "movement" },
  { key: "movement_goal_met_early",  label: "Hit steps goal (paired w/ morning send time)", module: "movement" },
  { key: "has_fasting_protocol",     label: "Has a fasting protocol",       module: "fasting" },
  { key: "missed_fasting_today",     label: "Hasn't fasted today",          module: "fasting" },
  { key: "missed_yoga_today",        label: "Hasn't watched yoga today",    module: "stress" },
  { key: "has_diet_plan",            label: "Has a diet profile",           module: "food" },
  { key: "missed_meal_log_today",    label: "Hasn't logged a meal today",   module: "food" },
  { key: "needs_bp_tracking",        label: "Needs BP tracking",            module: "profile" },
  { key: "has_hypertension",         label: "Has hypertension",             module: "profile" },
  { key: "on_bp_medicine",           label: "On BP medicine",               module: "profile" },
  { key: "profile_incomplete",       label: "Profile incomplete",           module: "profile" },
];

export async function listCategories(): Promise<NotificationCategory[]> {
  const { data, error } = await supabase
    .from("notification_categories" as any)
    .select("*")
    .order("sort_order");
  if (error) throw error;
  return (data ?? []) as any;
}

export async function listTemplates(): Promise<NotificationTemplate[]> {
  const { data, error } = await supabase
    .from("notification_templates" as any)
    .select("*")
    .order("send_time_local");
  if (error) throw error;
  return (data ?? []) as any;
}

export async function upsertTemplate(t: Partial<NotificationTemplate>): Promise<void> {
  if (t.id) {
    const { error } = await supabase.from("notification_templates" as any).update(t as any).eq("id", t.id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from("notification_templates" as any).insert(t as any);
    if (error) throw error;
  }
}

export async function deleteTemplate(id: string): Promise<void> {
  const { error } = await supabase.from("notification_templates" as any).delete().eq("id", id);
  if (error) throw error;
}

export async function toggleTemplate(id: string, is_active: boolean): Promise<void> {
  const { error } = await supabase.from("notification_templates" as any).update({ is_active } as any).eq("id", id);
  if (error) throw error;
}

export async function runDispatcherNow(): Promise<any> {
  const { data, error } = await supabase.functions.invoke("notification-dispatcher");
  if (error) throw error;
  return data;
}
