import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Users, Star, Activity, AlertTriangle, TrendingUp, TrendingDown, Minus,
  Heart, UserCheck, Clock, ChevronRight, Loader2, Bell,
  Timer, Flame, CalendarClock, Plus, Package, Send, CheckCircle2,
  Dumbbell, Sparkles, Utensils, XCircle, MinusCircle
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { coachTypeLabel, type Coach } from "@/lib/coachService";
import { fetchTrackingForUser } from "@/lib/fastingService";
import { calculateStreak } from "@/lib/streakService";
import { createNotification } from "@/lib/notificationService";
import { toast } from "sonner";
import ScheduleMeetingDialog from "@/components/coach/ScheduleMeetingDialog";
import PatientDailySummaryDialog from "@/components/coach/PatientDailySummaryDialog";

interface FastingSummary {
  user_id: string;
  name: string;
  currentStreak: number;
  longestStreak: number;
  lastStatus: string;
  hasProtocol: boolean;
}

interface PatientSummary {
  user_id: string;
  assigned_at: string;
  name: string | null;
  phone: string | null;
  avatar_url: string | null;
  age: number | null;
  gender: string | null;
  weight: number | null;
  bmi: number | null;
  bmi_category: string | null;
  latestGlucose: number | null;
  latestBpSystolic: number | null;
  initialScore: number | null;
  currentScore: number | null;
  planName: string | null;
  planStarted: string | null;
  planExpires: string | null;
  loggedToday: boolean;
  fastingOk: boolean;
  onTrack: boolean;
}

interface Alert {
  user_id: string;
  patient_name: string;
  type: "danger" | "warning";
  message: string;
  metric: string;
}

function evaluateAlerts(patients: PatientSummary[]): Alert[] {
  const seen = new Set<string>();
  const alerts: Alert[] = [];
  const push = (a: Alert) => {
    const key = `${a.user_id}|${a.metric}`;
    if (seen.has(key)) return;
    seen.add(key);
    alerts.push(a);
  };
  for (const p of patients) {
    const name = p.name ?? "Unknown";
    if (p.bmi && p.bmi >= 30) {
      push({ user_id: p.user_id, patient_name: name, type: p.bmi >= 35 ? "danger" : "warning", message: `BMI is ${p.bmi} (${p.bmi_category})`, metric: "BMI" });
    }
    if (p.latestGlucose && p.latestGlucose >= 180) {
      push({ user_id: p.user_id, patient_name: name, type: "danger", message: `Fasting glucose at ${p.latestGlucose} mg/dL`, metric: "Glucose" });
    } else if (p.latestGlucose && p.latestGlucose >= 130) {
      push({ user_id: p.user_id, patient_name: name, type: "warning", message: `Fasting glucose at ${p.latestGlucose} mg/dL`, metric: "Glucose" });
    }
    if (p.latestBpSystolic && p.latestBpSystolic >= 150) {
      push({ user_id: p.user_id, patient_name: name, type: "danger", message: `BP systolic at ${p.latestBpSystolic} mmHg`, metric: "BP" });
    } else if (p.latestBpSystolic && p.latestBpSystolic >= 140) {
      push({ user_id: p.user_id, patient_name: name, type: "warning", message: `BP systolic at ${p.latestBpSystolic} mmHg`, metric: "BP" });
    }
    if (p.initialScore != null && p.currentScore != null && p.currentScore < p.initialScore) {
      const delta = p.currentScore - p.initialScore;
      push({ user_id: p.user_id, patient_name: name, type: delta <= -5 ? "danger" : "warning", message: `Health score dropped ${Math.abs(delta)} pts (${p.initialScore} → ${p.currentScore})`, metric: "Score" });
    }
  }
  return alerts.sort((a, b) => (a.type === "danger" ? -1 : 1));
}

