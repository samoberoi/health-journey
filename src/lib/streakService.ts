import { supabase } from "@/integrations/supabase/client";

export interface FastingBadge {
  id: string;
  badge_key: string;
  badge_name: string;
  badge_emoji: string;
  description: string | null;
  level: number;
  required_streak_days: number;
  week_range_start: number | null;
  week_range_end: number | null;
  protocol_id: string | null;
  parent_badge_id: string | null;
  badge_type: "master" | "stage";
  pattern: string | null;
  milestones_required: number;
  stage_order: number;
}

export interface UserFastingBadge {
  id: string;
  user_id: string;
  badge_id: string;
  earned_at: string;
  current_streak: number;
  longest_streak: number;
  badge?: FastingBadge;
}

export interface FastingStageMilestone {
  id: string;
  badge_id: string;
  milestone_order: number;
  name: string;
  description: string | null;
  compliant_days_required: number;
}

export interface UserFastingMilestone {
  id: string;
  user_id: string;
  badge_id: string;
  milestone_id: string | null;
  week_number: number | null;
  completed_at: string;
}

export async function fetchStageMilestones(badgeId?: string): Promise<FastingStageMilestone[]> {
  let q = supabase.from("fasting_stage_milestones" as any).select("*").order("milestone_order");
  if (badgeId) q = q.eq("badge_id", badgeId);
  const { data, error } = await q;
  if (error) throw error;
  return (data as any) ?? [];
}

