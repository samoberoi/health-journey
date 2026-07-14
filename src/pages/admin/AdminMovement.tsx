import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Footprints,
  Settings2,
  Trophy,
  Award,
  Plus,
  Trash2,
  Save,
  Sparkles,
  TrendingUp,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import {
  MovementBadge,
  MovementConfig,
  MovementLevel,
  computeRecommendedSteps,
  deleteMovementBadge,
  deleteMovementLevel,
  getMovementConfig,
  listMovementBadges,
  listMovementLevels,
  updateMovementConfig,
  upsertMovementBadge,
  upsertMovementLevel,
} from "@/lib/movementService";
import ExportCsvButton from "@/components/admin/ExportCsvButton";

type Tab = "algorithm" | "levels" | "badges" | "simulator";

const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "algorithm", label: "Algorithm", icon: Settings2 },
  { id: "levels", label: "Levels", icon: Trophy },
  { id: "badges", label: "Badges", icon: Award },
  { id: "simulator", label: "Simulator", icon: Sparkles },
];

export default function AdminMovement() {
  const [tab, setTab] = useState<Tab>("algorithm");
  const [config, setConfig] = useState<MovementConfig | null>(null);
  const [levels, setLevels] = useState<MovementLevel[]>([]);
  const [badges, setBadges] = useState<MovementBadge[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    setLoading(true);
    try {
      const [c, l, b] = await Promise.all([
        getMovementConfig(),
        listMovementLevels(),
        listMovementBadges(),
      ]);
      setConfig(c);
      setLevels(l);
      setBadges(b);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to load movement data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-[11px] font-semibold text-primary uppercase tracking-wider">
            <Footprints className="w-3.5 h-3.5" /> Movement Engine
          </div>
          <h2 className="mt-2 text-2xl font-black text-foreground">Steps. Streaks. Status.</h2>
          <p className="text-sm text-muted-foreground mt-1 max-w-xl">
            Configure the algorithm that prescribes daily step goals, builds weekly streaks,
            and crowns users with levels and badges.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex flex-col items-end leading-tight pr-1">
            <div className="text-xl font-black tabular-nums text-foreground">
              {config?.base_daily_steps?.toLocaleString() ?? "—"}
            </div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Base / day</div>
          </div>
          <ExportCsvButton
            filename={`movement-${tab}`}
            rows={() => (tab === "badges" ? badges : tab === "levels" ? levels : config ? [config] : []) as any}
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 border-b">
        {tabs.map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <motion.button
              key={t.id}
              onClick={() => setTab(t.id)}
              whileTap={{ scale: 0.98 }}
              className={cn(
                "inline-flex items-center gap-2 h-10 px-4 -mb-px border-b-2 text-sm font-semibold transition-colors",
                active
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="w-4 h-4" />
              {t.label}
            </motion.button>
          );
        })}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
      ) : (
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
          >
            {tab === "algorithm" && config && (
              <AlgorithmTab config={config} onSaved={refresh} />
            )}
            {tab === "levels" && (
              <LevelsTab levels={levels} onChanged={refresh} />
            )}
            {tab === "badges" && (
              <BadgesTab badges={badges} onChanged={refresh} />
            )}
            {tab === "simulator" && config && (
              <SimulatorTab config={config} levels={levels} />
            )}
          </motion.div>
        </AnimatePresence>
      )}
    </div>
  );
}

/* ============================== ALGORITHM ============================== */