export default function CoachHome({ onViewPatient, onViewFasting }: { onViewPatient?: () => void; onViewFasting?: () => void }) {
  const { user } = useAuth();
  const [coach, setCoach] = useState<Coach | null>(null);
  const [patients, setPatients] = useState<PatientSummary[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [fastingSummaries, setFastingSummaries] = useState<FastingSummary[]>([]);
  const [needsScheduling, setNeedsScheduling] = useState<PatientSummary[]>([]);
  const [scheduleFor, setScheduleFor] = useState<PatientSummary | null>(null);
  const [schedulePickerOpen, setSchedulePickerOpen] = useState(false);
  const [completedSessions, setCompletedSessions] = useState(0);
  const [domainStats, setDomainStats] = useState({ exercise: 0, yoga: 0, diet: 0 });
  const [loading, setLoading] = useState(true);
  const [nudging, setNudging] = useState<string | null>(null);
  const [summaryPatient, setSummaryPatient] = useState<PatientSummary | null>(null);

  useEffect(() => {
    if (!user) return;
    loadData();
     
  }, [user]);

  const loadData = async () => {
    if (!user) return;
    setLoading(true);

    const { data: coachData } = await supabase
      .from("coaches" as any).select("*").eq("user_id", user.id).single();

    if (!coachData) { setLoading(false); return; }
    setCoach(coachData as unknown as Coach);

    const { data: assignments } = await supabase
      .from("coach_assignments" as any)
      .select("user_id, assigned_at")
      .eq("coach_id", (coachData as any).id)
      .eq("is_active", true);

    if (!assignments || assignments.length === 0) {
      setPatients([]); setAlerts([]); setFastingSummaries([]); setNeedsScheduling([]);
      setLoading(false); return;
    }

    const patientIds = (assignments as any[]).map((a) => a.user_id);

    const [{ data: profiles }, { data: subs }] = await Promise.all([
      supabase.from("profiles" as any)
        .select("user_id, name, phone, avatar_url, age, gender, weight, bmi, bmi_category, initial_health_score, assessment")
        .in("user_id", patientIds),
      supabase.from("subscriptions" as any)
        .select("user_id, plan_name, started_at, expires_at, status")
        .in("user_id", patientIds)
        .eq("status", "active"),
    ]);

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayIso = todayStart.toISOString();

    const enriched: PatientSummary[] = await Promise.all(
      (assignments as any[]).map(async (a) => {
        const profile = (profiles as any[])?.find((p) => p.user_id === a.user_id);
        const sub = (subs as any[])?.find((s) => s.user_id === a.user_id);

        const [{ data: glucoseLog }, { data: bpLog }, { count: todayLogs }, { data: todayFast }] = await Promise.all([
          supabase.from("health_logs" as any).select("glucose_morning").eq("user_id", a.user_id).eq("log_type", "diabetes").order("logged_at", { ascending: false }).limit(1).maybeSingle(),
          supabase.from("health_logs" as any).select("bp_systolic").eq("user_id", a.user_id).eq("log_type", "bp").order("logged_at", { ascending: false }).limit(1).maybeSingle(),
          supabase.from("health_logs" as any).select("id", { count: "exact", head: true }).eq("user_id", a.user_id).gte("logged_at", todayIso),
          supabase.from("fasting_tracking" as any).select("compliance_status").eq("user_id", a.user_id).gte("tracking_date", todayStart.toISOString().slice(0, 10)).maybeSingle(),
        ]);

        const loggedToday = (todayLogs ?? 0) > 0;
        const fastingOk = !todayFast || ["completed", "partial"].includes(((todayFast as any)?.compliance_status ?? ""));
        const onTrack = loggedToday && fastingOk;

        return {
          user_id: a.user_id,
          assigned_at: a.assigned_at,
          name: profile?.name ?? null,
          phone: profile?.phone ?? null,
          avatar_url: profile?.avatar_url ?? null,
          age: profile?.age ?? null,
          gender: profile?.gender ?? null,
          weight: profile?.weight ?? null,
          bmi: profile?.bmi ?? null,
          bmi_category: profile?.bmi_category ?? null,
          latestGlucose: (glucoseLog as any)?.glucose_morning ?? null,
          latestBpSystolic: (bpLog as any)?.bp_systolic ?? null,
          initialScore: profile?.initial_health_score ?? null,
          currentScore: profile?.assessment?.healthScore ?? null,
          planName: sub?.plan_name ?? null,
          planStarted: sub?.started_at ?? null,
          planExpires: sub?.expires_at ?? null,
          loggedToday,
          fastingOk,
          onTrack,
        };
      })
    );

    setPatients(enriched);
    setAlerts(evaluateAlerts(enriched));

    // Handled meetings + completed sessions count
    const { data: handledMeetings } = await supabase
      .from("coach_meetings" as any)
      .select("user_id, status")
      .eq("coach_id", (coachData as any).id)
      .in("status", ["scheduled", "completed"]);
    const handledIds = new Set(((handledMeetings as any[]) ?? []).map((m) => m.user_id));
    setCompletedSessions(((handledMeetings as any[]) ?? []).filter((m) => m.status === "completed").length);
    setNeedsScheduling(enriched.filter((p) => !handledIds.has(p.user_id)));

    // Domain overviews (today) — count unique patients active per domain
    const [{ data: exRows }, { data: vidRows }, { data: mealRows }] = await Promise.all([
      supabase.from("user_exercise_logs" as any).select("user_id").in("user_id", patientIds).gte("created_at", todayIso),
      supabase.from("video_progress" as any).select("user_id").in("user_id", patientIds).gte("watched_at", todayIso),
      supabase.from("meal_photos" as any).select("user_id").in("user_id", patientIds).gte("logged_at", todayIso),
    ]);
    setDomainStats({
      exercise: new Set(((exRows as any[]) ?? []).map((r) => r.user_id)).size,
      yoga: new Set(((vidRows as any[]) ?? []).map((r) => r.user_id)).size,
      diet: new Set(((mealRows as any[]) ?? []).map((r) => r.user_id)).size,
    });


    // Fasting summaries
    const fSummaries: FastingSummary[] = await Promise.all(
      patientIds.map(async (uid: string) => {
        const profile = (profiles as any[])?.find((p) => p.user_id === uid);
        const { data: up } = await supabase
          .from("user_protocols" as any).select("id").eq("user_id", uid).eq("status", "active").limit(1).maybeSingle();
        const tracking = await fetchTrackingForUser(uid, 14);
        const streak = calculateStreak(tracking);
        const lastEntry = tracking[0];
        return {
          user_id: uid,
          name: profile?.name ?? "Unknown",
          currentStreak: streak.currentStreak,
          longestStreak: streak.longestStreak,
          lastStatus: lastEntry?.compliance_status ?? "pending",
          hasProtocol: !!up,
        };
      })
    );
    setFastingSummaries(fSummaries);
    setLoading(false);
  };

  const handleNudge = async (p: PatientSummary) => {
    setNudging(p.user_id);
    try {
      await createNotification({
        user_id: p.user_id,
        title: `A gentle nudge from ${coach?.name ?? "your coach"}`,
        body: "Log today's readings and stay on your fasting window — small daily wins compound. You've got this! 💪",
        type: "coach_nudge",
        icon: "👋",
      });
      toast.success(`Nudge sent to ${p.name ?? "patient"}`);
    } catch (e: any) {
      toast.error("Could not send nudge");
    } finally {
      setNudging(null);
    }
  };

  const onTrackCount = patients.filter((p) => p.onTrack).length;
  const offTrackPatients = patients.filter((p) => !p.onTrack);

  const trend = (p: PatientSummary) => {
    if (p.initialScore == null || p.currentScore == null) return null;
    const d = p.currentScore - p.initialScore;
    if (d > 0) return { icon: TrendingUp, color: "text-success", label: `+${d}` };
    if (d < 0) return { icon: TrendingDown, color: "text-destructive", label: `${d}` };
    return { icon: Minus, color: "text-muted-foreground", label: "0" };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 px-5 pt-14 pb-4">
      {/* Greeting */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <p className="text-muted-foreground text-sm">Good to see you 👋</p>
        <h1 className="text-xl sm:text-2xl font-black text-foreground">{coach?.name ?? "Coach"}</h1>
      </motion.div>

      {/* Coach Card */}
      {coach && (
        <motion.div className="liquid-glass rounded-3xl p-5" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
          <div className="flex items-start gap-4">
            <img
              src={coach.avatar_url || "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=120&h=120&fit=crop&crop=face"}
              alt={coach.name}
              className="w-14 h-14 rounded-2xl object-cover flex-shrink-0"
            />
            <div className="flex-1">
              <h3 className="text-foreground font-black text-base">{coach.name}</h3>
              <p className="text-muted-foreground text-xs mt-0.5">{coach.specialization}</p>
              <span className="inline-block text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full border border-primary/20 mt-1.5">
                {coachTypeLabel(coach.coach_type)}
              </span>
            </div>
          </div>
        </motion.div>
      )}

      {/* Meetings to Schedule */}
      {needsScheduling.length > 0 && (
        <motion.div
          className="rounded-3xl p-5 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border border-primary/20"
          initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}
        >
          <div className="flex items-center gap-2 mb-3">
            <CalendarClock className="w-5 h-5 text-primary" strokeWidth={1.8} />
            <span className="text-foreground font-bold">Meetings require scheduling</span>
            <span className="ml-auto text-[10px] font-bold text-primary bg-primary/15 px-2 py-0.5 rounded-full">
              {needsScheduling.length} pending
            </span>
          </div>
          <div className="space-y-2">
            {needsScheduling.slice(0, 6).map((p) => {
              const fmt = (d: string | null) =>
                d ? new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : null;
              const joined = fmt(p.assigned_at);
              const started = fmt(p.planStarted);
              const expires = fmt(p.planExpires);
              const daysLeft = p.planExpires
                ? Math.max(0, Math.ceil((new Date(p.planExpires).getTime() - Date.now()) / 86400000))
                : null;
              return (
                <button
                  key={p.user_id}
                  onClick={() => setScheduleFor(p)}
                  className="w-full flex items-start gap-3 p-3 rounded-2xl bg-card/70 hover:bg-card transition text-left"
                >
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0 overflow-hidden">
                    {p.avatar_url ? (
                      <img src={p.avatar_url} alt="" className="w-10 h-10 rounded-xl object-cover" />
                    ) : (
                      <span className="text-primary font-bold text-sm">{(p.name ?? "?")[0].toUpperCase()}</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-foreground font-semibold text-sm truncate">{p.name ?? "Patient"}</p>
                      {p.planName && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded-md">
                          <Package className="w-2.5 h-2.5" strokeWidth={2} /> {p.planName}
                        </span>
                      )}
                    </div>
                    <p className="text-muted-foreground text-[11px] mt-0.5">Awaiting onboarding meeting</p>
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-[10px] text-muted-foreground">
                      {joined && <span>Joined <span className="text-foreground font-semibold">{joined}</span></span>}
                      {started && <span>Started <span className="text-foreground font-semibold">{started}</span></span>}
                      {expires && (
                        <span>
                          Ends <span className="text-foreground font-semibold">{expires}</span>
                          {daysLeft !== null && <span className="text-primary font-bold"> · {daysLeft}d left</span>}
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="gradient-blue text-primary-foreground rounded-xl px-3 py-1.5 text-xs font-bold flex items-center gap-1 shrink-0">
                    <Plus className="w-3.5 h-3.5" /> Schedule
                  </span>
                </button>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* Stats Grid — Patients clickable */}
      <motion.div className="grid grid-cols-3 gap-3" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <button
          onClick={onViewPatient}
          className="liquid-glass rounded-2xl p-4 text-center hover:bg-accent/40 transition-colors"
        >
          <Users className="w-5 h-5 text-primary mx-auto mb-1.5" strokeWidth={1.8} />
          <p className="stat-number text-2xl text-foreground">{patients.length}</p>
          <p className="text-muted-foreground text-[10px] font-medium">Patients →</p>
        </button>
        <div className="liquid-glass rounded-2xl p-4 text-center">
          <Star className="w-5 h-5 text-warning mx-auto mb-1.5 fill-warning" />
          <p className="stat-number text-2xl text-foreground">{Number(coach?.avg_rating ?? 0).toFixed(1)}</p>
          <p className="text-muted-foreground text-[10px] font-medium">
            Rating{coach?.total_ratings ? ` · ${coach.total_ratings}` : ""}
          </p>
        </div>
        <button
          onClick={() => setSchedulePickerOpen(true)}
          className="liquid-glass rounded-2xl p-4 text-center hover:bg-accent/40 transition-colors"
          title="Sessions completed — tap to schedule a new meeting"
        >
          <Activity className="w-5 h-5 text-success mx-auto mb-1.5" strokeWidth={1.8} />
          <p className="stat-number text-2xl text-foreground">{completedSessions}</p>
          <p className="text-muted-foreground text-[10px] font-medium">Sessions →</p>
        </button>
      </motion.div>

      {/* Today's Tracking */}
      {patients.length > 0 && (
        <motion.div className="liquid-glass rounded-3xl p-5" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}>
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle2 className="w-5 h-5 text-primary" strokeWidth={1.8} />
            <span className="text-foreground font-bold">Today's Tracking</span>
            <span className="ml-auto text-[11px] text-muted-foreground font-medium">
              {onTrackCount} / {patients.length} on track
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2 mb-3">
            <div className="bg-success/10 rounded-xl p-3 text-center">
              <p className="text-2xl font-black text-success">{onTrackCount}</p>
              <p className="text-[10px] text-muted-foreground font-medium">On Track</p>
            </div>
            <div className="bg-destructive/10 rounded-xl p-3 text-center">
              <p className="text-2xl font-black text-destructive">{offTrackPatients.length}</p>
              <p className="text-[10px] text-muted-foreground font-medium">Off Track</p>
            </div>
          </div>
          {offTrackPatients.length > 0 && (
            <div className="space-y-2">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                Nudge patients off track
              </p>
              {offTrackPatients.slice(0, 5).map((p) => (
                <div key={p.user_id} className="flex items-center gap-3 p-2.5 rounded-2xl bg-card/60">
                  <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0 overflow-hidden">
                    {p.avatar_url ? (
                      <img src={p.avatar_url} alt="" className="w-9 h-9 rounded-xl object-cover" />
                    ) : (
                      <span className="text-primary font-bold text-xs">{(p.name ?? "?")[0].toUpperCase()}</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-foreground font-semibold text-sm truncate">{p.name ?? "Patient"}</p>
                    <p className="text-muted-foreground text-[11px]">
                      {!p.loggedToday ? "No logs today" : ""}
                      {!p.loggedToday && !p.fastingOk ? " • " : ""}
                      {!p.fastingOk ? "Fasting missed" : ""}
                    </p>
                  </div>
                  <button
                    onClick={() => handleNudge(p)}
                    disabled={nudging === p.user_id}
                    className="gradient-blue text-primary-foreground rounded-xl px-3 py-1.5 text-xs font-bold flex items-center gap-1 shrink-0 disabled:opacity-60"
                  >
                    {nudging === p.user_id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Send className="w-3.5 h-3.5" />
                    )}
                    Nudge
                  </button>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      )}

      {/* Alerts */}
      {alerts.length > 0 && (
        <motion.div className="liquid-glass rounded-3xl p-5" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <div className="flex items-center gap-2 mb-4">
            <Bell className="w-5 h-5 text-warning" strokeWidth={1.8} />
            <span className="text-foreground font-bold">Attention Needed</span>
            <span className="text-[10px] font-bold text-warning bg-warning/10 px-2 py-0.5 rounded-full ml-auto">
              {alerts.length} alert{alerts.length !== 1 ? "s" : ""}
            </span>
          </div>
          <div className="flex flex-col gap-2.5">
            {alerts.slice(0, 6).map((alert, i) => (
              <div
                key={`${alert.user_id}-${alert.metric}-${i}`}
                className={`flex items-start gap-3 rounded-2xl p-3 ${
                  alert.type === "danger" ? "danger-flash" : "bg-warning/10"
                }`}
              >
                <AlertTriangle
                  className={`w-4 h-4 mt-0.5 shrink-0 ${
                    alert.type === "danger" ? "text-destructive danger-dot" : "text-warning"
                  }`}
                  strokeWidth={2}
                />

                <div className="flex-1 min-w-0">
                  <p className="text-foreground text-sm font-semibold">{alert.patient_name}</p>
                  <p className="text-muted-foreground text-xs">{alert.message}</p>
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                  alert.type === "danger" ? "text-destructive bg-destructive/15" : "text-warning bg-warning/15"
                }`}>
                  {alert.metric}
                </span>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* No alerts — all clear */}
      {alerts.length === 0 && patients.length > 0 && (
        <motion.div
          className="liquid-glass rounded-3xl p-5 flex items-center gap-3"
          initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
        >
          <div className="w-10 h-10 rounded-xl bg-success/15 flex items-center justify-center shrink-0">
            <Heart className="w-5 h-5 text-success" strokeWidth={1.8} />
          </div>
          <div>
            <p className="text-foreground font-bold text-sm">All patients healthy</p>
            <p className="text-muted-foreground text-xs">No concerns flagged right now</p>
          </div>
        </motion.div>
      )}

      {/* Domain Overviews — today's engagement across pillars */}
      {patients.length > 0 && (
        <motion.div
          className="grid grid-cols-3 gap-3"
          initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.17 }}
        >
          {[
            { key: "exercise", label: "Exercise", icon: Dumbbell, value: domainStats.exercise, color: "text-primary" },
            { key: "yoga", label: "Yoga & Stress", icon: Sparkles, value: domainStats.yoga, color: "text-warning" },
            { key: "diet", label: "Diet", icon: Utensils, value: domainStats.diet, color: "text-success" },
          ].map((d) => {
            const pct = patients.length ? Math.round((d.value / patients.length) * 100) : 0;
            return (
              <div key={d.key} className="liquid-glass rounded-2xl p-4">
                <div className="flex items-center justify-between mb-1.5">
                  <d.icon className={`w-5 h-5 ${d.color}`} strokeWidth={1.8} />
                  <span className="text-[10px] font-bold text-muted-foreground">{pct}%</span>
                </div>
                <p className="stat-number text-xl text-foreground">{d.value}<span className="text-xs text-muted-foreground font-medium">/{patients.length}</span></p>
                <p className="text-muted-foreground text-[10px] font-medium mt-0.5">{d.label} today</p>
              </div>
            );
          })}
        </motion.div>
      )}


      {/* Fasting Overview */}
      {fastingSummaries.length > 0 && (
        <motion.div className="liquid-glass rounded-3xl p-5" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Timer className="w-5 h-5 text-primary" strokeWidth={1.8} />
              <span className="text-foreground font-bold">Fasting Overview</span>
            </div>
            {onViewFasting && (
              <button onClick={onViewFasting} className="text-primary text-xs font-medium flex items-center gap-0.5">
                View All <ChevronRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="grid grid-cols-3 gap-2 mb-4">
            <div className="bg-primary/10 rounded-xl p-3 text-center">
              <p className="text-lg font-black text-primary">{fastingSummaries.filter((f) => f.lastStatus === "completed" || f.lastStatus === "partial").length}</p>
              <p className="text-[10px] text-muted-foreground font-medium">On Track</p>
            </div>
            <div className="bg-destructive/10 rounded-xl p-3 text-center">
              <p className="text-lg font-black text-destructive">{fastingSummaries.filter((f) => f.lastStatus === "missed").length}</p>
              <p className="text-[10px] text-muted-foreground font-medium">Missed</p>
            </div>
            <div className="bg-muted rounded-xl p-3 text-center">
              <p className="text-lg font-black text-muted-foreground">{fastingSummaries.filter((f) => !f.hasProtocol).length}</p>
              <p className="text-[10px] text-muted-foreground font-medium">Unassigned</p>
            </div>
          </div>

          <div className="space-y-2">
            {fastingSummaries.slice(0, 5).map((f) => (
              <div key={f.user_id} className="flex items-center justify-between py-2 border-b border-border/30 last:border-0">
                <div className="flex items-center gap-2.5">
                  <div className={`w-2 h-2 rounded-full ${
                    !f.hasProtocol ? "bg-muted-foreground" :
                    f.lastStatus === "completed" ? "bg-primary" :
                    f.lastStatus === "partial" ? "bg-amber-500" :
                    f.lastStatus === "missed" ? "bg-destructive" : "bg-muted-foreground"
                  }`} />
                  <span className="text-foreground text-sm font-medium">{f.name}</span>
                </div>
                <div className="flex items-center gap-3">
                  {f.hasProtocol ? (
                    <>
                      <span className="text-[10px] font-semibold text-primary flex items-center gap-0.5">
                        <Flame className="w-3 h-3" /> {f.currentStreak}d
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        f.lastStatus === "completed" ? "text-primary bg-primary/10" :
                        f.lastStatus === "partial" ? "text-amber-500 bg-amber-500/10" :
                        f.lastStatus === "missed" ? "text-destructive bg-destructive/10" :
                        "text-muted-foreground bg-muted"
                      }`}>
                        {f.lastStatus === "completed" ? <span className="inline-flex items-center gap-1"><CheckCircle2 className="w-3 h-3" strokeWidth={2.4} /> Good</span> :
                         f.lastStatus === "partial" ? <span className="inline-flex items-center gap-1"><MinusCircle className="w-3 h-3" strokeWidth={2.4} /> Partial</span> :
                         f.lastStatus === "missed" ? <span className="inline-flex items-center gap-1"><XCircle className="w-3 h-3" strokeWidth={2.4} /> Missed</span> : "Pending"}
                      </span>
                    </>
                  ) : (
                    <span className="text-[10px] font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-full">No protocol</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* My Patients — richer cards */}
      <motion.div className="liquid-glass rounded-3xl p-5" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-primary" strokeWidth={1.8} />
            <span className="text-foreground font-bold">My Patients</span>
          </div>
          {patients.length > 0 && (
            <button onClick={onViewPatient} className="text-primary text-xs font-medium flex items-center gap-0.5">
              View All <ChevronRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {patients.length === 0 ? (
          <div className="text-center py-8">
            <Users className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground text-sm">No patients assigned yet</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {patients.slice(0, 6).map((p) => {
              const t = trend(p);
              return (
                <button
                  key={p.user_id}
                  onClick={() => setSummaryPatient(p)}
                  className="flex items-center gap-3 py-3 border-b border-border/30 last:border-0 text-left w-full hover:opacity-90"
                >
                  <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0 overflow-hidden relative">
                    {p.avatar_url ? (
                      <img src={p.avatar_url} alt="" className="w-11 h-11 rounded-xl object-cover" />
                    ) : (
                      <span className="text-primary font-bold text-sm">{(p.name ?? "?")[0].toUpperCase()}</span>
                    )}
                    <span
                      className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-background ${
                        p.onTrack ? "bg-success" : "bg-destructive"
                      }`}
                      title={p.onTrack ? "On track today" : "Off track today"}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-foreground font-semibold text-sm truncate">{p.name ?? "Unknown"}</p>
                      {t && (
                        <span className={`inline-flex items-center gap-0.5 text-[10px] font-bold ${t.color}`}>
                          <t.icon className="w-3 h-3" /> {t.label}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      {p.planName && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">
                          <Package className="w-2.5 h-2.5" /> {p.planName}
                        </span>
                      )}
                      {p.bmi_category && (
                        <span className={`text-[10px] font-medium ${p.bmi && p.bmi >= 30 ? "text-warning" : "text-muted-foreground"}`}>
                          {p.bmi_category}
                        </span>
                      )}
                    </div>
                    {(p.planStarted || p.planExpires) && (
                      <p className="text-muted-foreground text-[10px] mt-0.5">
                        {p.planStarted ? new Date(p.planStarted).toLocaleDateString("en-IN", { month: "short", day: "numeric" }) : "—"}
                        {" → "}
                        {p.planExpires ? new Date(p.planExpires).toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "2-digit" }) : "—"}
                      </p>
                    )}
                  </div>
                  <div className="text-right flex-shrink-0">
                    {p.weight && <p className="text-foreground text-xs font-bold">{p.weight} kg</p>}
                    <p className="text-muted-foreground text-[10px]">
                      <Clock className="w-3 h-3 inline mr-0.5" />
                      {new Date(p.assigned_at).toLocaleDateString("en-IN", { month: "short", day: "numeric" })}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </motion.div>

      {coach && scheduleFor && (
        <ScheduleMeetingDialog
          open={!!scheduleFor}
          onOpenChange={(b) => { if (!b) setScheduleFor(null); }}
          coachId={coach.id}
          patientId={scheduleFor.user_id}
          patientName={scheduleFor.name ?? "Patient"}
          defaultType="onboarding"
          onScheduled={() => { setScheduleFor(null); loadData(); }}
        />
      )}
      {coach && (
        <ScheduleMeetingDialog
          open={schedulePickerOpen}
          onOpenChange={setSchedulePickerOpen}
          coachId={coach.id}
          patients={patients.map((p) => ({ user_id: p.user_id, name: p.name, phone: p.phone }))}
          onScheduled={() => { setSchedulePickerOpen(false); loadData(); }}
        />
      )}
      {summaryPatient && (
        <PatientDailySummaryDialog
          open={!!summaryPatient}
          onClose={() => setSummaryPatient(null)}
          patient={{
            user_id: summaryPatient.user_id,
            name: summaryPatient.name,
            avatar_url: summaryPatient.avatar_url,
            assigned_at: summaryPatient.assigned_at,
          }}
          coachName={coach?.name ?? null}
        />
      )}
    </div>
  );
}