export async function upsertStageMilestone(m: Partial<FastingStageMilestone> & { badge_id: string }): Promise<void> {
  if (m.id) {
    const { error } = await supabase.from("fasting_stage_milestones" as any).update(m as any).eq("id", m.id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from("fasting_stage_milestones" as any).insert(m as any);
    if (error) throw error;
  }
}

export async function deleteStageMilestone(id: string): Promise<void> {
  const { error } = await supabase.from("fasting_stage_milestones" as any).delete().eq("id", id);
  if (error) throw error;
}

export async function fetchUserMilestones(userId: string): Promise<UserFastingMilestone[]> {
  const { data, error } = await supabase
    .from("user_fasting_milestones" as any)
    .select("*")
    .eq("user_id", userId);
  if (error) throw error;
  return (data as any) ?? [];
}


export async function fetchBadgeDefinitions(): Promise<FastingBadge[]> {
  const { data, error } = await supabase
    .from("fasting_badges" as any)
    .select("*")
    .order("level");
  if (error) throw error;
  return (data as any) ?? [];
}

export async function updateBadgeDefinition(
  badgeId: string,
  updates: Partial<Pick<FastingBadge, "badge_name" | "badge_emoji" | "description" | "required_streak_days">>
): Promise<void> {
  const { error } = await supabase
    .from("fasting_badges" as any)
    .update(updates as any)
    .eq("id", badgeId);
  if (error) throw error;
}

export async function fetchUserBadges(userId: string): Promise<UserFastingBadge[]> {
  const { data, error } = await supabase
    .from("user_fasting_badges" as any)
    .select("*")
    .eq("user_id", userId)
    .order("earned_at", { ascending: false });
  if (error) throw error;
  return (data as any) ?? [];
}

/** Calculate current streak from tracking data */
export function calculateStreak(
  trackingData: { date: string; compliance_status: string; fmod_actual_time?: string | null; lmod_actual_time?: string | null; fasting_hours_completed?: number | null }[]
): { currentStreak: number; longestStreak: number } {
  if (!trackingData.length) return { currentStreak: 0, longestStreak: 0 };

  const isCompliant = (entry?: { compliance_status: string; fmod_actual_time?: string | null; lmod_actual_time?: string | null; fasting_hours_completed?: number | null }) => {
    if (!entry) return false;
    return entry.compliance_status === "completed" || entry.compliance_status === "partial" ||
      (!!entry.fmod_actual_time && !!entry.lmod_actual_time) || Number(entry.fasting_hours_completed ?? 0) > 0;
  };

  // Build a date→status map for fast lookup
  const statusMap = new Map<string, (typeof trackingData)[number]>();
  for (const entry of trackingData) {
    statusMap.set(entry.date, entry);
  }

  const toDateStr = (d: Date) => {
    const local = new Date(d.getTime() - d.getTimezoneOffset() * 60_000);
    return local.toISOString().split("T")[0];
  };

  // Current streak: walk backwards from the most recent compliant day
  // Start from today; if today has no entry or is pending, start from yesterday
  let currentStreak = 0;
  const now = new Date();
  let startOffset = 0;
  const todayStr = toDateStr(now);
  const todayStatus = statusMap.get(todayStr);

  // If today has a compliant entry, include it; if pending/missing, start from yesterday
  if (isCompliant(todayStatus)) {
    startOffset = 0;
  } else {
    startOffset = 1;
  }

  for (let i = startOffset; ; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const ds = toDateStr(d);
    const status = statusMap.get(ds);
    if (!isCompliant(status)) break;
    currentStreak++;
  }

  // Longest streak: walk chronologically
  const sorted = [...trackingData].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  let longestStreak = 0;
  let tempStreak = 0;

  for (let i = 0; i < sorted.length; i++) {
    const entry = sorted[i];
    if (isCompliant(entry)) {
      if (i > 0) {
        const prev = new Date(sorted[i - 1].date);
        const curr = new Date(entry.date);
        const diffDays = Math.round((curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24));
        // If previous was also compliant and consecutive, continue streak
        if (diffDays === 1 && isCompliant(sorted[i - 1])) {
          tempStreak++;
        } else {
          tempStreak = 1;
        }
      } else {
        tempStreak = 1;
      }
    } else {
      tempStreak = 0;
    }
    longestStreak = Math.max(longestStreak, tempStreak);
  }

  return { currentStreak, longestStreak };
}

/** Check and award badges. Now delegates to the DB function `award_fasting_badges`
 *  which awards milestones + stage + master badges based on the configured
 *  fasting_stage_milestones table and the user's active protocol tracking.
 *  Returns any newly-awarded badges (by diffing user_fasting_badges before/after). */
export async function checkAndAwardBadges(
  userId: string,
  _currentStreak?: number,
  _longestStreak?: number,
): Promise<FastingBadge[]> {
  const before = await fetchUserBadges(userId);
  const beforeIds = new Set(before.map((b) => b.badge_id));

  const { error } = await supabase.rpc("award_fasting_badges" as any, { _user_id: userId });
  if (error) {
    console.error("award_fasting_badges failed", error);
    return [];
  }

  const [after, defs] = await Promise.all([fetchUserBadges(userId), fetchBadgeDefinitions()]);
  const defMap = new Map(defs.map((d) => [d.id, d]));
  return after
    .filter((b) => !beforeIds.has(b.badge_id))
    .map((b) => defMap.get(b.badge_id))
    .filter((b): b is FastingBadge => !!b);
}

export function getBadgeLevel(badges: UserFastingBadge[], allBadges: FastingBadge[]): {
  currentLevel: number;
  currentBadge: FastingBadge | null;
  nextBadge: FastingBadge | null;
  progress: number;
} {
  if (!badges.length || !allBadges.length) {
    return {
      currentLevel: 0,
      currentBadge: null,
      nextBadge: allBadges[0] ?? null,
      progress: 0,
    };
  }

  const earnedIds = new Set(badges.map((b) => b.badge_id));
  const sortedDefs = [...allBadges].sort((a, b) => a.level - b.level);
  let highestEarned: FastingBadge | null = null;

  for (const def of sortedDefs) {
    if (earnedIds.has(def.id)) highestEarned = def;
  }

  const nextIdx = highestEarned
    ? sortedDefs.findIndex((d) => d.id === highestEarned!.id) + 1
    : 0;
  const nextBadge = nextIdx < sortedDefs.length ? sortedDefs[nextIdx] : null;

  const longestStreak = badges[0]?.longest_streak ?? 0;
  const progress = nextBadge
    ? Math.min(100, Math.round((longestStreak / nextBadge.required_streak_days) * 100))
    : 100;

  return {
    currentLevel: highestEarned?.level ?? 0,
    currentBadge: highestEarned,
    nextBadge,
    progress,
  };
}
