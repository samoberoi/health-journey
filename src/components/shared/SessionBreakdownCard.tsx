import { useEffect, useMemo, useState } from "react";
import { Sunrise, Sun, Moon, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { getUserFastingBucket, type FastingBucket } from "@/lib/fastingService";

interface Slot {
  label: string;
  minutes: number;
}

interface Plan {
  bucket: FastingBucket;
  total: number;
  slots: Slot[];
}

interface Props {
  /** Base app_settings key for total minutes, e.g. "exercise_daily_minutes". */
  totalKey: string;
  /** Base app_settings key for the session slots array. */
  sessionsKey: string;
  moduleLabel: string;
  accent?: string;
  progressMinutes?: number;
}

function iconFor(label: string) {
  const l = label.toLowerCase();
  if (l.includes("morn") || l.includes("dawn") || l.includes("sunrise")) return Sunrise;
  if (l.includes("even") || l.includes("night") || l.includes("dusk")) return Moon;
  return Sun;
}

const PATTERN_LABEL: Record<FastingBucket, string> = {
  "12": "12:12",
  "14": "14:10",
  "16": "16:8",
};

const BUCKETS: FastingBucket[] = ["12", "14", "16"];

function fallbackTotal(totalKey: string, bucket: FastingBucket): number {
  if (totalKey.includes("yoga_stress")) {
    if (bucket === "12") return 20;
    if (bucket === "14") return 30;
    return 40;
  }
  if (bucket === "12") return 30;
  if (bucket === "14") return 40;
  return 60;
}

function splitSlots(total: number, labels: string[]): Slot[] {
  const base = Math.floor(total / labels.length);
  const remainder = total - base * labels.length;
  return labels.map((label, index) => ({
    label,
    minutes: base + (index === labels.length - 1 ? remainder : 0),
  }));
}

function fallbackSlots(totalKey: string, total: number): Slot[] {
  if (totalKey.includes("yoga_stress")) return splitSlots(total, ["Morning", "Evening"]);
  return splitSlots(total, ["Morning", "Afternoon", "Evening"]);
}

function normalizeSlots(value: unknown): Slot[] | null {
  if (!Array.isArray(value)) return null;
  const slots = value
    .filter((x: any) => x && typeof x.label === "string")
    .map((x: any) => ({ label: String(x.label), minutes: Number(x.minutes) || 0 }))
    .filter((x) => x.minutes > 0);
  return slots.length > 0 ? slots : null;
}

function normalizeTotal(value: unknown): number | null {
  const n = typeof value === "number" ? value : parseInt(String(value ?? ""), 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Reads the admin-configured ideal session breakdown from app_settings, keyed
 * to the user's current fasting bucket (12/14/16). Falls back to the base key
 * when a bucket-specific override isn't set, so admins can tune per-protocol.
 */
export default function SessionBreakdownCard({
  totalKey,
  sessionsKey,
  moduleLabel,
  accent = "var(--bbdo-blue)",
  progressMinutes,
}: Props) {
  const { user } = useAuth();
  const [bucket, setBucket] = useState<FastingBucket | null>(null);
  const initialPlans = useMemo<Plan[]>(
    () =>
      BUCKETS.map((b) => {
        const total = fallbackTotal(totalKey, b);
        return { bucket: b, total, slots: fallbackSlots(totalKey, total) };
      }),
    [totalKey],
  );
  const [plans, setPlans] = useState<Plan[]>(initialPlans);

  useEffect(() => {
    setPlans(initialPlans);
  }, [initialPlans]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const b = user ? await getUserFastingBucket(user.id) : null;
      if (cancelled) return;
      setBucket(b);

      const keys = [
        totalKey,
        sessionsKey,
        ...BUCKETS.flatMap((planBucket) => [`${totalKey}_${planBucket}`, `${sessionsKey}_${planBucket}`]),
      ];

      const { data, error } = await supabase
        .from("app_settings" as any)
        .select("key,value")
        .in("key", keys);
      if (cancelled) return;
      if (error) {
        setPlans(initialPlans);
        return;
      }
      const rows = (data as any[]) ?? [];
      const baseTotal = normalizeTotal(rows.find((r) => r.key === totalKey)?.value);
      const baseSlots = normalizeSlots(rows.find((r) => r.key === sessionsKey)?.value);

      setPlans(
        BUCKETS.map((planBucket) => {
          const total =
            normalizeTotal(rows.find((r) => r.key === `${totalKey}_${planBucket}`)?.value) ??
            baseTotal ??
            fallbackTotal(totalKey, planBucket);
          const slots =
            normalizeSlots(rows.find((r) => r.key === `${sessionsKey}_${planBucket}`)?.value) ??
            baseSlots ??
            fallbackSlots(totalKey, total);
          return { bucket: planBucket, total, slots };
        }),
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [totalKey, sessionsKey, user, initialPlans]);

  return (
    <div className="rounded-2xl border border-border bg-card p-4 md:p-5 shadow-card">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <span
            className="w-8 h-8 rounded-xl flex items-center justify-center"
            style={{ background: `${accent}18`, color: accent }}
          >
            <Clock className="w-4 h-4" strokeWidth={2} />
          </span>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
              Ideal {moduleLabel} plan
              {bucket && (
                <span
                  className="ml-2 px-1.5 py-0.5 rounded-md text-[9px] font-black"
                  style={{ background: `${accent}18`, color: accent }}
                >
                  {PATTERN_LABEL[bucket]}
                </span>
              )}
            </p>
            <p className="text-sm font-black text-foreground leading-tight">
              Fasting-window goals · morning to evening
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 keep-mobile-cols gap-3 md:grid-cols-3">
        {plans.filter((p) => !bucket || p.bucket === bucket).map((plan) => {
          const active = bucket === plan.bucket;
          const watched = Math.max(0, progressMinutes ?? 0);
          const pending = Math.max(0, plan.total - watched);
          const progressPct = Math.min(100, Math.round((watched / Math.max(1, plan.total)) * 100));
          const goalMet = watched >= plan.total;
          const watchedLabel = Math.min(watched, plan.total).toLocaleString("en-IN", { maximumFractionDigits: 1 });
          const pendingLabel = pending.toLocaleString("en-IN", { maximumFractionDigits: 1 });
          return (
            <div
              key={plan.bucket}
              className="rounded-xl border px-3 py-3"
              style={{
                background: `${accent}${active ? "14" : "0d"}`,
                borderColor: active ? accent : "hsl(var(--border) / 0.6)",
              }}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-black text-foreground">{PATTERN_LABEL[plan.bucket]}</span>
                <span
                  className="rounded-md px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider"
                  style={{ background: `${accent}18`, color: accent }}
                >
                  {plan.total} min
                </span>
              </div>

              <div className="mt-3 grid gap-2">
                {plan.slots.map((slot, index) => {
                  const Icon = iconFor(slot.label);
                  return (
                    <div key={`${plan.bucket}-${slot.label}-${index}`} className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <Icon className="w-3.5 h-3.5 shrink-0" strokeWidth={1.8} style={{ color: accent }} />
                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground truncate">
                          {slot.label}
                        </span>
                      </div>
                      <span className="text-sm font-black text-foreground tabular-nums shrink-0">
                        {slot.minutes}
                        <span className="text-[9px] font-bold text-muted-foreground ml-0.5">min</span>
                      </span>
                    </div>
                  );
                })}
              </div>

              {typeof progressMinutes === "number" && (
                <div className="mt-3 rounded-lg bg-background/60 px-2.5 py-2">
                  <div className="flex items-center justify-between gap-2 text-[10px] font-bold">
                    <span className="text-muted-foreground">Watched {watchedLabel} min</span>
                    <span style={{ color: goalMet ? "var(--bbdo-mint)" : accent }}>
                      {goalMet ? "Complete" : `${pendingLabel} min pending`}
                    </span>
                  </div>
                  <div className="mt-1.5 h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full transition-[width] duration-300 ease-bbdo"
                      style={{ width: `${progressPct}%`, background: goalMet ? "var(--bbdo-mint)" : accent }}
                    />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>


      <p className="mt-3 text-[11px] text-muted-foreground leading-snug">
        {bucket
          ? `Tailored to your ${PATTERN_LABEL[bucket]} fasting window. If you finish it all in one sitting, we'll still nudge movement later.`
          : "Once your fasting window is selected, your matching plan appears here automatically."}
      </p>
    </div>
  );
}