function AlgorithmTab({
  config,
  onSaved,
}: {
  config: MovementConfig;
  onSaved: () => void;
}) {
  const [draft, setDraft] = useState<MovementConfig>(config);
  const [saving, setSaving] = useState(false);

  useEffect(() => setDraft(config), [config]);

  const set = <K extends keyof MovementConfig>(k: K, v: MovementConfig[K]) =>
    setDraft((d) => ({ ...d, [k]: v }));

  const setMod = (
    bucket: "bmi_modifiers" | "activity_modifiers" | "age_modifiers",
    key: string,
    val: number,
  ) =>
    setDraft((d) => ({ ...d, [bucket]: { ...d[bucket], [key]: val } }));

  const save = async () => {
    setSaving(true);
    try {
      await updateMovementConfig(draft.id, {
        is_active: draft.is_active,
        base_daily_steps: Math.max(1000, Number(draft.base_daily_steps) || 5000),
        increment_per_level: Math.max(100, Number(draft.increment_per_level) || 1000),
        max_daily_steps: Math.max(2000, Number(draft.max_daily_steps) || 12000),
        weeks_per_level: Math.max(1, Number(draft.weeks_per_level) || 1),
        min_days_per_week: Math.min(7, Math.max(1, Number(draft.min_days_per_week) || 5)),
        miss_policy: draft.miss_policy,
        bmi_modifiers: draft.bmi_modifiers,
        activity_modifiers: draft.activity_modifiers,
        age_modifiers: draft.age_modifiers,
        notes: draft.notes,
      });
      toast.success("Algorithm saved");
      onSaved();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid lg:grid-cols-3 gap-4">
      {/* Core */}
      <Card className="lg:col-span-2">
        <CardHead title="Core formula" subtitle="The numbers that drive every prescription" />
        <div className="grid sm:grid-cols-2 gap-4 p-5">
          <Field
            label="Base daily steps"
            hint="Starting target for an average user"
            value={draft.base_daily_steps}
            onChange={(v) => set("base_daily_steps", v)}
          />
          <Field
            label="Increment per level"
            hint="Extra daily steps added on level up"
            value={draft.increment_per_level}
            onChange={(v) => set("increment_per_level", v)}
          />
          <Field
            label="Maximum daily steps"
            hint="Hard upper cap on any prescription (e.g. 12,000)"
            value={draft.max_daily_steps ?? 12000}
            onChange={(v) => set("max_daily_steps", v)}
          />

          <Field
            label="Weeks to advance a level"
            hint="Successful weeks required before promotion"
            value={draft.weeks_per_level}
            onChange={(v) => set("weeks_per_level", v)}
          />
          <Field
            label="Min days/week to count"
            hint="Days hitting target needed for a 'successful' week"
            value={draft.min_days_per_week}
            onChange={(v) => set("min_days_per_week", v)}
          />
          <div>
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">
              If user misses a week
            </Label>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {(["hold", "reset", "demote"] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => set("miss_policy", p)}
                  className={cn(
                    "h-10 rounded-xl text-xs font-semibold capitalize border transition-colors",
                    draft.miss_policy === p
                      ? "bg-[#248CCB] text-white border-[#248CCB]"
                      : "bg-background border-border text-muted-foreground hover:text-foreground",
                  )}
                >
                  {p}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1.5">
              Hold = stay; Reset = streak back to zero; Demote = drop one level.
            </p>
          </div>
          <div className="flex items-end justify-between gap-3">
            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                Engine active
              </Label>
              <p className="text-[11px] text-muted-foreground mt-1">
                When off, no new assignments are made.
              </p>
            </div>
            <Switch
              checked={draft.is_active}
              onCheckedChange={(v) => set("is_active", v)}
            />
          </div>
        </div>
      </Card>

      {/* Notes */}
      <Card>
        <CardHead title="Coach notes" subtitle="Internal context for this configuration" />
        <div className="p-5">
          <Textarea
            placeholder="e.g. Tuned for Indian metro lifestyles, post-monsoon cohort…"
            value={draft.notes ?? ""}
            onChange={(e) => set("notes", e.target.value)}
            className="min-h-[160px]"
          />
        </div>
      </Card>

      {/* Modifiers */}
      <ModifierCard
        title="BMI modifiers"
        subtitle="Multipliers by body-mass band"
        keys={["underweight", "normal", "overweight", "obese"]}
        values={draft.bmi_modifiers}
        onChange={(k, v) => setMod("bmi_modifiers", k, v)}
      />
      <ModifierCard
        title="Activity modifiers"
        subtitle="Multipliers by self-reported lifestyle"
        keys={["sedentary", "light", "moderate", "active", "very_active"]}
        values={draft.activity_modifiers}
        onChange={(k, v) => setMod("activity_modifiers", k, v)}
      />
      <ModifierCard
        title="Age modifiers"
        subtitle="Multipliers by age bracket"
        keys={["under_30", "30_45", "45_60", "over_60"]}
        values={draft.age_modifiers}
        onChange={(k, v) => setMod("age_modifiers", k, v)}
      />

      <div className="lg:col-span-3 flex justify-end">
        <Button onClick={save} disabled={saving} className="gap-2">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save algorithm
        </Button>
      </div>
    </div>
  );
}

function ModifierCard({
  title,
  subtitle,
  keys,
  values,
  onChange,
}: {
  title: string;
  subtitle: string;
  keys: string[];
  values: Record<string, number>;
  onChange: (k: string, v: number) => void;
}) {
  return (
    <Card>
      <CardHead title={title} subtitle={subtitle} />
      <div className="p-5 space-y-2.5">
        {keys.map((k) => {
          const v = values?.[k] ?? 1;
          return (
            <div key={k} className="flex items-center gap-3">
              <Label className="text-xs capitalize text-muted-foreground w-28 shrink-0">
                {k.replace(/_/g, " ")}
              </Label>
              <input
                type="range"
                min={0.4}
                max={1.6}
                step={0.05}
                value={v}
                onChange={(e) => onChange(k, parseFloat(e.target.value))}
                className="flex-1 accent-[#248CCB]"
              />
              <div
                className={cn(
                  "w-14 text-right text-xs font-bold tabular-nums",
                  v > 1 ? "text-[#10B981]" : v < 1 ? "text-[#E00101]" : "text-foreground",
                )}
              >
                ×{v.toFixed(2)}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

/* ============================== LEVELS ============================== */

function LevelsTab({
  levels,
  onChanged,
}: {
  levels: MovementLevel[];
  onChanged: () => void;
}) {
  const [editing, setEditing] = useState<Partial<MovementLevel> | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-foreground">Level ladder</h2>
          <p className="text-xs text-muted-foreground">
            Users climb from {levels[0]?.name ?? "First Steps"} to {levels[levels.length - 1]?.name ?? "Legend"}.
          </p>
        </div>
        <Button
          onClick={() =>
            setEditing({
              level_number: (levels[levels.length - 1]?.level_number ?? 0) + 1,
              name: "",
              description: "",
              target_daily_steps: (levels[levels.length - 1]?.target_daily_steps ?? 5000) + 1000,
              badge_icon: "🏃",
              badge_color: "#248CCB",
              accent_color: "#248CCB",
              is_active: true,
            })
          }
          className="gap-2"
          size="sm"
        >
          <Plus className="w-4 h-4" /> Add level
        </Button>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {levels.map((lv, i) => (
          <motion.button
            key={lv.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, delay: Math.min(i, 5) * 0.04, ease: [0.22, 1, 0.36, 1] }}
            whileHover={{ y: -1 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setEditing(lv)}
            className="text-left rounded-2xl bg-card border shadow-card hover:shadow-lift transition-shadow overflow-hidden"
          >
            <div
              className="h-1.5 w-full"
              style={{ background: lv.accent_color }}
            />
            <div className="p-4 flex items-start gap-3">
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shrink-0"
                style={{ background: `${lv.badge_color}1a`, color: lv.badge_color }}
              >
                <Footprints className="w-5 h-5" strokeWidth={1.75} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">
                    Lv {lv.level_number}
                  </span>
                  {!lv.is_active && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                      off
                    </span>
                  )}
                </div>
                <div className="font-bold text-foreground truncate">{lv.name}</div>
                <div className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                  {lv.description}
                </div>
                <div className="mt-2 text-sm font-semibold tabular-nums" style={{ color: lv.accent_color }}>
                  {lv.target_daily_steps.toLocaleString()} <span className="text-xs font-medium text-muted-foreground">steps/day</span>
                </div>
              </div>
            </div>
          </motion.button>
        ))}
      </div>

      <LevelEditor
        value={editing}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          onChanged();
        }}
      />
    </div>
  );
}

function LevelEditor({
  value,
  onClose,
  onSaved,
}: {
  value: Partial<MovementLevel> | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [draft, setDraft] = useState<Partial<MovementLevel>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (value) setDraft(value);
  }, [value]);

  if (!value) return null;
  const set = <K extends keyof MovementLevel>(k: K, v: MovementLevel[K]) =>
    setDraft((d) => ({ ...d, [k]: v }));

  const save = async () => {
    if (!draft.name || !draft.target_daily_steps) {
      toast.error("Name and steps required");
      return;
    }
    setBusy(true);
    try {
      await upsertMovementLevel(draft);
      toast.success("Level saved");
      onSaved();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed");
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!draft.id) return;
    setBusy(true);
    try {
      await deleteMovementLevel(draft.id);
      toast.success("Level removed");
      onSaved();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.16 }}
        className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ y: 24, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 16, opacity: 0 }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-lg bg-card rounded-3xl shadow-lift overflow-hidden"
        >
          <div className="p-5 border-b flex items-center justify-between">
            <h3 className="font-bold text-foreground">
              {draft.id ? "Edit level" : "New level"}
            </h3>
            <Switch
              checked={!!draft.is_active}
              onCheckedChange={(v) => set("is_active", v)}
            />
          </div>
          <div className="p-5 grid grid-cols-2 gap-3">
            <Field label="Level #" value={draft.level_number ?? 1} onChange={(v) => set("level_number", v)} />
            <Field label="Target steps/day" value={draft.target_daily_steps ?? 5000} onChange={(v) => set("target_daily_steps", v)} />
            <div className="col-span-2">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Name</Label>
              <Input
                value={draft.name ?? ""}
                onChange={(e) => set("name", e.target.value)}
                className="mt-1.5"
                placeholder="e.g. Trailblazer"
              />
            </div>
            <div className="col-span-2">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Description</Label>
              <Textarea
                value={draft.description ?? ""}
                onChange={(e) => set("description", e.target.value)}
                className="mt-1.5 min-h-[70px]"
              />
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Icon</Label>
              <Input
                value={draft.badge_icon ?? "🏃"}
                onChange={(e) => set("badge_icon", e.target.value)}
                className="mt-1.5 text-center text-2xl"
              />
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Accent color</Label>
              <Input
                type="color"
                value={draft.accent_color ?? "#248CCB"}
                onChange={(e) => {
                  set("accent_color", e.target.value);
                  set("badge_color", e.target.value);
                }}
                className="mt-1.5 h-10 p-1"
              />
            </div>
          </div>
          <div className="px-5 py-4 border-t flex items-center justify-between">
            {draft.id ? (
              <Button variant="ghost" size="sm" onClick={remove} className="text-[#E00101]">
                <Trash2 className="w-4 h-4 mr-2" /> Delete
              </Button>
            ) : <div />}
            <div className="flex gap-2">
              <Button variant="ghost" onClick={onClose}>Cancel</Button>
              <Button onClick={save} disabled={busy} className="gap-2">
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Save
              </Button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

/* ============================== BADGES ============================== */

function BadgesTab({
  badges,
  onChanged,
}: {
  badges: MovementBadge[];
  onChanged: () => void;
}) {
  const [editing, setEditing] = useState<Partial<MovementBadge> | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-foreground">Badges</h2>
          <p className="text-xs text-muted-foreground">
            Rewards unlocked by streaks and level milestones.
          </p>
        </div>
        <Button
          onClick={() =>
            setEditing({
              code: "",
              name: "",
              description: "",
              icon: "🏅",
              color: "#F59E0B",
              criteria: { type: "weeks_completed", count: 1 },
              is_active: true,
            })
          }
          className="gap-2"
          size="sm"
        >
          <Plus className="w-4 h-4" /> Add badge
        </Button>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {badges.map((b) => (
          <motion.button
            key={b.id}
            whileHover={{ y: -1 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setEditing(b)}
            className="text-left rounded-2xl bg-card border shadow-card hover:shadow-lift transition-shadow p-4 flex items-start gap-3"
          >
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shrink-0"
              style={{ background: `${b.color}1a`, color: b.color }}
            >
              <Footprints className="w-5 h-5" strokeWidth={1.75} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-bold text-foreground truncate">{b.name}</div>
              <div className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{b.description}</div>
              <div className="mt-2 text-[10px] uppercase tracking-wider font-bold" style={{ color: b.color }}>
                {criteriaLabel(b.criteria)}
              </div>
            </div>
          </motion.button>
        ))}
      </div>

      <BadgeEditor
        value={editing}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          onChanged();
        }}
      />
    </div>
  );
}

function criteriaLabel(c: any): string {
  if (!c?.type) return "Custom criteria";
  if (c.type === "weeks_completed") return `${c.count} week${c.count > 1 ? "s" : ""} completed`;
  if (c.type === "streak") return `${c.weeks}-week streak`;
  if (c.type === "level_reached") return `Reach level ${c.level}`;
  return c.type;
}

function BadgeEditor({
  value,
  onClose,
  onSaved,
}: {
  value: Partial<MovementBadge> | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [draft, setDraft] = useState<Partial<MovementBadge>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (value) setDraft(value);
  }, [value]);

  if (!value) return null;
  const set = <K extends keyof MovementBadge>(k: K, v: MovementBadge[K]) =>
    setDraft((d) => ({ ...d, [k]: v }));

  const ctype = (draft.criteria as any)?.type ?? "weeks_completed";
  const setC = (patch: Record<string, unknown>) =>
    set("criteria", { ...(draft.criteria as any), ...patch });

  const save = async () => {
    if (!draft.code || !draft.name) {
      toast.error("Code and name required");
      return;
    }
    setBusy(true);
    try {
      await upsertMovementBadge(draft);
      toast.success("Badge saved");
      onSaved();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed");
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!draft.id) return;
    setBusy(true);
    try {
      await deleteMovementBadge(draft.id);
      toast.success("Badge removed");
      onSaved();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.16 }}
        className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ y: 24, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 16, opacity: 0 }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-lg bg-card rounded-3xl shadow-lift overflow-hidden"
        >
          <div className="p-5 border-b flex items-center justify-between">
            <h3 className="font-bold text-foreground">{draft.id ? "Edit badge" : "New badge"}</h3>
            <Switch checked={!!draft.is_active} onCheckedChange={(v) => set("is_active", v)} />
          </div>
          <div className="p-5 grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Code</Label>
              <Input
                value={draft.code ?? ""}
                onChange={(e) => set("code", e.target.value.toLowerCase().replace(/\s+/g, "_"))}
                className="mt-1.5"
                placeholder="iron_streak"
              />
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Name</Label>
              <Input
                value={draft.name ?? ""}
                onChange={(e) => set("name", e.target.value)}
                className="mt-1.5"
                placeholder="Iron Streak"
              />
            </div>
            <div className="col-span-2">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Description</Label>
              <Textarea
                value={draft.description ?? ""}
                onChange={(e) => set("description", e.target.value)}
                className="mt-1.5 min-h-[60px]"
              />
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Icon</Label>
              <Input
                value={draft.icon ?? "🏅"}
                onChange={(e) => set("icon", e.target.value)}
                className="mt-1.5 text-center text-2xl"
              />
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Color</Label>
              <Input
                type="color"
                value={draft.color ?? "#F59E0B"}
                onChange={(e) => set("color", e.target.value)}
                className="mt-1.5 h-10 p-1"
              />
            </div>
            <div className="col-span-2 rounded-xl bg-muted/40 p-3 space-y-2">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Criteria</Label>
              <div className="grid grid-cols-3 gap-2">
                {(["weeks_completed", "streak", "level_reached"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setC({ type: t })}
                    className={cn(
                      "h-9 text-[11px] rounded-lg font-semibold border",
                      ctype === t
                        ? "bg-[#248CCB] text-white border-[#248CCB]"
                        : "bg-background border-border text-muted-foreground",
                    )}
                  >
                    {t.replace(/_/g, " ")}
                  </button>
                ))}
              </div>
              {ctype === "weeks_completed" && (
                <Field
                  label="Total weeks completed"
                  value={(draft.criteria as any)?.count ?? 1}
                  onChange={(v) => setC({ count: v })}
                />
              )}
              {ctype === "streak" && (
                <Field
                  label="Consecutive weeks"
                  value={(draft.criteria as any)?.weeks ?? 4}
                  onChange={(v) => setC({ weeks: v })}
                />
              )}
              {ctype === "level_reached" && (
                <Field
                  label="Level number"
                  value={(draft.criteria as any)?.level ?? 2}
                  onChange={(v) => setC({ level: v })}
                />
              )}
            </div>
          </div>
          <div className="px-5 py-4 border-t flex items-center justify-between">
            {draft.id ? (
              <Button variant="ghost" size="sm" onClick={remove} className="text-[#E00101]">
                <Trash2 className="w-4 h-4 mr-2" /> Delete
              </Button>
            ) : <div />}
            <div className="flex gap-2">
              <Button variant="ghost" onClick={onClose}>Cancel</Button>
              <Button onClick={save} disabled={busy} className="gap-2">
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Save
              </Button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

