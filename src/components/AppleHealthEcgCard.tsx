import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Activity, HeartPulse, RefreshCw } from "lucide-react";
import { canReadEcg, fetchLatestEcg, type EcgReading } from "@/lib/healthProvider";

function formatTakenAt(iso?: string) {
  if (!iso) return null;
  try {
    const d = new Date(iso);
    return d.toLocaleString("en-IN", {
      day: "numeric", month: "short", hour: "numeric", minute: "2-digit",
    });
  } catch {
    return null;
  }
}

function classificationColor(classification?: string): string {
  if (!classification) return "text-muted-foreground";
  const c = classification.toLowerCase();
  if (c.includes("atrial")) return "text-red-500";
  if (c.includes("sinus")) return "text-emerald-500";
  if (c.includes("inconclusive")) return "text-amber-500";
  return "text-foreground";
}

function Waveform({ points, width = 320, height = 72 }: { points: number[]; width?: number; height?: number }) {
  const path = useMemo(() => {
    if (!points || points.length < 2) return "";
    let min = Infinity, max = -Infinity;
    for (const v of points) { if (v < min) min = v; if (v > max) max = v; }
    const range = max - min || 1;
    const stepX = width / (points.length - 1);
    let d = "";
    for (let i = 0; i < points.length; i++) {
      const x = i * stepX;
      const y = height - ((points[i] - min) / range) * height;
      d += (i === 0 ? "M" : "L") + x.toFixed(1) + "," + y.toFixed(1) + " ";
    }
    return d.trim();
  }, [points, width, height]);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-16" preserveAspectRatio="none">
      <path d={path} fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function AppleHealthEcgCard() {
  const [ecg, setEcg] = useState<EcgReading | null>(null);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetchLatestEcg();
      setEcg(r);
    } finally {
      setLoading(false);
      setLoaded(true);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  if (!canReadEcg()) return null;
  if (loaded && !ecg) return null; // Hide when there's no ECG on the watch

  const taken = formatTakenAt(ecg?.startDate);
  const cColor = classificationColor(ecg?.classification);

  return (
    <motion.div
      className="liquid-glass rounded-3xl p-4"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22 }}
    >
      <div className="mb-2 flex items-center justify-between">
        <div>
          <p className="text-[10px] font-bold tracking-[0.18em] uppercase text-muted-foreground">
            Apple Watch · ECG
          </p>
          <p className="text-sm font-black text-foreground">
            {ecg?.classification || (loading ? "Reading…" : "No recent ECG")}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          aria-label="Refresh ECG"
          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card text-primary disabled:opacity-60"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {ecg && (
        <>
          <div className={`flex items-center gap-3 text-xs font-semibold ${cColor}`}>
            <Activity className="h-4 w-4" />
            <span>{ecg.classification}</span>
          </div>

          {ecg.voltagesMicroV && ecg.voltagesMicroV.length > 4 ? (
            <div className="mt-2 rounded-xl border border-border bg-background/60 px-3 py-2 text-red-500">
              <Waveform points={ecg.voltagesMicroV} />
            </div>
          ) : null}

          <div className="mt-2 grid grid-cols-3 gap-2 text-[11px]">
            <div className="rounded-lg border border-border bg-background/60 px-2 py-1.5">
              <div className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
                <HeartPulse className="h-3 w-3 text-primary" /> Avg HR
              </div>
              <div className="text-sm font-black leading-tight text-foreground">
                {ecg.averageHeartRate ? `${ecg.averageHeartRate} bpm` : "—"}
              </div>
            </div>
            <div className="rounded-lg border border-border bg-background/60 px-2 py-1.5">
              <div className="text-[9px] font-bold uppercase tracking-[0.1em] text-muted-foreground">Symptoms</div>
              <div className="text-sm font-black leading-tight text-foreground capitalize">
                {ecg.symptomsStatus || "—"}
              </div>
            </div>
            <div className="rounded-lg border border-border bg-background/60 px-2 py-1.5">
              <div className="text-[9px] font-bold uppercase tracking-[0.1em] text-muted-foreground">Taken</div>
              <div className="text-sm font-black leading-tight text-foreground">{taken || "—"}</div>
            </div>
          </div>

          <p className="mt-2 text-[10px] leading-snug text-muted-foreground">
            Synced from Apple Health. Recorded on your Apple Watch and reviewed by watchOS.
          </p>
        </>
      )}
    </motion.div>
  );
}
