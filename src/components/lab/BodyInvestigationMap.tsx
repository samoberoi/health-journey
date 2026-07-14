import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Activity, ArrowRight, Maximize2, X, Info } from "lucide-react";
import bodyImg from "@/assets/body-anatomy.png";
import {
  ORGANS,
  organForParameter,
  statusFor,
  worstStatus,
  STATUS_COLOR,
  type MarkerStatus,
  type Organ,
  type OrganSlug,
} from "@/lib/labOrganMap";
import {
  fetchAllParameters,
  fetchUserResults,
  latestResultsByParam,
  type LabParameter,
  type LabResult,
} from "@/lib/labResultsService";
import FullMarkerComparison from "@/components/lab/FullMarkerComparison";

interface Props {
  userId: string;
  /** Optional heading shown as an eyebrow above the map. */
  eyebrow?: string;
  patientName?: string | null;
}

type MarkerRow = {
  code: string;
  name: string;
  status: MarkerStatus;
  result: LabResult | undefined;
  param: LabParameter | undefined;
};

export default function BodyInvestigationMap({ userId, eyebrow = "Body Investigation Map", patientName }: Props) {
  const [loading, setLoading] = useState(true);
  const [params, setParams] = useState<LabParameter[]>([]);
  const [results, setResults] = useState<LabResult[]>([]);
  const [selected, setSelected] = useState<OrganSlug | null>(null);
  const [showFull, setShowFull] = useState(false);

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchAllParameters(), fetchUserResults(userId)])
      .then(([p, r]) => { setParams(p); setResults(r); })
      .finally(() => setLoading(false));
  }, [userId]);

  useEffect(() => {
    const handler = (e: Event) => setSelected((e as CustomEvent<OrganSlug>).detail);
    window.addEventListener("bbdo:select-organ", handler);
    return () => window.removeEventListener("bbdo:select-organ", handler);
  }, []);

  const paramsByCode = useMemo(
    () => Object.fromEntries(params.map((p) => [p.code, p])) as Record<string, LabParameter>,
    [params],
  );
  const latest = useMemo(() => latestResultsByParam(results), [results]);

  /** Every marker known to the catalog, bucketed by organ, with status. */
  const byOrgan = useMemo(() => {
    const map: Record<OrganSlug, MarkerRow[]> = {
      brain: [], thyroid: [], heart: [], lungs: [], liver: [],
      pancreas: [], kidneys: [], blood: [], bones: [], other: [],
    };
    for (const p of params) {
      const organ = organForParameter(p);
      const r = latest[p.code];
      const status = statusFor(r, p);
      // Skip params that never carry data for this user so organs feel accurate
      if (!r && status === "no_data") {
        // still record so the "no data" state is visible when the organ is selected
        map[organ].push({ code: p.code, name: p.name, status, result: undefined, param: p });
      } else {
        map[organ].push({ code: p.code, name: p.name, status, result: r, param: p });
      }
    }
    return map;
  }, [params, latest]);

  const organSummary = useMemo(() => {
    const summary: Record<OrganSlug, { status: MarkerStatus; flagged: number; total: number; withData: number }> = {} as any;
    for (const organ of [...ORGANS, { slug: "other" as OrganSlug, label: "Other", short: "Other", x: 0, y: 0 }]) {
      const rows = byOrgan[organ.slug] || [];
      const withData = rows.filter((r) => r.status !== "no_data");
      const flagged = withData.filter((r) => r.status === "out_of_range" || r.status === "critical").length;
      summary[organ.slug] = {
        status: worstStatus(withData.map((r) => r.status)),
        flagged,
        total: rows.length,
        withData: withData.length,
      };
    }
    return summary;
  }, [byOrgan]);

  const selectedOrgan: Organ | null = selected ? ORGANS.find((o) => o.slug === selected) || null : null;

  if (loading) {
    return (
      <div className="liquid-glass rounded-2xl p-6 text-sm text-muted-foreground">
        Loading body investigation…
      </div>
    );
  }

  const hasAnyResult = results.length > 0;

  return (
    <div className="liquid-glass rounded-2xl overflow-hidden">
      <div className="px-4 pt-4 pb-3 flex items-start gap-3 border-b border-border/40">
        <div className="w-9 h-9 rounded-xl bg-[var(--bbdo-blue)]/10 flex items-center justify-center shrink-0">
          <Activity className="w-4 h-4 text-[var(--bbdo-blue)]" strokeWidth={1.9} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-black tracking-[0.18em] uppercase text-[var(--bbdo-blue)]">{eyebrow}</p>
          <h3 className="text-base font-black text-foreground leading-tight">
            {patientName ? `${patientName}'s investigation` : "Every test, mapped to your body"}
          </h3>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Tap any organ to see its markers, reference range and status.
          </p>
        </div>
        {hasAnyResult && (
          <button
            onClick={() => setShowFull(true)}
            className="shrink-0 h-8 px-3 rounded-full bg-foreground text-background text-[11px] font-bold flex items-center gap-1.5 active:scale-[0.98] transition-transform"
          >
            <Maximize2 className="w-3 h-3" strokeWidth={2.2} />
            Full comparison
          </button>
        )}
      </div>

      {!hasAnyResult ? (
        <div className="p-6 text-center">
          <Info className="w-6 h-6 text-muted-foreground mx-auto mb-2" strokeWidth={1.8} />
          <p className="text-sm font-semibold text-foreground">No lab data yet</p>
          <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">
            Once your report is in, every marker will light up on the body map with its own reference range.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_320px] gap-0">
          <BodyPanel
            selected={selected}
            onSelect={setSelected}
            organSummary={organSummary}
          />
          <MarkerPanel
            selected={selected}
            selectedOrgan={selectedOrgan}
            byOrgan={byOrgan}
            organSummary={organSummary}
            onClose={() => setSelected(null)}
          />
        </div>
      )}

      <div className="px-4 py-3 border-t border-border/40 flex flex-wrap items-center gap-x-4 gap-y-1.5">
        {(["normal", "out_of_range", "critical", "no_data"] as MarkerStatus[]).map((s) => (
          <span key={s} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <span className="w-2 h-2 rounded-full" style={{ background: STATUS_COLOR[s].dot }} />
            {STATUS_COLOR[s].label}
          </span>
        ))}
      </div>

      {showFull && (
        <FullMarkerComparison
          userId={userId}
          patientName={patientName}
          onClose={() => setShowFull(false)}
        />
      )}
    </div>
  );
}

