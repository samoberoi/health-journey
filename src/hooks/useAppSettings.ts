import { useEffect, useState } from "react";
import { getDailyExerciseGoal, getDailyYogaMinutes } from "@/lib/appSettingsService";
import { getUserFastingBucket, type FastingBucket } from "@/lib/fastingService";
import { useAuth } from "@/contexts/AuthContext";

function useFastingBucket(): FastingBucket | null {
  const { user } = useAuth();
  const [b, setB] = useState<FastingBucket | null>(null);
  useEffect(() => {
    if (!user) { setB(null); return; }
    let cancelled = false;
    getUserFastingBucket(user.id).then((v) => { if (!cancelled) setB(v); });
    return () => { cancelled = true; };
  }, [user]);
  return b;
}

export function useDailyExerciseGoal(fallback = 30): number {
  const bucket = useFastingBucket();
  const [n, setN] = useState<number>(fallback);
  useEffect(() => { getDailyExerciseGoal(bucket).then(setN).catch(() => {}); }, [bucket]);
  return n;
}

export function useDailyYogaMinutes(fallback = 20): number {
  const bucket = useFastingBucket();
  const [n, setN] = useState<number>(fallback);
  useEffect(() => { getDailyYogaMinutes(bucket).then(setN).catch(() => {}); }, [bucket]);
  return n;
}
