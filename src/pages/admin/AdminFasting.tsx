import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Timer, Copy, Power, ChevronDown, ChevronRight, Zap,
  Shield, Activity, Edit3, Check, X, Clock, AlertTriangle, Award
} from "lucide-react";
import { toast } from "sonner";
import {
  fetchProtocols, fetchWeeklyPlans, updateWeeklyPlan, toggleProtocolActive,
  duplicateProtocol, updateProtocol,
  type FastingProtocol, type WeeklyPlan, formatTime24to12
} from "@/lib/fastingService";
import {
  fetchBadgeDefinitions, updateBadgeDefinition, type FastingBadge
} from "@/lib/streakService";
import DataToolsMenu from "@/components/admin/DataToolsMenu";
import { FASTING_PILLAR } from "@/lib/pillarConfigs";
import StageMilestoneEditor from "@/components/fasting/StageMilestoneEditor";

const typeIcons: Record<string, React.ElementType> = {
  basic: Shield,
  moderate: Activity,
  severe: AlertTriangle,
};

const typeLabels: Record<string, string> = {
  basic: "Foundational",
  moderate: "Moderate",
  severe: "Severe",
};

const typeColors: Record<string, string> = {
  basic: "bg-primary/10 text-primary",
  moderate: "bg-amber-500/10 text-amber-500",
  severe: "bg-destructive/10 text-destructive",
};

const PATTERNS = ["12:12", "13:11", "14:10", "16:08", "18:06", "20:04"];

