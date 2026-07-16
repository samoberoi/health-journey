import { useCallback, useEffect, useState } from "react";
import { App as CapApp } from "@capacitor/app";
import { motion } from "framer-motion";
import {
  Activity, Flame, HeartPulse, Moon, Route, Timer, Droplet, Scale, RefreshCw,
} from "lucide-react";
import {
  canUseAppleHealthSteps, fetchAppleHealthSnapshot, type HealthSnapshot,
} from "@/lib/appleHealth";

function Tile({
  icon: Icon, label, value, sub,
}: {
  icon: any; label: string; value: string; sub?: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-background/60 px-3 py-2.5">
      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
        <Icon className="h-3.5 w-3.5 text-primary" />
        {label}
      </div>
      <div className="mt-1 text-lg font-black leading-tight text-foreground">{value}</div>
      {sub && <div className="text-[10px] font-medium text-muted-foreground">{sub}</div>}
    </div>
  );
}

export default function AppleHealthSnapshotCard() {
  const enabled = canUseAppleHealthSteps();
  const [snap, setSnap] = useState<HealthSnapshot | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    try {
      const s = await fetchAppleHealthSnapshot();
      setSnap(s);
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!enabled) return;
    const sub = CapApp.addListener("appStateChange", ({ isActive }) => {
      if (isActive) void load();
    });
    const onVis = () => { if (document.visibilityState === "visible") void load(); };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      void sub.then((s) => s.remove());
    };
  }, [enabled, load]);

  if (!enabled) return null;

  const km = snap?.distanceMeters ? (snap.distanceMeters / 1000).toFixed(2) : null;

  return (
    <motion.div
      className="liquid-glass rounded-3xl p-5"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22 }}
    >
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-[10px] font-bold tracking-[0.18em] uppercase text-muted-foreground">
            Apple Health
          </p>
          <p className="text-sm font-black text-foreground">Today's snapshot</p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          aria-label="Refresh Apple Health"
          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card text-primary disabled:opacity-60"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Tile
          icon={Flame}
          label="Active kcal"
          value={snap?.activeCalories != null ? snap.activeCalories.toLocaleString("en-IN") : "—"}
        />
        <Tile
          icon={Route}
          label="Distance"
          value={km ? `${km} km` : "—"}
        />
        <Tile
          icon={Timer}
          label="Exercise"
          value={snap?.exerciseMinutes != null ? `${snap.exerciseMinutes} min` : "—"}
        />
        <Tile
          icon={Moon}
          label="Sleep"
          value={snap?.sleepHours ? `${snap.sleepHours.toFixed(1)} h` : "—"}
        />
        <Tile
          icon={HeartPulse}
          label="Resting HR"
          value={snap?.restingHeartRate ? `${snap.restingHeartRate} bpm` : "—"}
        />
        <Tile
          icon={Activity}
          label="HRV"
          value={snap?.hrvMs ? `${snap.hrvMs} ms` : "—"}
        />
        <Tile
          icon={Scale}
          label="Weight"
          value={snap?.weightKg ? `${snap.weightKg.toFixed(1)} kg` : "—"}
        />
        <Tile
          icon={Droplet}
          label="Glucose"
          value={snap?.glucoseMgDl ? `${snap.glucoseMgDl} mg/dL` : "—"}
        />
      </div>

      <p className="mt-3 text-[10px] leading-snug text-muted-foreground">
        Data syncs automatically from your iPhone, Apple Watch and connected apps.
      </p>
    </motion.div>
  );
}
