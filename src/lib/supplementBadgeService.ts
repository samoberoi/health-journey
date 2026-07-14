import { supabase } from "@/integrations/supabase/client";
import { logAudit } from "@/lib/auditLog";

export interface SupplementBadge {
  id: string;
  badge_key: string;
  badge_name: string;
  badge_emoji: string;
  description: string | null;
  level: number;
  required_streak_days: number;
  created_at: string;
}

export interface UserSupplementBadge {
  id: string;
  user_id: string;
  badge_id: string;
  current_streak: number;
  longest_streak: number;
  earned_at: string;
  badge?: SupplementBadge;
}

export async function fetchSupplementBadgeDefinitions(): Promise<SupplementBadge[]> {
  const { data, error } = await supabase
    .from("supplement_badges" as any)
    .select("*")
    .order("level");
  if (error) throw error;
  return (data as any) ?? [];
}

export async function updateSupplementBadgeDefinition(
  id: string,
  updates: Partial<Pick<SupplementBadge, "badge_name" | "badge_emoji" | "description" | "required_streak_days">>
): Promise<void> {
  const { error } = await supabase
    .from("supplement_badges" as any)
    .update(updates as any)
    .eq("id", id);
  if (error) throw error;
  logAudit({ module: "Supplements", action: "update", target_type: "badge", target_id: id, target_label: updates.badge_name ?? undefined, metadata: updates as any });
}

export async function fetchUserSupplementBadges(userId: string): Promise<UserSupplementBadge[]> {
  const { data, error } = await supabase
    .from("user_supplement_badges" as any)
    .select("*")
    .eq("user_id", userId)
    .order("earned_at", { ascending: false });
  if (error) throw error;
  return (data as any) ?? [];
}

/**
 * Calculate supplement streak from tracking data.
 * A day counts as "compliant" if ALL active plan items were taken that day.
 */
export function calculateSupplementStreak(
  trackingData: { date: string; plan_item_id: string; taken: boolean }[],
  totalActiveItems: number
): { currentStreak: number; longestStreak: number } {
  if (!trackingData.length || totalActiveItems === 0) return { currentStreak: 0, longestStreak: 0 };

  // Group by date → count taken
  const dateMap = new Map<string, number>();
  for (const entry of trackingData) {
    if (entry.taken) {
      dateMap.set(entry.date, (dateMap.get(entry.date) ?? 0) + 1);
    }
  }

  const isCompliantDay = (dateStr: string) => (dateMap.get(dateStr) ?? 0) >= totalActiveItems;
  const toDateStr = (d: Date) => d.toISOString().split("T")[0];

  // Current streak: walk back from today
  let currentStreak = 0;
  const now = new Date();
  const todayStr = toDateStr(now);
  let startOffset = isCompliantDay(todayStr) ? 0 : 1;

  for (let i = startOffset; ; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    if (!isCompliantDay(toDateStr(d))) break;
    currentStreak++;
  }

  // Longest streak: walk chronologically through all unique dates
  const allDates = [...new Set(trackingData.map(t => t.date))].sort();
  let longestStreak = 0;
  let tempStreak = 0;

  for (let i = 0; i < allDates.length; i++) {
    if (isCompliantDay(allDates[i])) {
      if (i > 0) {
        const prev = new Date(allDates[i - 1]);
        const curr = new Date(allDates[i]);
        const diffDays = Math.round((curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24));
        tempStreak = (diffDays === 1 && isCompliantDay(allDates[i - 1])) ? tempStreak + 1 : 1;
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

/** Check and award supplement badges based on streak */
export async function checkAndAwardSupplementBadges(
  userId: string,
  currentStreak: number,
  longestStreak: number
): Promise<SupplementBadge[]> {
  const badges = await fetchSupplementBadgeDefinitions();
  const earned = await fetchUserSupplementBadges(userId);
  const earnedIds = new Set(earned.map(e => e.badge_id));
  const newBadges: SupplementBadge[] = [];

  for (const badge of badges) {
    if (earnedIds.has(badge.id)) continue;
    if (longestStreak >= badge.required_streak_days) {
      const { error } = await supabase
        .from("user_supplement_badges" as any)
        .insert({
          user_id: userId,
          badge_id: badge.id,
          current_streak: currentStreak,
          longest_streak: longestStreak,
        } as any);
      if (!error) newBadges.push(badge);
    }
  }

  // Update streak on latest badge
  if (earned.length > 0) {
    await supabase
      .from("user_supplement_badges" as any)
      .update({ current_streak: currentStreak, longest_streak: longestStreak } as any)
      .eq("user_id", userId)
      .eq("id", earned[0].id);
  }

  return newBadges;
}

export function getSupplementBadgeLevel(badges: UserSupplementBadge[], allBadges: SupplementBadge[]) {
  if (!badges.length || !allBadges.length) {
    return { currentLevel: 0, currentBadge: null, nextBadge: allBadges[0] ?? null, progress: 0 };
  }

  const earnedIds = new Set(badges.map(b => b.badge_id));
  const sortedDefs = [...allBadges].sort((a, b) => a.level - b.level);
  let highestEarned: SupplementBadge | null = null;

  for (const def of sortedDefs) {
    if (earnedIds.has(def.id)) highestEarned = def;
  }

  const nextIdx = highestEarned
    ? sortedDefs.findIndex(d => d.id === highestEarned!.id) + 1
    : 0;
  const nextBadge = nextIdx < sortedDefs.length ? sortedDefs[nextIdx] : null;

  const longestStreak = badges[0]?.longest_streak ?? 0;
  const progress = nextBadge
    ? Math.min(100, Math.round((longestStreak / nextBadge.required_streak_days) * 100))
    : 100;

  return { currentLevel: highestEarned?.level ?? 0, currentBadge: highestEarned, nextBadge, progress };
}