export default function AdminFasting() {
  const [protocols, setProtocols] = useState<FastingProtocol[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [weeks, setWeeks] = useState<WeeklyPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingWeek, setEditingWeek] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<WeeklyPlan>>({});
  const [editingRemarks, setEditingRemarks] = useState<string | null>(null);
  const [remarksText, setRemarksText] = useState("");

  // Badge management
  const [badges, setBadges] = useState<FastingBadge[]>([]);
  const [editingBadge, setEditingBadge] = useState<string | null>(null);
  const [badgeEdit, setBadgeEdit] = useState<Partial<FastingBadge>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [p, b] = await Promise.all([fetchProtocols(), fetchBadgeDefinitions()]);
      setProtocols(p);
      setBadges(b);
    } catch (e: any) {
      toast.error(e.message);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleExpand = async (id: string) => {
    if (expanded === id) { setExpanded(null); return; }
    setExpanded(id);
    try {
      const w = await fetchWeeklyPlans(id);
      setWeeks(w);
    } catch (e: any) { toast.error(e.message); }
  };

  const handleToggle = async (id: string, current: boolean) => {
    await toggleProtocolActive(id, !current);
    toast.success(!current ? "Protocol enabled" : "Protocol disabled");
    load();
  };

  const handleDuplicate = async (id: string) => {
    try {
      await duplicateProtocol(id);
      toast.success("Protocol duplicated");
      load();
    } catch (e: any) { toast.error(e.message); }
  };

  const startEdit = (w: WeeklyPlan) => {
    setEditingWeek(w.id);
    setEditData({
      fasting_pattern: w.fasting_pattern,
      lmod_time: w.lmod_time,
      fmod_time: w.fmod_time,
      metabolic_push: w.metabolic_push,
      push_pattern: w.push_pattern,
      push_days: w.push_days,
      requires_coach_guidance: w.requires_coach_guidance,
      remarks: w.remarks,
    });
  };

  const saveEdit = async (weekId: string) => {
    try {
      await updateWeeklyPlan(weekId, editData);
      toast.success("Week updated");
      setEditingWeek(null);
      if (expanded) {
        const w = await fetchWeeklyPlans(expanded);
        setWeeks(w);
      }
    } catch (e: any) { toast.error(e.message); }
  };

  const saveRemarks = async (protoId: string) => {
    try {
      await updateProtocol(protoId, { remarks: remarksText });
      toast.success("Remarks saved");
      setEditingRemarks(null);
      load();
    } catch (e: any) { toast.error(e.message); }
  };

  const startBadgeEdit = (b: FastingBadge) => {
    setEditingBadge(b.id);
    setBadgeEdit({ badge_name: b.badge_name, badge_emoji: b.badge_emoji, description: b.description, required_streak_days: b.required_streak_days });
  };

  const saveBadgeEdit = async (badgeId: string) => {
    try {
      await updateBadgeDefinition(badgeId, badgeEdit);
      toast.success("Badge updated");
      setEditingBadge(null);
      load();
    } catch (e: any) { toast.error(e.message); }
  };

  // Group weeks by pattern ranges for timeline view
  const groupWeeks = (wks: WeeklyPlan[]) => {
    if (!wks.length) return [];
    const groups: { start: number; end: number; pattern: string; push: boolean; pushPattern: string | null; pushDays: number; coach: boolean; lmod: string; fmod: string }[] = [];
    let cur = { start: wks[0].week_number, end: wks[0].week_number, pattern: wks[0].fasting_pattern, push: wks[0].metabolic_push, pushPattern: wks[0].push_pattern, pushDays: wks[0].push_days ?? 0, coach: wks[0].requires_coach_guidance, lmod: wks[0].lmod_time, fmod: wks[0].fmod_time };
    for (let i = 1; i < wks.length; i++) {
      const w = wks[i];
      if (w.fasting_pattern === cur.pattern && w.metabolic_push === cur.push && w.lmod_time === cur.lmod && w.fmod_time === cur.fmod) {
        cur.end = w.week_number;
      } else {
        groups.push({ ...cur });
        cur = { start: w.week_number, end: w.week_number, pattern: w.fasting_pattern, push: w.metabolic_push, pushPattern: w.push_pattern, pushDays: w.push_days ?? 0, coach: w.requires_coach_guidance, lmod: w.lmod_time, fmod: w.fmod_time };
      }
    }
    groups.push({ ...cur });
    return groups;
  };

  if (loading) return <div className="p-8 text-center text-muted-foreground">Loading protocols…</div>;

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex items-start justify-between gap-3 w-full lg:w-auto">
          <div>
            <h2 className="text-2xl font-black text-foreground flex items-center gap-2">
              <Timer className="w-6 h-6 text-primary" /> Fasting Protocols
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Manage 24-week intermittent fasting plans. Click to expand timeline.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <DataToolsMenu
              pillar={FASTING_PILLAR}
              csvExport={{ filename: "fasting-protocols", rows: protocols as any }}
              csvImport={{ table: "fasting_protocols" }}
              onChanged={() => window.location.reload()}
            />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {protocols.map((p) => {
            const Icon = typeIcons[p.protocol_type] ?? Timer;
            return (
              <div key={p.id} className="liquid-glass rounded-2xl px-4 py-3 min-w-[110px]">
                <div className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-semibold ${typeColors[p.protocol_type]}`}>
                  <Icon className="w-3 h-3" />
                  {typeLabels[p.protocol_type]}
                </div>
                <p className="mt-2 text-xl font-black text-foreground">{p.total_weeks}w</p>
                <p className="text-[10px] text-muted-foreground">{p.is_active ? "Active" : "Disabled"}</p>
              </div>
            );
          })}
        </div>
      </div>

      <div className="space-y-3">
        {protocols.map((proto) => {
          const isOpen = expanded === proto.id;
          const Icon = typeIcons[proto.protocol_type] ?? Timer;
          const groups = isOpen ? groupWeeks(weeks) : [];

          return (
            <motion.div key={proto.id} layout className="liquid-glass rounded-3xl overflow-hidden">
              {/* Header */}
              <button
                onClick={() => handleExpand(proto.id)}
                className="w-full flex items-center gap-4 p-5 text-left hover:bg-accent/50 transition-colors"
              >
                <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${typeColors[proto.protocol_type]}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-base font-bold text-foreground truncate">{proto.protocol_name}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">{proto.total_weeks} weeks · {proto.protocol_type}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDuplicate(proto.id); }}
                    className="p-2 rounded-xl hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                    title="Duplicate"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleToggle(proto.id, proto.is_active); }}
                    className={`p-2 rounded-xl transition-colors ${proto.is_active ? "text-primary hover:bg-primary/10" : "text-muted-foreground hover:bg-accent"}`}
                    title={proto.is_active ? "Disable" : "Enable"}
                  >
                    <Power className="w-4 h-4" />
                  </button>
                  {isOpen ? <ChevronDown className="w-5 h-5 text-muted-foreground" /> : <ChevronRight className="w-5 h-5 text-muted-foreground" />}
                </div>
              </button>

              <AnimatePresence>
                {isOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25 }}
                    className="overflow-hidden"
                  >
                    <div className="px-5 pb-5 space-y-4" style={{ borderTop: "1px solid hsl(var(--border))" }}>
                      {/* Remarks */}
                      <div className="pt-4">
                        {editingRemarks === proto.id ? (
                          <div className="flex gap-2 items-start">
                            <textarea
                              className="flex-1 rounded-xl border border-input bg-background px-3 py-2 text-sm resize-none"
                              rows={2}
                              value={remarksText}
                              onChange={(e) => setRemarksText(e.target.value)}
                            />
                            <button onClick={() => saveRemarks(proto.id)} className="p-2 rounded-xl bg-primary/10 text-primary"><Check className="w-4 h-4" /></button>
                            <button onClick={() => setEditingRemarks(null)} className="p-2 rounded-xl bg-accent text-muted-foreground"><X className="w-4 h-4" /></button>
                          </div>
                        ) : (
                          <button
                            onClick={() => { setEditingRemarks(proto.id); setRemarksText(proto.remarks ?? ""); }}
                            className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            {proto.remarks || "Add remarks…"}
                          </button>
                        )}
                      </div>

                      {/* Timeline summary */}
                      <div className="flex flex-wrap gap-2">
                        {groups.map((g, i) => (
                          <div key={i} className="rounded-2xl bg-accent/50 px-3 py-2 text-xs">
                            <span className="font-bold text-foreground">W{g.start}{g.end > g.start ? `–${g.end}` : ""}</span>
                            <span className="ml-2 font-mono text-primary font-bold">{g.pattern}</span>
                            {g.push && <span className="ml-1.5 text-amber-500">⚡+{g.pushPattern} ({g.pushDays}d)</span>}
                            <span className="ml-2 text-muted-foreground">{formatTime24to12(g.lmod)} → {formatTime24to12(g.fmod)}</span>
                          </div>
                        ))}
                      </div>

                      {/* Detailed week table */}
                      <div className="rounded-2xl border border-border overflow-hidden">
                        <div className="grid grid-cols-[60px_90px_80px_80px_60px_50px_1fr_50px] gap-0 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground bg-muted px-3 py-2">
                          <span>Week</span>
                          <span>Pattern</span>
                          <span>LMOD</span>
                          <span>FMOD</span>
                          <span>Push</span>
                          <span>Coach</span>
                          <span>Remarks</span>
                          <span></span>
                        </div>
                        <div className="max-h-[400px] overflow-y-auto divide-y divide-border">
                          {weeks.map((w) => {
                            const isEditing = editingWeek === w.id;
                            return (
                              <div key={w.id} className="grid grid-cols-[60px_90px_80px_80px_60px_50px_1fr_50px] gap-0 items-center px-3 py-2 text-sm hover:bg-accent/30 transition-colors">
                                <span className="font-bold text-foreground">{w.week_number}</span>
                                {isEditing ? (
                                  <>
                                    <select
                                      className="rounded-lg border border-input bg-background px-1 py-1 text-xs"
                                      value={editData.fasting_pattern}
                                      onChange={(e) => setEditData({ ...editData, fasting_pattern: e.target.value })}
                                    >
                                      {PATTERNS.map((p) => <option key={p} value={p}>{p}</option>)}
                                    </select>
                                    <input
                                      type="time"
                                      className="rounded-lg border border-input bg-background px-1 py-1 text-xs"
                                      value={editData.lmod_time}
                                      onChange={(e) => setEditData({ ...editData, lmod_time: e.target.value })}
                                    />
                                    <input
                                      type="time"
                                      className="rounded-lg border border-input bg-background px-1 py-1 text-xs"
                                      value={editData.fmod_time}
                                      onChange={(e) => setEditData({ ...editData, fmod_time: e.target.value })}
                                    />
                                    <button
                                      onClick={() => setEditData({ ...editData, metabolic_push: !editData.metabolic_push })}
                                      className={`w-6 h-6 rounded-lg flex items-center justify-center ${editData.metabolic_push ? "bg-amber-500/20 text-amber-500" : "bg-muted text-muted-foreground"}`}
                                    >
                                      <Zap className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      onClick={() => setEditData({ ...editData, requires_coach_guidance: !editData.requires_coach_guidance })}
                                      className={`w-6 h-6 rounded-lg flex items-center justify-center ${editData.requires_coach_guidance ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"}`}
                                    >
                                      <Shield className="w-3.5 h-3.5" />
                                    </button>
                                    <input
                                      className="rounded-lg border border-input bg-background px-2 py-1 text-xs w-full"
                                      value={editData.remarks ?? ""}
                                      onChange={(e) => setEditData({ ...editData, remarks: e.target.value })}
                                      placeholder="Remarks"
                                    />
                                    <div className="flex gap-1">
                                      <button onClick={() => saveEdit(w.id)} className="p-1 rounded-lg bg-primary/10 text-primary"><Check className="w-3.5 h-3.5" /></button>
                                      <button onClick={() => setEditingWeek(null)} className="p-1 rounded-lg bg-accent text-muted-foreground"><X className="w-3.5 h-3.5" /></button>
                                    </div>
                                  </>
                                ) : (
                                  <>
                                    <span className="font-mono font-bold text-primary">{w.fasting_pattern}</span>
                                    <span className="text-muted-foreground flex items-center gap-1"><Clock className="w-3 h-3" />{formatTime24to12(w.lmod_time)}</span>
                                    <span className="text-muted-foreground flex items-center gap-1"><Clock className="w-3 h-3" />{formatTime24to12(w.fmod_time)}</span>
                                    <span>{w.metabolic_push ? <Zap className="w-4 h-4 text-amber-500" /> : <span className="text-muted-foreground">—</span>}</span>
                                    <span>{w.requires_coach_guidance ? <Shield className="w-4 h-4 text-primary" /> : <span className="text-muted-foreground">—</span>}</span>
                                    <span className="text-xs text-muted-foreground truncate">{w.remarks || "—"}</span>
                                    <button onClick={() => startEdit(w)} className="p-1 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors">
                                      <Edit3 className="w-3.5 h-3.5" />
                                    </button>
                                  </>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Rules section */}
                      <div className="grid md:grid-cols-2 gap-3">
                        <div className="rounded-2xl bg-primary/5 p-4">
                          <h4 className="text-xs font-bold text-primary uppercase tracking-wider mb-2">✅ Allowed During Fast</h4>
                          <ul className="space-y-1">
                            {proto.allowed_items.map((item, i) => (
                              <li key={i} className="text-sm text-foreground">{item}</li>
                            ))}
                          </ul>
                        </div>
                        <div className="rounded-2xl bg-destructive/5 p-4">
                          <h4 className="text-xs font-bold text-destructive uppercase tracking-wider mb-2">🚫 Avoid During Fast</h4>
                          <ul className="space-y-1">
                            {proto.avoid_items.map((item, i) => (
                              <li key={i} className="text-sm text-foreground">{item}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>

      {/* ═══ BADGE MANAGEMENT (mapped to protocols) ═══ */}
      <div className="space-y-4">
        <div>
          <h2 className="text-2xl font-black text-foreground flex items-center gap-2">
            <Award className="w-6 h-6 text-primary" /> Fasting Badges by Plan
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Each plan has a master badge and stage badges tied to its pattern phases. Milestones = weeks in each phase.
          </p>
        </div>

        {protocols.map((proto) => {
          const master = badges.find((b) => b.protocol_id === proto.id && b.badge_type === "master");
          const stages = badges
            .filter((b) => b.protocol_id === proto.id && b.badge_type === "stage")
            .sort((a, b) => (a.stage_order ?? 0) - (b.stage_order ?? 0));
          const Icon = typeIcons[proto.protocol_type] ?? Timer;

          const renderEditor = (b: FastingBadge) => (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <input
                  className="w-14 text-center text-xl rounded-lg border border-input bg-background px-1 py-1"
                  value={badgeEdit.badge_emoji ?? ""}
                  onChange={(e) => setBadgeEdit({ ...badgeEdit, badge_emoji: e.target.value })}
                  maxLength={4}
                />
                <input
                  className="flex-1 rounded-lg border border-input bg-background px-2 py-1 text-sm font-bold"
                  value={badgeEdit.badge_name ?? ""}
                  onChange={(e) => setBadgeEdit({ ...badgeEdit, badge_name: e.target.value })}
                  placeholder="Badge name"
                />
              </div>
              <textarea
                className="w-full rounded-lg border border-input bg-background px-2 py-1 text-xs resize-none"
                rows={2}
                value={badgeEdit.description ?? ""}
                onChange={(e) => setBadgeEdit({ ...badgeEdit, description: e.target.value })}
                placeholder="Description"
              />
              <div className="flex gap-1">
                <button onClick={() => saveBadgeEdit(b.id)} className="flex-1 py-1.5 rounded-lg bg-primary text-primary-foreground font-bold text-xs flex items-center justify-center gap-1">
                  <Check className="w-3.5 h-3.5" /> Save
                </button>
                <button onClick={() => setEditingBadge(null)} className="px-3 py-1.5 rounded-lg bg-accent text-muted-foreground font-semibold text-xs">
                  Cancel
                </button>
              </div>
            </div>
          );

          return (
            <div key={proto.id} className="liquid-glass rounded-3xl p-5 space-y-4">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${typeColors[proto.protocol_type]}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{typeLabels[proto.protocol_type]} · {proto.total_weeks} weeks</p>
                  <p className="text-sm font-black text-foreground truncate">{proto.protocol_name}</p>
                </div>
              </div>

              {/* Master badge */}
              {master && (
                <div className="rounded-2xl border-2 border-primary/30 bg-primary/5 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-primary">Master badge</span>
                    <button
                      onClick={() => startBadgeEdit(master)}
                      className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  {editingBadge === master.id ? (
                    renderEditor(master)
                  ) : (
                    <div className="flex items-start gap-3">
                      <div className="text-4xl leading-none">{master.badge_emoji}</div>
                      <div className="flex-1">
                        <p className="text-base font-black text-foreground">{master.badge_name}</p>
                        <p className="text-xs text-muted-foreground mt-1">{master.description}</p>
                        <p className="text-[10px] text-primary font-bold mt-2 uppercase tracking-wider">
                          {master.milestones_required} weekly milestones · {stages.length} stages
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Stage badges */}
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
                  Stage badges ({stages.length})
                </p>
                <div className="grid gap-3 md:grid-cols-2">
                  {stages.map((s) => {
                    const isEditing = editingBadge === s.id;
                    const weeksInStage = (s.week_range_end ?? 0) - (s.week_range_start ?? 0) + 1;
                    return (
                      <div key={s.id} className="rounded-2xl border border-border bg-card p-3 space-y-2">
                        {isEditing ? renderEditor(s) : (
                          <>
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="text-2xl leading-none">{s.badge_emoji}</span>
                                <div className="min-w-0">
                                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                                    Stage {s.stage_order} · {s.pattern}
                                  </p>
                                  <p className="text-sm font-black text-foreground truncate">{s.badge_name}</p>
                                </div>
                              </div>
                              <button
                                onClick={() => startBadgeEdit(s)}
                                className="p-1 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors shrink-0"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                            <p className="text-[11px] text-muted-foreground line-clamp-2">{s.description}</p>
                            <div className="flex flex-wrap gap-1">
                              <span className="rounded-full bg-primary/10 text-primary px-2 py-0.5 font-bold text-[10px]">
                                W{s.week_range_start}–{s.week_range_end}
                              </span>
                            </div>
                            <StageMilestoneEditor badgeId={s.id} totalWeeks={weeksInStage} />
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
