import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { Footprints, HeartPulse, Activity, Scale, Droplet } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { fetchHealthSnapshotRange, type StoredHealthSnapshot } from "@/lib/healthSnapshotService";

type MetricKey = "steps" | "restingHeartRate" | "hrvMs" | "weightKg" | "glucoseMgDl";

const METRICS: { key: MetricKey; label: string; unit: string; icon: any; color: string }[] = [
  { key: "steps", label: "Steps", unit: "", icon: Footprints, color: "hsl(var(--primary))" },
  { key: "restingHeartRate", label: "Resting HR", unit: "bpm", icon: HeartPulse, color: "#ef4444" },
  { key: "hrvMs", label: "HRV", unit: "ms", icon: Activity, color: "#8b5cf6" },
  { key: "weightKg", label: "Weight", unit: "kg", icon: Scale, color: "#0ea5e9" },
  { key: "glucoseMgDl", label: "Glucose", unit: "mg/dL", icon: Droplet, color: "#f59e0b" },
];

export default function HealthTrendsCard({ userId, days = 30 }: { userId?: string; days?: number }) {
  const { user } = useAuth();
  const uid = userId ?? user?.id;
  const [rows, setRows] = useState<StoredHealthSnapshot[]>([]);
  const [metric, setMetric] = useState<MetricKey>("steps");

  useEffect(() => {
    if (!uid) return;
    let cancelled = false;
    fetchHealthSnapshotRange(uid, days).then((r) => { if (!cancelled) setRows(r); });
    return () => { cancelled = true; };
  }, [uid, days]);

  const chartData = useMemo(() => {
    return rows
      .map((r) => ({ date: r.date.slice(5), value: (r as any)[metric] ?? null }))
      .filter((d) => d.value != null);
  }, [rows, metric]);

  const current = METRICS.find((m) => m.key === metric)!;
  const hasAny = chartData.length > 0;

  return (
    <motion.div
      className="liquid-glass rounded-3xl p-5"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22 }}
    >
      <div className="mb-3">
        <p className="text-[10px] font-bold tracking-[0.18em] uppercase text-muted-foreground">Trends</p>
        <p className="text-sm font-black text-foreground">Last {days} days</p>
      </div>

      <div className="mb-3 flex flex-wrap gap-1.5">
        {METRICS.map((m) => {
          const Icon = m.icon;
          const active = metric === m.key;
          return (
            <button
              key={m.key}
              onClick={() => setMetric(m.key)}
              className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-bold transition-colors ${
                active
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background/60 text-muted-foreground"
              }`}
            >
              <Icon className="h-3 w-3" />
              {m.label}
            </button>
          );
        })}
      </div>

      <div className="h-40 w-full">
        {hasAny ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" width={32} />
              <Tooltip
                contentStyle={{ borderRadius: 12, border: "1px solid hsl(var(--border))", fontSize: 12 }}
                formatter={(v: any) => [`${v} ${current.unit}`.trim(), current.label]}
              />
              <Line type="monotone" dataKey="value" stroke={current.color} strokeWidth={2} dot={{ r: 2 }} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-border bg-background/60 text-[12px] font-medium text-muted-foreground">
            No {current.label.toLowerCase()} data yet.
          </div>
        )}
      </div>
    </motion.div>
  );
}
