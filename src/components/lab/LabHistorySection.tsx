import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Activity, TrendingDown, TrendingUp, Minus, FlaskConical } from "lucide-react";
import { fetchAllParameters, fetchUserResults, formatDelta, latestResultsByParam, type LabParameter, type LabResult } from "@/lib/labResultsService";
import BodyInvestigationMap from "@/components/lab/BodyInvestigationMap";

interface Props {
  userId: string;
  patientName?: string | null;
}

function statusBg(status: string | null) {
  if (status === "high") return "bg-destructive/10 text-destructive";
  if (status === "low") return "bg-amber-500/10 text-amber-600 dark:text-amber-300";
  if (status === "normal") return "bg-[var(--bbdo-mint)]/10 text-[var(--bbdo-mint)]";
  return "bg-muted text-muted-foreground";
}

function trendIcon(trend: string | null, direction: string) {
  if (!trend || trend === "baseline") return <Minus className="w-3 h-3" />;
  if (trend === "stable") return <Minus className="w-3 h-3" />;
  if (trend === "improving") return <TrendingDown className="w-3 h-3" />;
  return <TrendingUp className="w-3 h-3" />;
}

export default function LabHistorySection({ userId, patientName }: Props) {
  const [loading, setLoading] = useState(true);
  const [params, setParams] = useState<LabParameter[]>([]);
  const [results, setResults] = useState<LabResult[]>([]);

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
  const paramsByCode = useMemo(() => Object.fromEntries(params.map((p) => [p.code, p])), [params]);

  const grouped = useMemo(() => {
    const map: Record<string, LabResult[]> = {};
    for (const code of Object.keys(latest)) {
      const r = latest[code];
      const p = paramsByCode[code];
      const g = p?.group_name || "OTHER";
      (map[g] = map[g] || []).push(r);
    }
    for (const g of Object.keys(map)) {
      map[g].sort((a, b) => {
        const oa = paramsByCode[a.parameter_code]?.display_order ?? 999;
        const ob = paramsByCode[b.parameter_code]?.display_order ?? 999;
        return oa - ob;
      });
    }
    return Object.entries(map).sort((a, b) => a[0].localeCompare(b[0]));
  }, [latest, paramsByCode]);

  if (loading) {
    return (
      <div className="liquid-glass rounded-2xl p-6 text-center text-sm text-muted-foreground">
        Loading lab history…
      </div>
    );
  }

  if (Object.keys(latest).length === 0) {
    return (
      <div className="space-y-4">
        <BodyInvestigationMap userId={userId} patientName={patientName} />
        <div className="liquid-glass rounded-2xl p-6 text-center">
          <FlaskConical className="w-8 h-8 text-primary mx-auto mb-2" />
          <p className="text-sm font-semibold">No lab results yet</p>
          <p className="text-xs text-muted-foreground mt-1">
            Once a report comes in, enter the values from your order to start tracking deltas.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <BodyInvestigationMap userId={userId} patientName={patientName} />
      {grouped.map(([group, items]) => (
        <motion.div
          key={group}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22 }}
          className="liquid-glass rounded-2xl overflow-hidden"
        >
          <div className="px-4 py-2.5 border-b border-border/40 flex items-center gap-2">
            <Activity className="w-3.5 h-3.5 text-primary" />
            <span className="text-[10px] font-black uppercase tracking-wider text-primary">{group}</span>
            <span className="text-[10px] text-muted-foreground ml-auto">{items.length}</span>
          </div>
          <ul className="divide-y divide-border/40">
            {items.map((r) => {
              const p = paramsByCode[r.parameter_code];
              const direction = p?.direction || "in_range";
              const delta = r.delta_vs_baseline;
              const trend = r.trend;
              const isImproving = trend === "improving";
              const isWorsening = trend === "worsening";
              const trendColor = isImproving
                ? "text-[var(--bbdo-mint)] bg-[var(--bbdo-mint)]/10"
                : isWorsening
                  ? "text-destructive bg-destructive/10"
                  : "text-muted-foreground bg-muted";
              return (
                <li key={r.id} className="px-4 py-3 flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold truncate">{r.parameter_name}</div>
                    <div className="text-[10px] text-muted-foreground truncate">
                      {r.ref_low != null && r.ref_high != null
                        ? `Ref ${r.ref_low}–${r.ref_high}${r.unit ? ` ${r.unit}` : ""}`
                        : r.unit || r.parameter_code}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm font-black tabular-nums">
                      {r.value_numeric ?? r.value_text ?? "—"}
                      {r.unit && r.value_numeric != null && (
                        <span className="text-[10px] font-normal text-muted-foreground ml-1">{r.unit}</span>
                      )}
                    </div>
                    <div className="flex items-center justify-end gap-1 mt-0.5">
                      {r.status && (
                        <span className={`text-[9px] font-bold uppercase rounded-full px-1.5 py-0.5 ${statusBg(r.status)}`}>
                          {r.status}
                        </span>
                      )}
                      {r.is_baseline ? (
                        <span className="text-[9px] font-bold uppercase rounded-full px-1.5 py-0.5 bg-primary/10 text-primary">
                          Baseline
                        </span>
                      ) : (
                        delta != null &&
                        delta !== 0 && (
                          <span className={`text-[9px] font-bold rounded-full px-1.5 py-0.5 flex items-center gap-0.5 ${trendColor}`}>
                            {trendIcon(trend, direction)}
                            {formatDelta(delta, null)}
                          </span>
                        )
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </motion.div>
      ))}
    </div>
  );
}