function BodyPanel({
  selected,
  onSelect,
  organSummary,
}: {
  selected: OrganSlug | null;
  onSelect: (o: OrganSlug | null) => void;
  organSummary: Record<OrganSlug, { status: MarkerStatus; flagged: number; total: number; withData: number }>;
}) {
  return (
    <div className="relative bg-gradient-to-b from-[#F1F5FB] to-[#E9F0F9] dark:from-[#0F1A3D]/40 dark:to-[#0F1A3D]/10 p-4">
      <div className="relative mx-auto" style={{ maxWidth: 380, aspectRatio: "768 / 1600" }}>
        <img
          src={bodyImg}
          alt="Anatomical body illustration"
          className="absolute inset-0 w-full h-full object-contain select-none pointer-events-none"
          draggable={false}
          loading="lazy"
        />
        {ORGANS.map((organ) => {
          const s = organSummary[organ.slug];
          const active = selected === organ.slug;
          const color = STATUS_COLOR[s.status].dot;
          return (
            <button
              key={organ.slug}
              onClick={() => onSelect(active ? null : organ.slug)}
              className="absolute -translate-x-1/2 -translate-y-1/2 flex items-center gap-1.5 group"
              style={{ left: `${organ.x}%`, top: `${organ.y}%` }}
              aria-label={`${organ.label} — ${s.flagged} of ${s.withData} flagged`}
            >
              <span
                className={`relative w-3 h-3 rounded-full ring-2 ring-white shadow-md transition-transform ${active ? "scale-125" : "group-active:scale-90"}`}
                style={{ background: color }}
              >
                {(s.status === "critical" || s.status === "out_of_range") && (
                  <span
                    className="absolute inset-0 rounded-full animate-none opacity-40"
                    style={{ background: color, transform: "scale(1.8)" }}
                  />
                )}
              </span>
              <span
                className={`whitespace-nowrap text-[10px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-md transition-colors ${
                  active
                    ? "bg-foreground text-background"
                    : "bg-white/85 dark:bg-black/40 text-foreground"
                }`}
                style={{ boxShadow: "0 1px 2px rgba(15,26,61,0.12)" }}
              >
                {organ.short}
                <span className="ml-1 opacity-60 font-semibold">
                  {s.withData > 0 ? `${s.flagged}/${s.withData}` : "—"}
                </span>
              </span>
            </button>
          );
        })}
      </div>
      <p className="text-center text-[11px] text-muted-foreground mt-2">
        Tap any organ to inspect its markers.
      </p>
    </div>
  );
}