/* ============================== SIMULATOR ============================== */

function SimulatorTab({
  config,
  levels,
}: {
  config: MovementConfig;
  levels: MovementLevel[];
}) {
  const [bmi, setBmi] = useState("normal");
  const [activity, setActivity] = useState("moderate");
  const [age, setAge] = useState(38);
  const [weightKg, setWeightKg] = useState<number>(72);
  const [heightCm, setHeightCm] = useState<number>(168);

  const derivedBmi = useMemo(() => {
    if (!weightKg || !heightCm) return null;
    const m = heightCm / 100;
    const v = weightKg / (m * m);
    const band =
      v < 18.5 ? "underweight" : v < 25 ? "normal" : v < 30 ? "overweight" : "obese";
    return { value: v, band };
  }, [weightKg, heightCm]);

  // Keep the BMI picker in sync with weight/height so the derived band is
  // visible, but a manual pick always wins on the next compute.
  useEffect(() => {
    if (derivedBmi?.band) setBmi(derivedBmi.band);
  }, [derivedBmi?.band]);

  const recommended = useMemo(
    () =>
      computeRecommendedSteps(config, {
        bmiCategory: bmi,
        activityLevel: activity,
        age,
        // Intentionally omit weight/height: the picker (auto-synced from
        // derived BMI) is the single source of truth so clicking a band
        // immediately changes the number.
      }),
    [config, bmi, activity, age],
  );
  const startLevel = useMemo(() => {
    let chosen = levels[0];
    for (const l of levels) {
      if (recommended >= l.target_daily_steps) chosen = l;
    }
    return chosen;
  }, [levels, recommended]);

  return (
    <div className="grid lg:grid-cols-2 gap-4">
      <Card>
        <CardHead title="User profile" subtitle="Try different lifestyles" />
        <div className="p-5 space-y-4">
          <div className="rounded-2xl border-2 border-primary/30 bg-primary/5 p-4 flex items-center justify-between">
            <div>
              <div className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">
                Recommended daily steps
              </div>
              <div className="text-3xl font-black tabular-nums text-primary mt-0.5">
                {recommended.toLocaleString()}
              </div>
              <div className="text-[11px] text-muted-foreground">
                Base {config.base_daily_steps.toLocaleString()} × BMI × activity × age
              </div>
            </div>
            <Footprints className="w-10 h-10 text-primary/40" strokeWidth={1.5} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Weight (kg)" value={weightKg} onChange={setWeightKg} />
            <Field label="Height (cm)" value={heightCm} onChange={setHeightCm} />
          </div>
          {derivedBmi && (
            <div className="rounded-xl bg-muted/50 px-3 py-2 text-xs text-muted-foreground flex items-center justify-between">
              <span>
                Derived BMI <b className="text-foreground tabular-nums">{derivedBmi.value.toFixed(1)}</b>
              </span>
              <span className="capitalize font-semibold text-foreground">{derivedBmi.band}</span>
            </div>
          )}
          <Picker
            label="BMI band (used if weight/height blank)"
            options={["underweight", "normal", "overweight", "obese"]}
            value={bmi}
            onChange={setBmi}
          />
          <Picker
            label="Activity level"
            options={["sedentary", "light", "moderate", "active", "very_active"]}
            value={activity}
            onChange={setActivity}
          />
          <div>
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Age</Label>
            <input
              type="range"
              min={18}
              max={80}
              value={age}
              onChange={(e) => setAge(parseInt(e.target.value))}
              className="w-full mt-2 accent-primary"
            />
            <div className="text-sm font-bold tabular-nums mt-1">{age} yrs</div>
          </div>
        </div>
      </Card>

      <Card>
        <CardHead title="Prescription" subtitle="What this user would be assigned" />
        <div className="p-5 space-y-4">
          <div className="rounded-2xl bg-gradient-to-br from-[#248CCB] to-[#E00101] p-5 text-white">
            <div className="text-xs uppercase tracking-wider opacity-80 flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5" /> Daily target
            </div>
            <div className="text-4xl font-black tabular-nums mt-1">
              {recommended.toLocaleString()}
            </div>
            <div className="text-xs opacity-80 mt-1">steps / day for {config.min_days_per_week} of 7 days</div>
          </div>
          {startLevel && (
            <div
              className="rounded-2xl border p-4 flex items-center gap-3"
              style={{ borderColor: `${startLevel.accent_color}40` }}
            >
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl"
                style={{ background: `${startLevel.badge_color}1a`, color: startLevel.badge_color }}
              >
                <Footprints className="w-6 h-6" strokeWidth={1.75} />
              </div>
              <div className="flex-1">
                <div className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">
                  Starting level
                </div>
                <div className="font-black text-foreground">{startLevel.name}</div>
                <div className="text-xs text-muted-foreground">{startLevel.description}</div>
              </div>
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            On miss policy <b className="capitalize">{config.miss_policy}</b>, a user who fails to
            hit {config.min_days_per_week} qualifying days in a week will{" "}
            {config.miss_policy === "hold"
              ? "stay at their current level."
              : config.miss_policy === "reset"
                ? "have their streak reset to zero."
                : "drop one level."}
          </p>
        </div>
      </Card>
    </div>
  );
}

/* ============================== PRIMITIVES ============================== */

function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-3xl bg-card border shadow-card overflow-hidden", className)}>
      {children}
    </div>
  );
}
function CardHead({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="p-5 pb-3">
      <div className="font-bold text-foreground">{title}</div>
      {subtitle && <div className="text-xs text-muted-foreground mt-0.5">{subtitle}</div>}
    </div>
  );
}
function Field({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <Label className="text-xs uppercase tracking-wider text-muted-foreground">{label}</Label>
      <Input
        type="number"
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value || "0", 10))}
        className="mt-1.5 font-bold tabular-nums"
      />
      {hint && <p className="text-[11px] text-muted-foreground mt-1">{hint}</p>}
    </div>
  );
}
function Picker({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <Label className="text-xs uppercase tracking-wider text-muted-foreground">{label}</Label>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {options.map((o) => (
          <button
            key={o}
            onClick={() => onChange(o)}
            className={cn(
              "h-8 px-3 rounded-full text-xs font-semibold capitalize border transition-colors",
              value === o
                ? "bg-[#248CCB] text-white border-[#248CCB]"
                : "bg-background border-border text-muted-foreground hover:text-foreground",
            )}
          >
            {o.replace(/_/g, " ")}
          </button>
        ))}
      </div>
    </div>
  );
}
