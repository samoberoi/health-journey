import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Moon } from "lucide-react";
import { canUseNativeHealth, fetchHealthSnapshot, type HealthSnapshot } from "@/lib/healthProvider";
import { useAuth } from "@/contexts/AuthContext";

const STAGES: Array<{
  key: keyof HealthSnapshot;
  label: string;
  color: string;
}> = [
  { key: "sleepAwakeMin",        label: "Awake", color: "var(--bbdo-red)" },
  { key: "sleepRemMin",          label: "REM",   color: "var(--bbdo-amber)" },
  { key: "sleepCoreMin",         label: "Core",  color: "hsl(var(--info))" },
  { key: "sleepDeepMin",         label: "Deep",  color: "hsl(var(--primary))" },
];

function fmt(min?: number) {
  if (min == null || min <= 0) return "—";
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export default function SleepBreakdownCard() {
  const { user } = useAuth();
  const [snap, setSnap] = useState<HealthSnapshot | null>(null);

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

  if (!user || !canUseNativeHealth()) return null;

  const awake = snap?.sleepAwakeMin ?? 0;
  const rem   = snap?.sleepRemMin ?? 0;
  const core  = snap?.sleepCoreMin ?? 0;
  const deep  = snap?.sleepDeepMin ?? 0;
  const unspec = snap?.sleepUnspecifiedMin ?? 0;
  const asleep = rem + core + deep + unspec;
  const total = asleep + awake;

  if (total <= 0) return null;

  const pct = (v: number) => (total > 0 ? (v / total) * 100 : 0);

  return (
    <motion.div
      className="liquid-glass rounded-3xl p-4"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22 }}
    >
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-[10px] font-bold tracking-[0.18em] uppercase text-muted-foreground">
            Sleep · last night
          </p>
          <p className="text-sm font-black text-foreground flex items-center gap-1.5">
            <Moon className="h-3.5 w-3.5 text-primary" />
            {fmt(asleep)} asleep
          </p>
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
                {total > 0 ? `${Math.round(pct(v))}%` : "—"}
              </div>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}
