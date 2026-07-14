import { supabase } from "@/integrations/supabase/client";
import type { FastingBucket } from "@/lib/fastingService";

/** Small in-memory cache keyed by setting key. Values live for the session. */
const cache = new Map<string, number>();

async function readInt(key: string, fallback: number, rpcName: string): Promise<number> {
  if (cache.has(key)) return cache.get(key)!;
  try {
    const { data, error } = await (supabase as any).rpc(rpcName);
    if (error) throw error;
    const n = Number(data);
    const val = Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
    cache.set(key, val);
    return val;
  } catch {
    return fallback;
  }
}

/** Read a numeric app_settings value directly, no RPC. Returns null on miss. */
async function readSettingInt(key: string): Promise<number | null> {
  const cacheKey = `direct:${key}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey)!;
  try {
    const { data } = await (supabase as any)
      .from("app_settings")
      .select("value")
      .eq("key", key)
      .maybeSingle();
    const raw = data?.value;
    const n = typeof raw === "number" ? raw : parseInt(String(raw ?? ""), 10);
    if (Number.isFinite(n) && n > 0) {
      cache.set(cacheKey, n);
      return n;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Bucket-aware total minutes for a module (exercise / yoga). Prefers the
 * protocol-specific override (e.g. `exercise_daily_minutes_14`), then the base
 * key, then the RPC-backed default.
 */
async function readBucketedMinutes(
  baseKey: string,
  bucket: FastingBucket | null,
  fallback: number,
  rpcName: string,
): Promise<number> {
  if (bucket) {
    const v = await readSettingInt(`${baseKey}_${bucket}`);
    if (v) return v;
  }
  return readInt(baseKey, fallback, rpcName);
}

export function getDailyExerciseGoal(bucket: FastingBucket | null = null): Promise<number> {
  return readBucketedMinutes("exercise_daily_minutes", bucket, 30, "get_daily_exercise_goal");
}

export function getDailyYogaMinutes(bucket: FastingBucket | null = null): Promise<number> {
  return readBucketedMinutes("yoga_stress_daily_minutes", bucket, 20, "get_daily_yoga_minutes");
}
