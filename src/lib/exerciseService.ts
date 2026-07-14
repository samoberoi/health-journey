import { supabase } from "@/integrations/supabase/client";

export type ExerciseTier = 1 | 2 | 3;
export type ExercisePlanKey = "foundation" | "active" | "intensive";

export interface ExerciseCategory {
  id: string;
  slug: string;
  name: string;
  icon: string | null;
  sort_order: number;
}

export interface Exercise {
  id: string;
  name: string;
  category_id: string;
  tier: ExerciseTier;
  plan_key: ExercisePlanKey;
  reps_duration: string;
  sets: string;
  youtube_url: string;
  image_url: string | null;
  icon: string | null;
  instructions: string | null;
  benefits: string | null;
  cautions: string | null;
  knee_pain_substitute: string | null;
  sort_order: number;
  enabled: boolean;
}

export interface ExerciseBadge {
  id: string;
  key: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  tier_required: ExerciseTier;
  criteria_json: any;
  sort_order: number;
  enabled: boolean;
}

export interface ExerciseInput {
  name: string;
  category_id: string;
  tier: ExerciseTier;
  plan_key: ExercisePlanKey;
  reps_duration: string;
  sets: string;
  youtube_url: string;
  image_url?: string | null;
  icon?: string | null;
  instructions?: string | null;
  benefits?: string | null;
  cautions?: string | null;
  knee_pain_substitute?: string | null;
  sort_order?: number;
  enabled?: boolean;
}

export const PLAN_LABEL: Record<ExercisePlanKey, string> = {
  foundation: "Foundation Care",
  active: "Active Health Tracker",
  intensive: "Intensive Reversal Care",
};

export const TIER_FOR_PLAN: Record<ExercisePlanKey, ExerciseTier> = {
  foundation: 1,
  active: 2,
  intensive: 3,
};

export const PLAN_FOR_TIER: Record<ExerciseTier, ExercisePlanKey> = {
  1: "foundation",
  2: "active",
  3: "intensive",
};

export const TIER_COLOR: Record<ExerciseTier, string> = {
  1: "#10B981", // mint
  2: "#248CCB", // blue
  3: "#E00101", // red
};

export function tierForPackageKey(pkg: string | null | undefined): ExerciseTier {
  if (pkg === "intensive") return 3;
  if (pkg === "active") return 2;
  return 1;
}

export async function listCategories(): Promise<ExerciseCategory[]> {
  const { data, error } = await supabase
    .from("exercise_categories")
    .select("*")
    .order("sort_order");
  if (error) throw error;
  return (data ?? []) as ExerciseCategory[];
}

export async function listExercises(): Promise<Exercise[]> {
  const { data, error } = await supabase
    .from("exercises")
    .select("*")
    .order("tier")
    .order("sort_order");
  if (error) throw error;
  return (data ?? []) as Exercise[];
}

export async function createExercise(input: ExerciseInput): Promise<Exercise> {
  const { data, error } = await supabase
    .from("exercises")
    .insert(input)
    .select("*")
    .single();
  if (error) throw error;
  return data as Exercise;
}

export async function updateExercise(id: string, patch: Partial<ExerciseInput>): Promise<Exercise> {
  const { data, error } = await supabase
    .from("exercises")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data as Exercise;
}

export async function deleteExercise(id: string): Promise<void> {
  const { error } = await supabase.from("exercises").delete().eq("id", id);
  if (error) throw error;
}

export async function toggleExerciseEnabled(id: string, enabled: boolean): Promise<void> {
  const { error } = await supabase.from("exercises").update({ enabled }).eq("id", id);
  if (error) throw error;
}

export async function listBadges(): Promise<ExerciseBadge[]> {
  const { data, error } = await supabase
    .from("exercise_badges")
    .select("*")
    .order("sort_order");
  if (error) throw error;
  return (data ?? []) as ExerciseBadge[];
}

export async function updateBadge(
  id: string,
  patch: Partial<Pick<ExerciseBadge, "name" | "description" | "icon" | "color" | "tier_required" | "criteria_json" | "enabled">>,
): Promise<void> {
  const { error } = await supabase.from("exercise_badges").update(patch).eq("id", id);
  if (error) throw error;
}

/** Utility — extract a YouTube ID from any URL/ID input. */
export function extractYoutubeId(input: string): string {
  const s = (input || "").trim();
  if (!s) return "";
  const patterns = [
    /[?&]v=([a-zA-Z0-9_-]{11})/,
    /youtu\.be\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
  ];
  for (const p of patterns) {
    const m = s.match(p);
    if (m) return m[1];
  }
  if (/^[a-zA-Z0-9_-]{11}$/.test(s)) return s;
  return "";
}

