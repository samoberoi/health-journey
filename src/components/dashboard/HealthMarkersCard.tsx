import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Activity, TrendingDown, TrendingUp, Minus, FlaskConical } from "lucide-react";
import { fetchAllParameters, fetchUserResults, formatDelta, latestResultsByParam, type LabParameter, type LabResult } from "@/lib/labResultsService";

interface Props {
  userId: string;
  onOpenAll?: () => void;
}

export default function HealthMarkersCard({ userId, onOpenAll }: Props) {
  const [params, setParams] = useState<LabParameter[]>([]);
  const [results, setResults] = useState<LabResult[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchAllParameters(), fetchUserResults(userId)])
      .then(([p, r]) => {
        setParams(p);
        setResults(r);
      })
      .finally(() => setLoading(false));
  }, [userId]);

  const latest = useMemo(() => latestResultsByParam(results), [results]);
  const keyMarkers = useMemo(
    () => params.filter((p) => p.is_key_marker).sort((a, b) => a.display_order - b.display_order),
    [params],
  );
  const haveAny = Object.keys(latest).length > 0;

  if (loading) return null;

  if (!haveAny) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22 }}
        className="liquid-glass rounded-3xl p-4"
      >
        <div className="flex items-center gap-2 mb-1.5">
          <FlaskConical className="w-3.5 h-3.5 text-primary" />
          <h3 className="text-xs font-black uppercase tracking-wider text-muted-foreground">Health Markers</h3>
        </div>
        <p className="text-xs text-muted-foreground">
          Add your first lab report under Lab Tests to start tracking key markers and progress.
        </p>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22 }}
      className="liquid-glass rounded-3xl p-4"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Activity className="w-3.5 h-3.5 text-primary" />
          <h3 className="text-xs font-black uppercase tracking-wider text-muted-foreground">Health Markers</h3>
        </div>
        {onOpenAll && (
          <button onClick={onOpenAll} className="text-[10px] font-bold text-primary uppercase tracking-wider">
            View all
          </button>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2">
        {keyMarkers.map((p) => {
          const r = latest[p.code];
          if (!r) return null;
          const trend = r.trend;
          const delta = r.delta_vs_baseline;
          const isImproving = trend === "improving";
          const isWorsening = trend === "worsening";
          const TrendIcon = isImproving ? TrendingDown : isWorsening ? TrendingUp : Minus;
          const trendColor = isImproving
            ? "text-[var(--bbdo-mint)]"
            : isWorsening
              ? "text-destructive"
              : "text-muted-foreground";
          const statusDot = r.status === "high" ? "bg-destructive" : r.status === "low" ? "bg-amber-500" : "bg-[var(--bbdo-mint)]";
          return (
            <div key={p.code} className="rounded-2xl bg-card/40 border border-border/40 p-2.5">
              <div className="flex items-center justify-between gap-1 mb-0.5">
                <span className="text-[10px] text-muted-foreground font-semibold truncate">{p.name}</span>
                <span className={`w-1.5 h-1.5 rounded-full ${statusDot} shrink-0`} />
              </div>
              <div className="flex items-baseline gap-1">
                <span className="stat-number text-base tabular-nums">{r.value_numeric ?? "—"}</span>
                {p.unit && <span className="text-[9px] text-muted-foreground">{p.unit}</span>}
              </div>
              <div className="mt-0.5 flex items-center gap-1">
                {r.is_baseline ? (
                  <span className="text-[9px] font-bold text-primary uppercase">Baseline</span>
                ) : delta != null && delta !== 0 ? (
                  <span className={`text-[10px] font-bold inline-flex items-center gap-0.5 ${trendColor}`}>
                    <TrendIcon className="w-2.5 h-2.5" />
                    {formatDelta(delta, null)}
                  </span>
                ) : (
                  <span className="text-[9px] text-muted-foreground">No change</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}
