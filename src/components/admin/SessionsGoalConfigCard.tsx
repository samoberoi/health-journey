import { useEffect, useState } from "react";
import { Loader2, Save, Sunrise, Sun, Moon, Timer, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export interface SessionSlot {
  label: string;
  minutes: number;
}

type FastingBucket = "12" | "14" | "16";

interface BucketPlan {
  bucket: FastingBucket;
  total: number;
  sessions: SessionSlot[];
}

interface Props {
  title: string;
  description: string;
  totalSettingKey: string;
  sessionsSettingKey: string;
  defaultTotal: number;
  defaultSessions: SessionSlot[];
}

function iconForLabel(label: string) {
  const l = label.toLowerCase();
  if (l.includes("morn") || l.includes("sunrise") || l.includes("dawn")) return Sunrise;
  if (l.includes("even") || l.includes("night") || l.includes("dusk")) return Moon;
  return Sun;
}

const FASTING_BUCKETS: { id: FastingBucket; label: string }[] = [
  { id: "12", label: "12:12" },
  { id: "14", label: "14:10" },
  { id: "16", label: "16:8" },
];

function defaultTotalFor(baseKey: string, bucket: FastingBucket, fallback: number) {
  if (baseKey.includes("yoga_stress")) {
    if (bucket === "12") return fallback;
    if (bucket === "14") return Math.max(fallback, 30);
    return Math.max(fallback, 40);
  }
  if (bucket === "12") return fallback;
  if (bucket === "14") return Math.max(fallback, 40);
  return Math.max(fallback, 60);
}

function splitSessions(total: number, template: SessionSlot[]) {
  const labels = template.length > 0 ? template.map((s) => s.label) : ["Morning", "Afternoon", "Evening"];
  const base = Math.floor(total / labels.length);
  const remainder = total - base * labels.length;
  return labels.map((label, index) => ({
    label,
    minutes: base + (index === labels.length - 1 ? remainder : 0),
  }));
}

function normalizeTotal(value: unknown): number | null {
  const n = typeof value === "number" ? value : parseInt(String(value ?? ""), 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function normalizeSessions(value: unknown): SessionSlot[] | null {
  if (!Array.isArray(value)) return null;
  const sessions = value
    .filter((x: any) => x && typeof x.label === "string")
    .map((x: any) => ({ label: String(x.label), minutes: Number(x.minutes) || 0 }))
    .filter((x) => x.label.trim().length > 0);
  return sessions.length > 0 ? sessions : null;
}

export default function SessionsGoalConfigCard({
  title,
  description,
  totalSettingKey,
  sessionsSettingKey,
  defaultTotal,
  defaultSessions,
}: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [plans, setPlans] = useState<BucketPlan[]>(() =>
    FASTING_BUCKETS.map(({ id }) => {
      const total = defaultTotalFor(totalSettingKey, id, defaultTotal);
      return { bucket: id, total, sessions: splitSessions(total, defaultSessions) };
    }),
  );

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("app_settings" as any)
        .select("key,value")
        .in("key", [
          totalSettingKey,
          sessionsSettingKey,
          ...FASTING_BUCKETS.flatMap(({ id }) => [`${totalSettingKey}_${id}`, `${sessionsSettingKey}_${id}`]),
        ]);
      const rows = (data as any[]) ?? [];
      const baseTotal = normalizeTotal(rows.find((r) => r.key === totalSettingKey)?.value) ?? defaultTotal;
      const baseSessions = normalizeSessions(rows.find((r) => r.key === sessionsSettingKey)?.value) ?? defaultSessions;
      setPlans(
        FASTING_BUCKETS.map(({ id }) => {
          const total =
            normalizeTotal(rows.find((r) => r.key === `${totalSettingKey}_${id}`)?.value) ??
            defaultTotalFor(totalSettingKey, id, baseTotal);
          const sessions =
            normalizeSessions(rows.find((r) => r.key === `${sessionsSettingKey}_${id}`)?.value) ??
            splitSessions(total, baseSessions);
          return { bucket: id, total, sessions };
        }),
      );
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalSettingKey, sessionsSettingKey]);

  const plansWithTotals = plans.map((plan) => ({
    ...plan,
    total: plan.sessions.reduce((a, s) => a + (Number(s.minutes) || 0), 0),
  }));

  const updatePlan = (bucket: FastingBucket, updater: (plan: BucketPlan) => BucketPlan) => {
    setPlans((current) => current.map((plan) => (plan.bucket === bucket ? updater(plan) : plan)));
  };

  const save = async () => {
    if (plansWithTotals.some((plan) => plan.total <= 0)) {
      toast.error("Add at least one session with minutes greater than 0");
      return;
    }
    setSaving(true);
    const basePlan = plansWithTotals[0];
    const { error } = await supabase.from("app_settings" as any).upsert(
      [
        { key: totalSettingKey, value: basePlan.total as any },
        { key: sessionsSettingKey, value: basePlan.sessions as any },
        ...plansWithTotals.flatMap((plan) => [
          { key: `${totalSettingKey}_${plan.bucket}`, value: plan.total as any },
          { key: `${sessionsSettingKey}_${plan.bucket}`, value: plan.sessions as any },
        ]),
      ] as any,
      { onConflict: "key" },
    );
    setSaving(false);
    if (error) toast.error("Save failed: " + error.message);
    else toast.success("Daily goal saved");
  };

  return (
    <div className="relative overflow-hidden rounded-3xl border border-border bg-card shadow-card">
      {/* Brand gradient rail */}
      <div
        className="absolute inset-y-0 left-0 w-1.5"
        style={{ background: "linear-gradient(180deg, hsl(var(--primary)) 0%, var(--bbdo-red) 100%)" }}
        aria-hidden
      />

      <div className="p-5 sm:p-6 pl-6 sm:pl-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-bold text-primary uppercase tracking-[0.14em]">
              <Timer className="w-3 h-3" strokeWidth={2.5} /> Daily Goal
            </div>
            <h3 className="mt-2.5 text-xl sm:text-2xl font-black text-foreground tracking-tight">{title}</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-xl leading-relaxed">{description}</p>
          </div>

          {/* Total summary + save */}
          <div className="flex items-stretch gap-3 shrink-0">
            <div className="flex items-center rounded-2xl bg-primary/[0.06] border border-primary/15 px-4 py-2.5">
              <div className="text-left">
                <div className="text-[10px] font-bold text-primary/80 uppercase tracking-wider">Fasting plans</div>
                <div className="flex items-baseline gap-1 mt-0.5">
                  <span className="text-2xl font-black text-foreground">3</span>
                  <span className="text-xs font-bold text-muted-foreground">windows</span>
                </div>
              </div>
            </div>
            <Button
              onClick={save}
              disabled={saving || loading}
              className="self-stretch bg-[var(--bbdo-red)] hover:bg-[var(--bbdo-red)]/90 text-white h-auto px-4 rounded-2xl font-bold"
            >
              {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1.5" strokeWidth={2.5} />}
              Save
            </Button>
          </div>
        </div>

        {/* Sessions */}
        {loading ? (
          <div className="h-28 flex items-center justify-center text-muted-foreground text-sm">
            <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Loading…
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-[0.14em]">
                Fasting-aware session breakdown
              </div>
              <div className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                Totals auto-calculated
              </div>
            </div>

            <div className="grid gap-4 xl:grid-cols-3">
              {plansWithTotals.map((plan) => {
                const sumSessions = plan.total;
                const bucketLabel = FASTING_BUCKETS.find((b) => b.id === plan.bucket)?.label ?? plan.bucket;
                return (
                  <div key={plan.bucket} className="rounded-2xl border border-border bg-background/60 p-3.5 space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-black text-foreground">{bucketLabel}</div>
                        <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">fasting window</div>
                      </div>
                      <div className="flex items-baseline gap-1 rounded-xl bg-primary/[0.06] border border-primary/15 px-3 py-1.5">
                        <span className="text-lg font-black text-foreground tabular-nums">{plan.total}</span>
                        <span className="text-[10px] font-bold text-muted-foreground">min total</span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      {plan.sessions.map((s, i) => {
                        const Icon = iconForLabel(s.label);
                        return (
                          <div key={`${plan.bucket}-${i}`} className="rounded-xl border border-border/70 bg-card px-3 py-2.5">
                            <div className="flex items-center gap-2">
                              <div className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-primary/10 text-primary shrink-0">
                                <Icon className="w-3.5 h-3.5" strokeWidth={2.25} />
                              </div>
                              <Input
                                value={s.label}
                                onChange={(e) =>
                                  updatePlan(plan.bucket, (p) => {
                                    const next = [...p.sessions];
                                    next[i] = { ...next[i], label: e.target.value };
                                    return { ...p, sessions: next };
                                  })
                                }
                                className="h-8 min-w-0 border-0 bg-transparent px-0 text-sm font-bold text-foreground focus-visible:ring-0 focus-visible:ring-offset-0"
                              />
                              <div className="flex items-baseline gap-1 shrink-0">
                                <Input
                                  type="number"
                                  min={0}
                                  value={s.minutes}
                                  onChange={(e) =>
                                    updatePlan(plan.bucket, (p) => {
                                      const next = [...p.sessions];
                                      next[i] = { ...next[i], minutes: parseInt(e.target.value) || 0 };
                                      return { ...p, sessions: next };
                                    })
                                  }
                                  className="h-8 w-11 border-0 bg-transparent px-0 text-lg font-black text-foreground focus-visible:ring-0 focus-visible:ring-offset-0"
                                />
                                <span className="text-[10px] font-bold text-muted-foreground">min</span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="text-[10px] font-bold px-2.5 py-1 rounded-full w-fit bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                      {sumSessions} min / day
                    </div>
                  </div>
                );
              })}
            </div>

          </div>
        )}
      </div>
    </div>
  );
}
