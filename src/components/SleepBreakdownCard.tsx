import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Moon, ChevronRight, Bed, Sunrise } from "lucide-react";
import { canUseNativeHealth, fetchHealthSnapshot, type HealthSnapshot } from "@/lib/healthProvider";
import { useAuth } from "@/contexts/AuthContext";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

type Stage = {
  key: keyof HealthSnapshot;
  label: string;
  hint: string;
  color: string;
};

const STAGES: Stage[] = [
  { key: "sleepAwakeMin", label: "Awake", hint: "Brief wake-ups during the night", color: "var(--bbdo-red)" },
  { key: "sleepRemMin",   label: "REM",   hint: "Dream & memory consolidation",    color: "var(--bbdo-amber)" },
  { key: "sleepCoreMin",  label: "Core",  hint: "Light sleep · most of the night",  color: "hsl(var(--info))" },
  { key: "sleepDeepMin",  label: "Deep",  hint: "Physical recovery & repair",       color: "hsl(var(--primary))" },
];

function fmt(min?: number) {
  if (min == null || min <= 0) return "—";
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function fmtTime(iso?: string) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  } catch {
    return "—";
  }
}

function fmtDateLabel(iso?: string) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  } catch {
    return "";
  }
}

export default function SleepBreakdownCard() {
  const { user } = useAuth();
  const [snap, setSnap] = useState<HealthSnapshot | null>(null);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    if (!user || !canUseNativeHealth()) return;
    try {
      const live = await fetchHealthSnapshot();
      if (live) setSnap(live);
    } catch {
      /* silent */
    }
  }, [user]);

  useEffect(() => { void load(); }, [load]);

  const totals = useMemo(() => {
    const awake = snap?.sleepAwakeMin ?? 0;
    const rem = snap?.sleepRemMin ?? 0;
    const core = snap?.sleepCoreMin ?? 0;
    const deep = snap?.sleepDeepMin ?? 0;
    const unspec = snap?.sleepUnspecifiedMin ?? 0;
    const asleep = rem + core + deep + unspec;
    return { awake, rem, core, deep, unspec, asleep, total: asleep + awake };
  }, [snap]);

  if (!user || !canUseNativeHealth()) return null;
  if (totals.total <= 0) return null;

  const pct = (v: number) => (totals.total > 0 ? (v / totals.total) * 100 : 0);
  const asleepPct = (v: number) => (totals.asleep > 0 ? (v / totals.asleep) * 100 : 0);
  const bedtime = fmtTime(snap?.sleepStart);
  const wakeTime = fmtTime(snap?.sleepEnd);
  const nightLabel = fmtDateLabel(snap?.sleepStart);

  return (
    <>
      <motion.button
        type="button"
        onClick={() => setOpen(true)}
        className="liquid-glass w-full rounded-3xl p-4 text-left"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22 }}
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-bold tracking-[0.18em] uppercase text-muted-foreground">
              Last night's sleep{nightLabel ? ` · ${nightLabel}` : ""}
            </p>
            <p className="text-base font-black text-foreground flex items-center gap-1.5">
              <Moon className="h-4 w-4 text-primary" />
              {fmt(totals.asleep)} asleep
            </p>
            {(snap?.sleepStart || snap?.sleepEnd) && (
              <p className="mt-0.5 text-[11px] font-medium text-muted-foreground truncate">
                {bedtime} → {wakeTime}
              </p>
            )}
          </div>
          <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground shrink-0">
            Details <ChevronRight className="h-3.5 w-3.5" />
          </div>
        </div>

        {/* Stacked bar */}
        <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-muted">
          {STAGES.map((s) => {
            const v = (snap?.[s.key] as number | undefined) ?? 0;
            const w = pct(v);
            if (w <= 0) return null;
            return (
              <div
                key={s.key}
                style={{ width: `${w}%`, background: s.color }}
                className="h-full"
              />
            );
          })}
        </div>

        <div className="mt-3 grid grid-cols-4 gap-2">
          {STAGES.map((s) => {
            const v = (snap?.[s.key] as number | undefined) ?? 0;
            return (
              <div key={s.key} className="rounded-xl border border-border bg-background/60 px-2 py-1.5 min-w-0">
                <div className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-[0.1em] text-muted-foreground truncate">
                  <span className="h-2 w-2 rounded-full shrink-0" style={{ background: s.color }} />
                  <span className="truncate">{s.label}</span>
                </div>
                <div className="mt-0.5 text-sm font-black leading-tight text-foreground truncate">{fmt(v)}</div>
                <div className="text-[9px] font-medium text-muted-foreground truncate">
                  {totals.total > 0 ? `${Math.round(pct(v))}%` : "—"}
                </div>
              </div>
            );
          })}
        </div>
      </motion.button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Moon className="h-5 w-5 text-primary" />
              Last night's sleep
            </DialogTitle>
            <DialogDescription>
              {nightLabel ? `Night of ${nightLabel}` : "Sourced from Apple Health"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="rounded-2xl border border-border bg-muted/30 p-4">
              <p className="text-[10px] font-bold tracking-[0.18em] uppercase text-muted-foreground">
                Total asleep
              </p>
              <p className="mt-1 text-3xl font-black text-foreground">{fmt(totals.asleep)}</p>
              {(snap?.sleepStart || snap?.sleepEnd) && (
                <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                  <div className="flex items-center gap-2">
                    <Bed className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Bedtime</p>
                      <p className="font-black text-foreground">{bedtime}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Sunrise className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Wake</p>
                      <p className="font-black text-foreground">{wakeTime}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div>
              <p className="text-[10px] font-bold tracking-[0.18em] uppercase text-muted-foreground mb-2">
                Stages
              </p>
              <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted">
                {STAGES.map((s) => {
                  const v = (snap?.[s.key] as number | undefined) ?? 0;
                  const w = pct(v);
                  if (w <= 0) return null;
                  return (
                    <div key={s.key} style={{ width: `${w}%`, background: s.color }} className="h-full" />
                  );
                })}
              </div>
              <div className="mt-3 space-y-2">
                {STAGES.map((s) => {
                  const v = (snap?.[s.key] as number | undefined) ?? 0;
                  const isAwake = s.key === "sleepAwakeMin";
                  const stagePct = isAwake ? pct(v) : asleepPct(v);
                  return (
                    <div key={s.key} className="rounded-xl border border-border bg-background/60 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: s.color }} />
                          <div className="min-w-0">
                            <p className="text-sm font-black text-foreground">{s.label}</p>
                            <p className="text-[11px] text-muted-foreground truncate">{s.hint}</p>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-black text-foreground">{fmt(v)}</p>
                          <p className="text-[10px] font-medium text-muted-foreground">
                            {v > 0 ? `${Math.round(stagePct)}%${isAwake ? "" : " of asleep"}` : "—"}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <p className="text-[11px] text-muted-foreground">
              Stages come directly from your Apple Watch / iPhone sleep tracking via Apple Health.
              Percentages for REM, Core and Deep are shown against your total asleep time.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