function MarkerPanel({
  selected,
  selectedOrgan,
  byOrgan,
  organSummary,
  onClose,
}: {
  selected: OrganSlug | null;
  selectedOrgan: Organ | null;
  byOrgan: Record<OrganSlug, MarkerRow[]>;
  organSummary: Record<OrganSlug, { status: MarkerStatus; flagged: number; total: number; withData: number }>;
  onClose: () => void;
}) {
  return (
    <div className="border-l border-border/40 bg-card min-h-[420px] max-h-[640px] flex flex-col">
      <AnimatePresence mode="wait">
        {selectedOrgan ? (
          <motion.div
            key={selectedOrgan.slug}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="flex flex-col h-full"
          >
            <div className="px-4 py-3 border-b border-border/40 flex items-center gap-2">
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ background: STATUS_COLOR[organSummary[selectedOrgan.slug].status].dot }}
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-black text-foreground leading-tight">{selectedOrgan.label}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {organSummary[selectedOrgan.slug].withData} tracked ·{" "}
                  {organSummary[selectedOrgan.slug].flagged} flagged
                </p>
              </div>
              <button
                onClick={onClose}
                className="w-7 h-7 rounded-full bg-muted flex items-center justify-center active:scale-95 transition-transform"
                aria-label="Close"
              >
                <X className="w-3.5 h-3.5" strokeWidth={2.2} />
              </button>
            </div>
            <MarkerList rows={byOrgan[selectedOrgan.slug] || []} />
          </motion.div>
        ) : (
          <motion.div
            key="summary"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="flex flex-col h-full"
          >
            <div className="px-4 py-3 border-b border-border/40">
              <p className="text-[10px] font-black tracking-[0.18em] uppercase text-muted-foreground">
                Organ overview
              </p>
              <p className="text-sm font-black text-foreground leading-tight mt-0.5">
                Where your body needs attention
              </p>
            </div>
            <ul className="divide-y divide-border/40 overflow-y-auto flex-1">
              {ORGANS.map((o) => {
                const s = organSummary[o.slug];
                return (
                  <li key={o.slug}>
                    <button
                      onClick={() => {
                        // Handled by outer state via parent; this list is inert on hover but
                        // we let the user jump by tapping — reuse the panel by lifting state up.
                        const evt = new CustomEvent("bbdo:select-organ", { detail: o.slug });
                        window.dispatchEvent(evt);
                      }}
                      className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-muted/40 transition-colors"
                    >
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ background: STATUS_COLOR[s.status].dot }}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-foreground truncate">{o.label}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {s.withData > 0
                            ? `${s.flagged} flagged of ${s.withData} tracked`
                            : "No data yet"}
                        </p>
                      </div>
                      <ArrowRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" strokeWidth={2} />
                    </button>
                  </li>
                );
              })}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function MarkerList({ rows }: { rows: MarkerRow[] }) {
  // Show rows with data first, ordered by severity, then no-data grouped.
  const ordered = useMemo(() => {
    const withData = rows.filter((r) => r.status !== "no_data")
      .sort((a, b) => {
        const rank: Record<MarkerStatus, number> = { critical: 0, out_of_range: 1, normal: 2, no_data: 3 };
        return rank[a.status] - rank[b.status];
      });
    const noData = rows.filter((r) => r.status === "no_data");
    return { withData, noData };
  }, [rows]);

  if (rows.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-6 text-center">
        <p className="text-xs text-muted-foreground">No markers mapped to this organ.</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      {ordered.withData.length === 0 && (
        <div className="p-4 text-center">
          <p className="text-xs text-muted-foreground">No results in the latest report for this organ.</p>
        </div>
      )}
      {ordered.withData.length > 0 && (
        <ul className="divide-y divide-border/40">
          {ordered.withData.map((row) => (
            <MarkerRow key={row.code} row={row} />
          ))}
        </ul>
      )}
      {ordered.noData.length > 0 && (
        <div className="px-4 py-3 border-t border-border/40">
          <p className="text-[10px] font-black tracking-widest uppercase text-muted-foreground mb-1.5">
            Not in this report
          </p>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            {ordered.noData.slice(0, 6).map((r) => r.name).join(" · ")}
            {ordered.noData.length > 6 && ` · +${ordered.noData.length - 6} more`}
          </p>
        </div>
      )}
    </div>
  );
}

function MarkerRow({ row }: { row: MarkerRow }) {
  const s = STATUS_COLOR[row.status];
  const r = row.result!;
  const value = r?.value_numeric ?? r?.value_text ?? "—";
  return (
    <li className="px-4 py-3 flex items-start gap-3">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-foreground truncate">{row.name}</p>
        <p className="text-[10px] text-muted-foreground truncate">
          {r?.ref_low != null && r?.ref_high != null
            ? `Ref ${r.ref_low}–${r.ref_high}${r?.unit ? ` ${r.unit}` : ""}`
            : r?.unit || row.code}
        </p>
      </div>
      <div className="text-right shrink-0">
        <p className="text-sm font-black tabular-nums text-foreground">
          {value}
          {r?.unit && r?.value_numeric != null && (
            <span className="text-[10px] font-normal text-muted-foreground ml-1">{r.unit}</span>
          )}
        </p>
        <span className={`inline-block mt-0.5 text-[9px] font-black uppercase tracking-wide px-1.5 py-0.5 rounded-full ${s.bg} ${s.text}`}>
          {s.label}
        </span>
      </div>
    </li>
  );
}
