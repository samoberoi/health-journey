import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Footprints, Plus, ChevronRight, Flame } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { fetchProfile } from "@/lib/profileService";
import {
  fetchMovementOverview,
  logTodaySteps,
  type MovementOverview,
} from "@/lib/movementUserService";

export default function TodayStepsCard({ onOpenMovement }: { onOpenMovement?: () => void }) {
  const { user } = useAuth();
  const [data, setData] = useState<MovementOverview | null>(null);
  const [val, setVal] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const p = await fetchProfile(user.id);
      const ov = await fetchMovementOverview(user.id, {
        bmiCategory: (p as any)?.bmi_category ?? null,
        activityLevel: (p as any)?.lifestyle?.activity ?? (p as any)?.activity_level ?? null,
        age: (p as any)?.age ?? null,
        weightKg: (p as any)?.weight ?? null,
        heightCm: (p as any)?.height ?? null,
      });
      setData(ov);
    } catch {}
  }, [user]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const handler = () => load();
    window.addEventListener("health-log-saved", handler);
    return () => window.removeEventListener("health-log-saved", handler);
  }, [load]);

  if (!user) return null;

  const target = data?.targetSteps || 6000;
  const today = data?.todaySteps || 0;
  const ratio = Math.min(1, target ? today / target : 0);
  const hit = today >= target;

  const handleSave = async () => {
    const n = Math.max(0, Math.round(Number(val)));
    if (!n) return toast.error("Enter your step count");
    setSaving(true);
    try {
      await logTodaySteps(user.id, n);
      toast.success(`Logged ${n.toLocaleString("en-IN")} steps`);
      setVal("");
      window.dispatchEvent(new CustomEvent("health-log-saved"));
      await load();
    } catch (e: any) {
      toast.error(e?.message || "Couldn't save steps");
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div
      className="liquid-glass rounded-3xl p-5 relative overflow-hidden"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
    >
      <button
        type="button"
        onClick={onOpenMovement}
        className="absolute top-4 right-4 inline-flex items-center gap-0.5 text-[11px] font-bold text-primary"
      >
        Movement <ChevronRight className="w-3.5 h-3.5" />
      </button>

      <div className="flex items-center gap-4">
        <div className="relative w-16 h-16 shrink-0">
          <svg viewBox="0 0 64 64" className="w-full h-full -rotate-90">
            <circle cx="32" cy="32" r="27" fill="none" stroke="hsl(var(--muted))" strokeWidth="6" />
            <circle
              cx="32" cy="32" r="27" fill="none"
              stroke="var(--bbdo-red)" strokeWidth="6" strokeLinecap="round"
              strokeDasharray={`${ratio * 169.6} 169.6`}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <Footprints className="w-5 h-5 text-primary" />
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold tracking-[0.18em] uppercase text-muted-foreground">Today's Steps</p>
          <p className="text-2xl font-black text-foreground leading-tight">
            {today.toLocaleString("en-IN")}
            <span className="text-xs text-muted-foreground font-medium"> / {target.toLocaleString("en-IN")}</span>
          </p>
          <p className="text-[11px] mt-0.5">
            {hit ? (
              <span className="text-emerald-600 font-bold inline-flex items-center gap-1">
                <Flame className="w-3 h-3" /> Daily goal hit!
              </span>
            ) : (
              <span className="text-muted-foreground">
                Level {data?.progress.current_level ?? 1} · {data?.level?.name ?? "Get moving"}
              </span>
            )}
          </p>
        </div>
      </div>

      <div className="mt-4 flex gap-2">
        <input
          type="number"
          inputMode="numeric"
          min={0}
          placeholder="Log today's steps"
          value={val}
          onChange={(e) => setVal(e.target.value)}
          className="flex-1 h-10 rounded-xl border border-input bg-background px-3 text-sm"
        />
        <button
          onClick={handleSave}
          disabled={saving}
          className="h-10 px-4 rounded-xl bg-[var(--bbdo-red)] text-white text-sm font-bold inline-flex items-center gap-1.5 disabled:opacity-60"
        >
          <Plus className="w-4 h-4" /> {saving ? "Saving…" : "Log"}
        </button>
      </div>
    </motion.div>
  );
}
