import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Award, AlertCircle, TrendingUp, CheckCircle2, CalendarDays } from "lucide-react";
import { BbdoBadge, listBbdoBadges } from "@/lib/globalStreak";
import WeeklyBadgeCelebration from "./WeeklyBadgeCelebration";

type Tier = "gold" | "mixed" | "rough";

function tierFor(b: BbdoBadge): { tier: Tier; days: number } {
  const days = Number((b.snapshot as any)?.complete_days ?? 0);
  if (days >= 7) return { tier: "gold", days };
  if (days >= 4) return { tier: "mixed", days };
  return { tier: "rough", days };
}

const TIER_STYLE: Record<Tier, { accent: string; soft: string; sub: string }> = {
  gold: {
    accent: "var(--bbdo-blue)",
    soft: "var(--bbdo-blue-soft)",
    sub: "Full week",
  },
  mixed: {
    accent: "var(--bbdo-amber)",
    soft: "var(--bbdo-amber-soft)",
    sub: "Mixed week",
  },
  rough: {
    accent: "var(--bbdo-red)",
    soft: "var(--bbdo-red-soft)",
    sub: "Missed week",
  },
};

export default function BbdoBadgeGrid() {
  const [badges, setBadges] = useState<BbdoBadge[]>([]);
  const [selected, setSelected] = useState<BbdoBadge | null>(null);

  useEffect(() => {
    listBbdoBadges().then(setBadges);
  }, []);

  const weekly = [...badges.filter((b) => b.badge_type === "weekly")].sort(
    (a, b) => a.period_number - b.period_number,
  );
  const monthly = badges.filter((b) => b.badge_type === "monthly");

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 mb-3 px-1">
          <div
            className="w-7 h-7 rounded-xl flex items-center justify-center"
            style={{ background: "var(--bbdo-blue-soft)", color: "var(--bbdo-blue)" }}
          >
            <TrendingUp className="w-4 h-4" strokeWidth={1.75} />
          </div>
          <h3 className="text-foreground text-sm font-black uppercase tracking-wider">
            Weekly Progress
          </h3>
          <span className="text-xs text-muted-foreground">{weekly.length}</span>
        </div>
        {weekly.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
            Your first weekly progress card unlocks after your first tracked week.
          </div>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
            {weekly.map((b) => {
              const { tier, days } = tierFor(b);
              const style = TIER_STYLE[tier];
              const Icon = tier === "gold" ? CheckCircle2 : tier === "mixed" ? TrendingUp : AlertCircle;
              return (
                <motion.button
                  key={b.id}
                  onClick={() => setSelected(b)}
                  whileTap={{ scale: 0.98 }}
                  className="no-pill aspect-square rounded-2xl p-3 flex flex-col items-center justify-center relative overflow-hidden bg-card border border-border text-foreground"
                >
                  <span
                    className="w-10 h-10 rounded-xl flex items-center justify-center mb-2"
                    style={{ background: style.soft, color: style.accent }}
                  >
                    <Icon className="w-5 h-5" strokeWidth={1.75} />
                  </span>
                  <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Week</div>
                  <div className="text-2xl font-black leading-none text-foreground">#{b.period_number}</div>
                  <div className="text-[9px] font-bold text-muted-foreground mt-1 tracking-wider">
                    {days}/7 DAYS
                  </div>
                  {!b.viewed && tier === "gold" && (
                    <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-[3px] bg-primary" />
                  )}
                </motion.button>
              );
            })}
          </div>
        )}
      </div>

      <div>
        <div className="flex items-center gap-2 mb-3 px-1">
          <div
            className="w-7 h-7 rounded-xl flex items-center justify-center"
            style={{ background: "var(--bbdo-red-soft)", color: "var(--bbdo-red)" }}
          >
            <Award className="w-4 h-4" strokeWidth={1.75} />
          </div>
          <h3 className="text-foreground text-sm font-black uppercase tracking-wider">
            Monthly Progress
          </h3>
          <span className="text-xs text-muted-foreground">{monthly.length}</span>
        </div>
        {monthly.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
            Reach a 28-day streak to unlock a monthly journey.
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {monthly.map((b) => (
              <motion.button
                key={b.id}
                onClick={() => setSelected(b)}
                whileTap={{ scale: 0.98 }}
                className="no-pill aspect-[3/2] rounded-2xl p-4 flex flex-col items-start justify-between bg-card border border-border text-foreground relative overflow-hidden"
              >
                <span
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ background: "var(--bbdo-red-soft)", color: "var(--bbdo-red)" }}
                >
                  <CalendarDays className="w-5 h-5" strokeWidth={1.75} />
                </span>
                <div>
                  <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Month #{b.period_number}</div>
                  <div className="text-xs font-medium text-foreground">
                    {new Date(b.period_start).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                  </div>
                </div>
                {!b.viewed && <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-[3px] bg-primary" />}
              </motion.button>
            ))}
          </div>
        )}
      </div>

      {selected && (
        <WeeklyBadgeCelebration
          badge={selected}
          open={!!selected}
          onClose={() => {
            setSelected(null);
            listBbdoBadges().then(setBadges);
          }}
        />
      )}
    </div>
  );
}
