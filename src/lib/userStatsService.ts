import { supabase } from "@/integrations/supabase/client";

export interface UserStats {
  dayStreak: number;
  habitsDone: number;
  xpEarned: number;
  level: number;
}

const XP_PER_HABIT = 25;
const XP_PER_LEVEL = 500;

type FastingStatsRow = {
  date: string;
  compliance_status: string | null;
  fmod_actual_time: string | null;
  lmod_actual_time: string | null;
  fasting_hours_completed: number | null;
};

type SupplementStatsRow = { date: string | null };
type TimestampStatsRow = { logged_at: string | null };

function toLocalDateKey(value: string | Date): string {
  const d = value instanceof Date ? value : new Date(value);
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

function isFastingActivity(row: FastingStatsRow): boolean {
  return (
    row.compliance_status === "completed" ||
    row.compliance_status === "partial" ||
    (Boolean(row.fmod_actual_time) && Boolean(row.lmod_actual_time)) ||
    Number(row.fasting_hours_completed ?? 0) > 0
  );
}

/**
 * Computes user stats dynamically from real activity across the app.
 * - Habits Done: count of completed fasting days + supplement tracking entries
 *                + health log entries + meal photos
 * - Day Streak: consecutive days (ending today or yesterday) with ANY activity
 * - XP Earned: habitsDone * 25
 * - Level: floor(xp / 500) + 1
 */
export async function fetchUserStats(userId: string): Promise<UserStats> {
  const [fasting, supplements, healthLogs, mealPhotos] = await Promise.all([
    supabase
      .from("fasting_tracking")
      .select("date, compliance_status, fmod_actual_time, lmod_actual_time, fasting_hours_completed")
      .eq("user_id", userId),
    supabase
      .from("user_supplement_tracking")
      .select("date, taken")
      .eq("user_id", userId)
      .eq("taken", true),
    supabase
      .from("health_logs")
      .select("logged_at")
      .eq("user_id", userId),
    supabase
      .from("meal_photos")
      .select("logged_at")
      .eq("user_id", userId),
  ]);

  const fastingRows = ((fasting.data ?? []) as unknown as FastingStatsRow[]);
  const supplementRows = ((supplements.data ?? []) as unknown as SupplementStatsRow[]);
  const healthRows = ((healthLogs.data ?? []) as unknown as TimestampStatsRow[]);
  const mealRows = ((mealPhotos.data ?? []) as unknown as TimestampStatsRow[]);
  const fastingDone = fastingRows.filter(isFastingActivity);

  const habitsDone =
    fastingDone.length +
    supplementRows.length +
    healthRows.length +
    mealRows.length;

  // Build a set of activity days (YYYY-MM-DD)
  const activeDays = new Set<string>();
  fastingDone.forEach((r) => activeDays.add(r.date));
  supplementRows.forEach((r) => r.date && activeDays.add(r.date));
  healthRows.forEach((r) =>
    r.logged_at && activeDays.add(toLocalDateKey(r.logged_at))
  );
  mealRows.forEach((r) =>
    r.logged_at && activeDays.add(toLocalDateKey(r.logged_at))
  );

  // Walk back from today
  let streak = 0;
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
  // Allow streak to start from yesterday if nothing today yet
  if (!activeDays.has(toLocalDateKey(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
  }
  while (activeDays.has(toLocalDateKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  const xpEarned = habitsDone * XP_PER_HABIT;
  const level = Math.floor(xpEarned / XP_PER_LEVEL) + 1;

  return { dayStreak: streak, habitsDone, xpEarned, level };
}
