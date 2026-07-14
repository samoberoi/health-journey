import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, TrendingDown, TrendingUp, Minus } from "lucide-react";
import {
  fetchAllParameters,
  fetchUserResults,
  formatDelta,
  latestResultsByParam,
  type LabParameter,
  type LabResult,
} from "@/lib/labResultsService";

interface Props {
  userId: string;
}

export default function AbnormalMarkersCard({ userId }: Props) {
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

  const paramMap = useMemo(() => {
    const m: Record<string, LabParameter> = {};
    for (const p of params) m[p.code] = p;
    return m;
  }, [params]);

  const abnormal = useMemo(() => {
    const latest = latestResultsByParam(results);
    return Object.values(latest)
      .filter((r) => r.status === "high" || r.status === "low")
      .sort((a, b) => {
        const pa = paramMap[a.parameter_code];
        const pb = paramMap[b.parameter_code];
        // key markers first, then by display order
        const ka = pa?.is_key_marker ? 0 : 1;
        const kb = pb?.is_key_marker ? 0 : 1;
        if (ka !== kb) return ka - kb;
        return (pa?.display_order ?? 999) - (pb?.display_order ?? 999);
      });
  }, [results, paramMap]);

  if (loading || abnormal.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22 }}
      className="liquid-glass rounded-3xl p-4 border border-destructive/40 danger-flash"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-3.5 h-3.5 text-destructive" />
          <h3 className="text-xs font-black uppercase tracking-wider text-foreground">
            Needs Attention
          </h3>
        </div>
        <span className="text-[10px] font-bold text-destructive">
          {abnormal.length} {abnormal.length === 1 ? "marker" : "markers"}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {abnormal.map((r) => {
          const p = paramMap[r.parameter_code];
          const name = p?.name || r.parameter_name;
          const unit = r.unit || p?.unit;
          const isHigh = r.status === "high";
          const statusLabel = isHigh ? "HIGH" : "LOW";
          const statusColor = isHigh ? "text-destructive" : "text-amber-500";
          const dot = isHigh ? "bg-destructive" : "bg-amber-500";
          const trend = r.trend;
          const isImproving = trend === "improving";
          const isWorsening = trend === "worsening";
          const TrendIcon = isImproving ? TrendingDown : isWorsening ? TrendingUp : Minus;
          const trendColor = isImproving
            ? "text-[var(--bbdo-mint)]"
            : isWorsening
              ? "text-destructive"
              : "text-muted-foreground";
          const delta = r.delta_vs_baseline;
          return (
            <div
              key={r.parameter_code}
              className="rounded-2xl bg-card/40 border border-border/40 p-2.5"
            >
              <div className="flex items-center justify-between gap-1 mb-0.5">
                <span className="text-[10px] text-muted-foreground font-semibold truncate">
                  {name}
                </span>
                <span className={`w-1.5 h-1.5 rounded-full ${dot} shrink-0`} />
              </div>
              <div className="flex items-baseline gap-1">
                <span className="stat-number text-base tabular-nums">
                  {r.value_numeric ?? r.value_text ?? "—"}
                </span>
                {unit && <span className="text-[9px] text-muted-foreground">{unit}</span>}
                <span className={`ml-auto text-[9px] font-black ${statusColor}`}>
                  {statusLabel}
                </span>
              </div>
              <div className="mt-0.5 flex items-center justify-between gap-1">
                {r.ref_low != null && r.ref_high != null ? (
                  <span className="text-[9px] text-muted-foreground">
                    Ref {r.ref_low}–{r.ref_high}
                  </span>
                ) : (
                  <span />
                )}
                {r.is_baseline ? (
                  <span className="text-[9px] font-bold text-primary uppercase">Baseline</span>
                ) : delta != null && delta !== 0 ? (
                  <span
                    className={`text-[10px] font-bold inline-flex items-center gap-0.5 ${trendColor}`}
                  >
                    <TrendIcon className="w-2.5 h-2.5" />
                    {formatDelta(delta, null)}
                  </span>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}