export function normalizeYoutubeUrl(input: string): string {
  const id = extractYoutubeId(input);
  if (id) return `https://www.youtube.com/watch?v=${id}`;
  return input.trim();
}

export const DAILY_EXERCISE_GOAL = 5;

export type ExerciseProgressLog = {
  exercise_id: string;
  logged_at?: string | null;
  sets_done?: number | null;
};

export type ExerciseProgressSummary = {
  completedExercises: number;
  targetExercises: number;
  loggedSets: number;
  requiredSetsForGoal: number;
  remainingExercises: number;
  goalMet: boolean;
  completedExerciseIds: Set<string>;
};

// Shared: one "completed exercise" = target sets finished for that exercise.
// Example: "2–3" means 3 required sets, so five exercises like that = 15 set logs.
export function parseTargetSets(s: string | null | undefined, fallback = 3): number {
  const nums = (s || "").match(/\d+/g);
  if (!nums || nums.length === 0) return fallback;
  return Math.max(...nums.map((n) => parseInt(n, 10)));
}

export function summarizeExerciseProgress(
  exercises: Pick<Exercise, "id" | "sets" | "sort_order" | "tier">[],
  logs: ExerciseProgressLog[],
  targetExercises = DAILY_EXERCISE_GOAL,
): ExerciseProgressSummary {
  const exerciseTargets = new Map<string, number>();
  const orderedTargets = [...exercises]
    .sort((a, b) => ((a.tier ?? 1) - (b.tier ?? 1)) || ((a.sort_order ?? 0) - (b.sort_order ?? 0)))
    .map((e) => {
      const target = parseTargetSets(e.sets);
      exerciseTargets.set(e.id, target);
      return target;
    });

  const counts = new Map<string, number>();
  for (const row of logs) {
    if (!row.exercise_id) continue;
    const setsDone = Math.max(1, Number(row.sets_done) || 1);
    counts.set(row.exercise_id, (counts.get(row.exercise_id) ?? 0) + setsDone);
  }

  const completedExerciseIds = new Set<string>();
  let loggedSets = 0;
  counts.forEach((count, exerciseId) => {
    const target = exerciseTargets.get(exerciseId);
    if (!target) return;
    loggedSets += Math.min(count, target);
    if (count >= target) completedExerciseIds.add(exerciseId);
  });

  const completedExercises = completedExerciseIds.size;
  const requiredSetsForGoal = orderedTargets
    .slice(0, targetExercises)
    .reduce((sum, target) => sum + target, 0);

  return {
    completedExercises,
    targetExercises,
    loggedSets,
    requiredSetsForGoal,
    remainingExercises: Math.max(0, targetExercises - completedExercises),
    goalMet: completedExercises >= targetExercises,
    completedExerciseIds,
  };
}

export function getCompletedExerciseIdsFromLogs(
  exercises: Pick<Exercise, "id" | "sets" | "sort_order" | "tier">[],
  logs: ExerciseProgressLog[],
): Set<string> {
  const targetByExercise = new Map(exercises.map((e) => [e.id, parseTargetSets(e.sets)]));
  const countsByExerciseDay = new Map<string, number>();

  for (const row of logs) {
    if (!row.exercise_id) continue;
    const day = row.logged_at ? new Date(row.logged_at).toISOString().slice(0, 10) : "all-time";
    const key = `${row.exercise_id}:${day}`;
    const setsDone = Math.max(1, Number(row.sets_done) || 1);
    countsByExerciseDay.set(key, (countsByExerciseDay.get(key) ?? 0) + setsDone);
  }

  const completed = new Set<string>();
  countsByExerciseDay.forEach((count, key) => {
    const exerciseId = key.split(":")[0];
    const target = targetByExercise.get(exerciseId);
    if (target && count >= target) completed.add(exerciseId);
  });
  return completed;
}

export async function countCompletedExercisesToday(userId: string, packageKey?: string | null): Promise<number> {
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const maxTier = tierForPackageKey(packageKey);
  const [{ data: logs }, { data: exs }] = await Promise.all([
    (supabase as any)
      .from("user_exercise_logs")
      .select("exercise_id, sets_done")
      .eq("user_id", userId)
      .gte("logged_at", start.toISOString()),
    (supabase as any).from("exercises").select("id, sets, sort_order, tier").eq("enabled", true).lte("tier", maxTier),
  ]);
  return summarizeExerciseProgress((exs as any[]) ?? [], (logs as any[]) ?? []).completedExercises;
}
