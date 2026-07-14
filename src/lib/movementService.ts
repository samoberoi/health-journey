import { supabase } from "@/integrations/supabase/client";
import { logAudit } from "@/lib/auditLog";

export type MovementConfig = {
  id: string;
  is_active: boolean;
  base_daily_steps: number;
  increment_per_level: number;
  max_daily_steps: number;
  weeks_per_level: number;
  min_days_per_week: number;
  miss_policy: "hold" | "reset" | "demote";
  bmi_modifiers: Record<string, number>;
  activity_modifiers: Record<string, number>;
  age_modifiers: Record<string, number>;
  notes: string | null;
  updated_at: string;
};

export type MovementLevel = {
  id: string;
  level_number: number;
  name: string;
  description: string | null;
  target_daily_steps: number;
  badge_icon: string;
  badge_color: string;
  accent_color: string;
  is_active: boolean;
};

export type MovementBadge = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  icon: string;
  color: string;
  criteria: Record<string, unknown>;
  is_active: boolean;
};

const C = "movement_config" as const;
const L = "movement_levels" as const;
const B = "movement_badges" as const;

export async function getMovementConfig(): Promise<MovementConfig | null> {
  const { data, error } = await supabase
    .from(C as any)
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data as any) ?? null;
}

export async function updateMovementConfig(
  id: string,
  patch: Partial<MovementConfig>,
): Promise<void> {
  const { error } = await supabase.from(C as any).update(patch as any).eq("id", id);
  if (error) throw error;
  logAudit({ module: "Movement", action: "update", target_type: "config", target_id: id, metadata: patch as any });
}

export async function listMovementLevels(): Promise<MovementLevel[]> {
  const { data, error } = await supabase
    .from(L as any)
    .select("*")
    .order("level_number", { ascending: true });
  if (error) throw error;
  return (data as any) ?? [];
}

export async function upsertMovementLevel(level: Partial<MovementLevel>): Promise<void> {
  if (level.id) {
    const { error } = await supabase.from(L as any).update(level as any).eq("id", level.id);
    if (error) throw error;
    logAudit({ module: "Movement", action: "update", target_type: "level", target_id: level.id, target_label: level.name ?? undefined });
  } else {
    const { error } = await supabase.from(L as any).insert(level as any);
    if (error) throw error;
    logAudit({ module: "Movement", action: "create", target_type: "level", target_label: level.name ?? undefined });
  }
}

export async function deleteMovementLevel(id: string): Promise<void> {
  const { error } = await supabase.from(L as any).delete().eq("id", id);
  if (error) throw error;
  logAudit({ module: "Movement", action: "delete", target_type: "level", target_id: id });
}

export async function listMovementBadges(): Promise<MovementBadge[]> {
  const { data, error } = await supabase
    .from(B as any)
    .select("*")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data as any) ?? [];
}

export async function upsertMovementBadge(badge: Partial<MovementBadge>): Promise<void> {
  if (badge.id) {
    const { error } = await supabase.from(B as any).update(badge as any).eq("id", badge.id);
    if (error) throw error;
    logAudit({ module: "Movement", action: "update", target_type: "badge", target_id: badge.id, target_label: badge.name ?? undefined });
  } else {
    const { error } = await supabase.from(B as any).insert(badge as any);
    if (error) throw error;
    logAudit({ module: "Movement", action: "create", target_type: "badge", target_label: badge.name ?? undefined });
  }
}

export async function deleteMovementBadge(id: string): Promise<void> {
  const { error } = await supabase.from(B as any).delete().eq("id", id);
  if (error) throw error;
  logAudit({ module: "Movement", action: "delete", target_type: "badge", target_id: id });
}

/**
 * Compute the recommended starting daily step target for a user profile,
 * using the active config's modifiers. Weight is factored in via BMI
 * (derived from height + weight when available).
 */
export function computeRecommendedSteps(
  cfg: MovementConfig,
  inputs: {
    bmiCategory?: string | null;
    activityLevel?: string | null;
    age?: number | null;
    weightKg?: number | null;
    heightCm?: number | null;
  },
): number {
  // Derive BMI category dynamically from current weight/height when possible,
  // so the target adapts the moment a user updates their weight.
  let bmiRaw = inputs.bmiCategory ?? null;
  if (inputs.weightKg && inputs.heightCm && inputs.heightCm > 0) {
    const m = inputs.heightCm / 100;
    const bmi = inputs.weightKg / (m * m);
    if (bmi < 18.5) bmiRaw = "underweight";
    else if (bmi < 25) bmiRaw = "normal";
    else if (bmi < 30) bmiRaw = "overweight";
    else bmiRaw = "obese";
  }
  // Normalize stored labels like "Obese Class I" / "Obese Class II+" → "obese".
  const bmiKey = (() => {
    const k = (bmiRaw || "normal").toLowerCase().trim();
    if (k.startsWith("obese")) return "obese";
    if (k.startsWith("over")) return "overweight";
    if (k.startsWith("under")) return "underweight";
    return "normal";
  })();
  const actKey = (inputs.activityLevel || "moderate").toLowerCase();
  const ageKey =
    inputs.age == null
      ? "30_45"
      : inputs.age < 30
        ? "under_30"
        : inputs.age < 45
          ? "30_45"
          : inputs.age < 60
            ? "45_60"
            : "over_60";

  const bmiMod = cfg.bmi_modifiers?.[bmiKey] ?? 1;
  const actMod = cfg.activity_modifiers?.[actKey] ?? 1;
  const ageMod = cfg.age_modifiers?.[ageKey] ?? 1;
  const raw = cfg.base_daily_steps * bmiMod * actMod * ageMod;
  const cap = cfg.max_daily_steps && cfg.max_daily_steps > 0 ? cfg.max_daily_steps : 12000;
  const capped = Math.min(raw, cap);
  return Math.round(capped / 500) * 500;
}
