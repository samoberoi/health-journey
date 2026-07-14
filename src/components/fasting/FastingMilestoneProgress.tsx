import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle2, Circle, Trophy } from "lucide-react";
import {
  fetchStageMilestones,
  fetchUserMilestones,
  fetchBadgeDefinitions,
  fetchUserBadges,
  type FastingBadge,
  type FastingStageMilestone,
} from "@/lib/streakService";
import { fetchUserProtocol, fetchTrackingForUser } from "@/lib/fastingService";
import { useAuth } from "@/contexts/AuthContext";

interface StageProgress {
  stage: FastingBadge;
  milestones: FastingStageMilestone[];
  achievedMilestoneIds: Set<string>;
  compliantDays: number;
  earned: boolean;
}

export default function FastingMilestoneProgress() {
  const { user } = useAuth();
  const [stages, setStages] = useState<StageProgress[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const up = await fetchUserProtocol(user.id);
        if (!up) { setLoading(false); return; }

        const [defs, userBadges, tracking, userMs] = await Promise.all([
          fetchBadgeDefinitions(),
          fetchUserBadges(user.id),
          fetchTrackingForUser(user.id, 365),
          fetchUserMilestones(user.id),
        ]);

        const stageBadges = defs
          .filter((b) => b.protocol_id === up.protocol_id && b.badge_type === "stage")
          .sort((a, b) => a.stage_order - b.stage_order);

        const earnedBadgeIds = new Set(userBadges.map((b) => b.badge_id));
        const achievedMsIds = new Set(userMs.map((m) => m.milestone_id).filter(Boolean) as string[]);

        const start = new Date(up.start_date);
        const isCompliant = (t: any) =>
          t.compliance_status === "completed" ||
          t.compliance_status === "partial" ||
          (t.fmod_actual_time && t.lmod_actual_time) ||
          Number(t.fasting_hours_completed ?? 0) > 0;

        const results: StageProgress[] = [];
        for (const stage of stageBadges) {
          const ms = await fetchStageMilestones(stage.id);
          const ws = (stage.week_range_start ?? 1) - 1;
          const we = stage.week_range_end ?? 1;
          const stageStart = new Date(start); stageStart.setDate(stageStart.getDate() + ws * 7);
          const stageEnd = new Date(start); stageEnd.setDate(stageEnd.getDate() + we * 7 - 1);
          const compliantDays = tracking.filter((t) => {
            const d = new Date(t.date);
            return d >= stageStart && d <= stageEnd && isCompliant(t);
          }).length;

          results.push({
            stage,
            milestones: ms,
            achievedMilestoneIds: new Set(ms.filter((m) => achievedMsIds.has(m.id)).map((m) => m.id)),
            compliantDays,
            earned: earnedBadgeIds.has(stage.id),
          });
        }
        setStages(results);
      } catch (e) {
        console.error("milestone progress load failed", e);
      }
      setLoading(false);
    })();
  }, [user]);

  if (loading || stages.length === 0) return null;

  const activeStage =
    stages.find((s) => !s.earned) ?? stages[stages.length - 1];

  const remainingMs = activeStage.milestones.filter(
    (m) => !activeStage.achievedMilestoneIds.has(m.id),
  );
  const nextMilestone = remainingMs.sort(
    (a, b) => a.compliant_days_required - b.compliant_days_required,
  )[0];

  const nextTarget = nextMilestone?.compliant_days_required ?? activeStage.compliantDays;
  const progressPct = nextMilestone
    ? Math.min(100, Math.round((activeStage.compliantDays / nextTarget) * 100))
    : 100;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22 }}
      className="rounded-3xl p-5 bg-card border border-border shadow-card space-y-4"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Stage {activeStage.stage.stage_order} · {activeStage.stage.pattern}
          </p>
          <h3 className="text-base font-black text-foreground truncate flex items-center gap-1.5">
            <span className="text-xl">{activeStage.stage.badge_emoji}</span>
            {activeStage.stage.badge_name}
          </h3>
        </div>
        {activeStage.earned && (
          <div className="flex items-center gap-1 rounded-full bg-primary/10 text-primary px-2.5 py-1 text-[10px] font-bold shrink-0">
            <Trophy className="w-3 h-3" /> Earned
          </div>
        )}
      </div>

      {nextMilestone && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-foreground truncate">Next: {nextMilestone.name}</span>
            <span className="font-bold text-muted-foreground tabular-nums shrink-0">
              {activeStage.compliantDays}/{nextTarget} days
            </span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <motion.div
              className="h-full bg-primary rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${progressPct}%` }}
              transition={{ duration: 0.6 }}
            />
          </div>
          {nextMilestone.description && (
            <p className="text-[11px] text-muted-foreground">{nextMilestone.description}</p>
          )}
        </div>
      )}

      <div className="space-y-1.5">
        {activeStage.milestones
          .sort((a, b) => a.milestone_order - b.milestone_order)
          .map((m) => {
            const done = activeStage.achievedMilestoneIds.has(m.id);
            return (
              <div
                key={m.id}
                className={`flex items-center gap-2.5 rounded-xl px-2.5 py-1.5 text-xs ${
                  done ? "bg-primary/5" : "bg-muted/40"
                }`}
              >
                {done
                  ? <CheckCircle2 className="w-4 h-4 text-primary shrink-0" strokeWidth={2.5} />
                  : <Circle className="w-4 h-4 text-muted-foreground shrink-0" strokeWidth={2} />}
                <div className="flex-1 min-w-0">
                  <p className={`font-bold truncate ${done ? "text-foreground" : "text-muted-foreground"}`}>
                    {m.name}
                  </p>
                </div>
                <span className="text-[10px] font-bold text-muted-foreground tabular-nums shrink-0">
                  {m.compliant_days_required}d
                </span>
              </div>
            );
          })}
      </div>
    </motion.div>
  );
}
