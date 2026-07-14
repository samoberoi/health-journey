import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Sparkles, Trash2, RotateCcw, Save, ChevronDown, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import {
  RBAC_MODULES,
  RBAC_ACTIONS,
  ADMIN_SUBJECT,
  COACH_SUBJECT,
  CHANNEL_PARTNER_SUBJECT,
  buildPackageSubject,
  type RbacAction,
  type RbacSubject,
} from "@/lib/rbacModules";
import {
  fetchPermissionsForSubject,
  upsertPermissionsForSubject,
  permKey,
  type PermissionRow,
} from "@/lib/rbacService";
import { logAudit } from "@/lib/auditLog";
import ExportCsvButton from "@/components/admin/ExportCsvButton";

type PermMap = Record<string, { can_view: boolean; can_edit: boolean; can_delete: boolean }>;

function emptyMap(): PermMap {
  const m: PermMap = {};
  for (const mod of RBAC_MODULES) {
    m[permKey(mod.id, null)] = { can_view: false, can_edit: false, can_delete: false };
    for (const sub of mod.subModules) {
      m[permKey(mod.id, sub.id)] = { can_view: false, can_edit: false, can_delete: false };
    }
  }
  return m;
}

function fullMap(): PermMap {
  const m = emptyMap();
  for (const k of Object.keys(m)) m[k] = { can_view: true, can_edit: true, can_delete: true };
  return m;
}

function hydrate(rows: Record<string, PermissionRow>): PermMap {
  const m = emptyMap();
  for (const [k, row] of Object.entries(rows)) {
    if (m[k]) m[k] = { can_view: row.can_view, can_edit: row.can_edit, can_delete: row.can_delete };
  }
  return m;
}

export default function AdminRBAC() {
  const [subjects, setSubjects] = useState<RbacSubject[]>([COACH_SUBJECT, CHANNEL_PARTNER_SUBJECT, ADMIN_SUBJECT]);
  const [subjectId, setSubjectId] = useState<string>(ADMIN_SUBJECT.id);
  const [perms, setPerms] = useState<PermMap>(emptyMap());
  const [original, setOriginal] = useState<PermMap>(emptyMap());
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Load enabled packages → build subject list: [...packages, Coach, Super Admin].
  useEffect(() => {
    (async () => {
      const { data } = await (supabase as any)
        .from("packages")
        .select("plan_key, name, tagline, enabled, sort_order")
        .eq("enabled", true)
        .order("sort_order", { ascending: true });
      const pkgSubjects = ((data ?? []) as any[]).map(buildPackageSubject);
      const next = [...pkgSubjects, COACH_SUBJECT, CHANNEL_PARTNER_SUBJECT, ADMIN_SUBJECT];
      setSubjects(next);
      // Default to first package if available, else admin.
      setSubjectId((prev) => (next.find((s) => s.id === prev) ? prev : next[0]?.id ?? ADMIN_SUBJECT.id));
    })();
  }, []);

  const subject = useMemo(
    () => subjects.find((s) => s.id === subjectId) ?? ADMIN_SUBJECT,
    [subjects, subjectId]
  );
  const isAdminSubject = subject.kind === "admin";

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const rows = await fetchPermissionsForSubject(subject);
        if (cancelled) return;
        const next = isAdminSubject ? fullMap() : hydrate(rows);
        setPerms(next);
        setOriginal(next);
      } catch {
        toast.error("Failed to load permissions");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [subject, isAdminSubject]);

  const dirty = useMemo(() => JSON.stringify(perms) !== JSON.stringify(original), [perms, original]);

  const setCell = (module: string, sub: string | null, action: RbacAction, val: boolean) => {
    if (isAdminSubject) return;
    const key = permKey(module, sub);
    setPerms((prev) => {
      const next = { ...prev, [key]: { ...prev[key], [`can_${action}` as const]: val } };
      const mod = RBAC_MODULES.find((m) => m.id === module);
      if (mod && sub === null && mod.subModules.length > 0) {
        for (const s of mod.subModules) {
          const sk = permKey(module, s.id);
          next[sk] = { ...next[sk], [`can_${action}` as const]: val };
        }
      }
      return next;
    });
  };

  const groupState = (moduleId: string, action: RbacAction): "all" | "none" | "partial" => {
    const mod = RBAC_MODULES.find((m) => m.id === moduleId)!;
    if (mod.subModules.length === 0) {
      return perms[permKey(moduleId, null)]?.[`can_${action}` as const] ? "all" : "none";
    }
    const vals = mod.subModules.map((s) => !!perms[permKey(moduleId, s.id)]?.[`can_${action}` as const]);
    if (vals.every(Boolean)) return "all";
    if (vals.every((v) => !v)) return "none";
    return "partial";
  };

  const grantFullAccess = () => !isAdminSubject && setPerms(fullMap());
  const revokeAll = () => !isAdminSubject && setPerms(emptyMap());
  const resetChanges = () => setPerms(original);

  const save = async () => {
    if (isAdminSubject || !dirty) return;
    setSaving(true);
    try {
      const rows: Omit<PermissionRow, "role" | "package_key">[] = [];
      for (const mod of RBAC_MODULES) {
        const keys: { sub: string | null }[] = [{ sub: null }, ...mod.subModules.map((s) => ({ sub: s.id }))];
        for (const { sub } of keys) {
          const p = perms[permKey(mod.id, sub)];
          rows.push({
            module: mod.id,
            sub_module: sub,
            can_view: p.can_view,
            can_edit: p.can_edit,
            can_delete: p.can_delete,
          });
        }
      }
      await upsertPermissionsForSubject(subject, rows);
      setOriginal(perms);
      toast.success("Permissions saved");
      logAudit({ module: "Access Control", action: "update", target_type: subject.kind, target_id: subject.kind === "package" ? subject.packageKey : subject.role, target_label: subject.label });
    } catch {
      toast.error("Failed to save permissions");
    } finally {
      setSaving(false);
    }
  };

  const SubjectIcon = subject.icon;
  const packageSubjects = subjects.filter((s) => s.kind === "package");
  const otherSubjects = subjects.filter((s) => s.kind !== "package");

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-foreground">Role-Based Access Control</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Configure what each package, coaches, and super admins can see and do.
          </p>
        </div>
        <ExportCsvButton
          filename={`rbac-${subjectId}`}
          rows={() =>
            Object.entries(perms).map(([key, p]) => ({
              subject: subjectId,
              key,
              can_view: p.can_view,
              can_edit: p.can_edit,
              can_delete: p.can_delete,
            }))
          }
        />
      </div>

      {/* Subject pills: packages first, then Coach, Super Admin */}
      <div className="space-y-3">
        {packageSubjects.length > 0 && (
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
              Packages
            </div>
            <div className="flex flex-wrap gap-2">
              {packageSubjects.map((s) => {
                const Icon = s.icon;
                const active = s.id === subjectId;
                return (
                  <motion.button
                    key={s.id}
                    onClick={() => setSubjectId(s.id)}
                    whileTap={{ scale: 0.98 }}
                    className={cn(
                      "inline-flex items-center gap-2 h-10 px-5 rounded-full text-sm font-semibold transition-colors",
                      active
                        ? "bg-[var(--bbdo-blue)] text-white shadow-card"
                        : "bg-white border border-[var(--bbdo-blue)] text-[var(--bbdo-blue)] hover:bg-[var(--bbdo-blue-soft)]"
                    )}
                  >
                    <Icon className="w-4 h-4" />
                    {s.label}
                  </motion.button>
                );
              })}
            </div>
          </div>
        )}
        <div>
          <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
            Platform roles
          </div>
          <div className="flex flex-wrap gap-2">
            {otherSubjects.map((s) => {
              const Icon = s.icon;
              const active = s.id === subjectId;
              return (
                <motion.button
                  key={s.id}
                  onClick={() => setSubjectId(s.id)}
                  whileTap={{ scale: 0.98 }}
                  className={cn(
                    "inline-flex items-center gap-2 h-10 px-5 rounded-full text-sm font-semibold transition-colors",
                    active
                      ? "bg-[var(--bbdo-blue)] text-white shadow-card"
                      : "bg-white border border-[var(--bbdo-blue)] text-[var(--bbdo-blue)] hover:bg-[var(--bbdo-blue-soft)]"
                  )}
                >
                  <Icon className="w-4 h-4" />
                  {s.label}
                </motion.button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Subject header card */}
      <div className="rounded-2xl bg-white shadow-card p-5 flex flex-col lg:flex-row lg:items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-[var(--bbdo-blue-soft)] flex items-center justify-center shrink-0">
          <SubjectIcon className="w-6 h-6 text-[var(--bbdo-blue)]" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-black text-foreground">{subject.label}</h2>
          <p className="text-sm text-muted-foreground">{subject.description}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={grantFullAccess} disabled={isAdminSubject}>
            <Sparkles className="w-4 h-4" /> Grant full access
          </Button>
          <Button variant="outline" size="sm" onClick={revokeAll} disabled={isAdminSubject}>
            <Trash2 className="w-4 h-4" /> Revoke all
          </Button>
          <Button variant="outline" size="sm" onClick={resetChanges} disabled={!dirty}>
            <RotateCcw className="w-4 h-4" /> Reset
          </Button>
          <Button size="sm" onClick={save} disabled={!dirty || saving || isAdminSubject}>
            <Save className="w-4 h-4" />
            {saving ? "Saving…" : dirty ? "Save" : "Saved"}
          </Button>
        </div>
      </div>

      {isAdminSubject && (
        <div className="rounded-xl bg-[var(--bbdo-blue-soft)] border border-[var(--bbdo-blue)]/20 px-4 py-3 text-sm text-[var(--bbdo-blue)]">
          Super Admin has unrestricted access to every module. These permissions cannot be modified.
        </div>
      )}

      {/* Permissions table */}
      <div className="rounded-2xl bg-white shadow-card overflow-hidden">
        <div className="grid grid-cols-[1fr_80px_80px_80px] px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground border-b">
          <div>Module</div>
          {RBAC_ACTIONS.map((a) => (
            <div key={a.id} className="text-center">{a.label}</div>
          ))}
        </div>

        {loading ? (
          <div className="p-10 text-center text-muted-foreground text-sm">Loading permissions…</div>
        ) : (
          RBAC_MODULES.map((mod, idx) => {
            const hasChildren = mod.subModules.length > 0;
            const isOpen = expanded[mod.id] ?? true;
            const Icon = mod.icon;
            return (
              <div key={mod.id} className={cn(idx > 0 && "border-t")}>
                <div className="grid grid-cols-[1fr_80px_80px_80px] px-5 py-4 items-center hover:bg-muted/40">
                  <button
                    type="button"
                    onClick={() => hasChildren && setExpanded((e) => ({ ...e, [mod.id]: !isOpen }))}
                    className="flex items-center gap-3 text-left"
                  >
                    {hasChildren ? (
                      <ChevronDown
                        className={cn("w-4 h-4 text-muted-foreground transition-transform", !isOpen && "-rotate-90")}
                      />
                    ) : (
                      <span className="w-4" />
                    )}
                    <div className="w-9 h-9 rounded-lg bg-[var(--bbdo-blue-soft)] flex items-center justify-center">
                      <Icon className="w-4 h-4 text-[var(--bbdo-blue)]" />
                    </div>
                    <div>
                      <div className="font-bold text-foreground text-sm">{mod.label}</div>
                      {hasChildren && (
                        <div className="text-[11px] text-muted-foreground">{mod.subModules.length} sub-modules</div>
                      )}
                    </div>
                  </button>
                  {RBAC_ACTIONS.map((a) => {
                    const state = groupState(mod.id, a.id);
                    return (
                      <div key={a.id} className="flex justify-center">
                        <Toggle
                          state={state}
                          disabled={isAdminSubject}
                          onChange={(val) => {
                            if (hasChildren) {
                              setPerms((prev) => {
                                const next = { ...prev };
                                for (const s of mod.subModules) {
                                  const sk = permKey(mod.id, s.id);
                                  next[sk] = { ...next[sk], [`can_${a.id}` as const]: val };
                                }
                                return next;
                              });
                            } else {
                              setCell(mod.id, null, a.id, val);
                            }
                          }}
                        />
                      </div>
                    );
                  })}
                </div>

                {hasChildren && isOpen && (
                  <div className="bg-muted/20">
                    {mod.subModules.map((sub) => {
                      const k = permKey(mod.id, sub.id);
                      const p = perms[k] ?? { can_view: false, can_edit: false, can_delete: false };
                      return (
                        <div
                          key={sub.id}
                          className="grid grid-cols-[1fr_80px_80px_80px] px-5 py-3 items-center border-t hover:bg-muted/40"
                        >
                          <div className="flex items-center gap-3 pl-11">
                            <span className="w-1.5 h-1.5 rounded-full bg-[var(--bbdo-blue)]/40" />
                            <span className="text-sm text-foreground">{sub.label}</span>
                          </div>
                          {RBAC_ACTIONS.map((a) => (
                            <div key={a.id} className="flex justify-center">
                              <Toggle
                                state={p[`can_${a.id}` as const] ? "all" : "none"}
                                disabled={isAdminSubject}
                                onChange={(val) => setCell(mod.id, sub.id, a.id, val)}
                              />
                            </div>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function Toggle({
  state,
  disabled,
  onChange,
}: {
  state: "all" | "none" | "partial";
  disabled?: boolean;
  onChange: (val: boolean) => void;
}) {
  const active = state === "all";
  const partial = state === "partial";
  return (
    <motion.button
      type="button"
      whileTap={disabled ? {} : { scale: 0.92 }}
      onClick={() => !disabled && onChange(!active)}
      disabled={disabled}
      className={cn(
        "w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors",
        active && "bg-[var(--bbdo-blue)] border-[var(--bbdo-blue)]",
        partial && "bg-[var(--bbdo-blue)]/30 border-[var(--bbdo-blue)]",
        !active && !partial && "border-muted-foreground/40 hover:border-[var(--bbdo-blue)]",
        disabled && "opacity-60 cursor-not-allowed"
      )}
      aria-pressed={active}
    >
      {active && <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />}
      {partial && <span className="w-2 h-0.5 bg-white rounded-full" />}
    </motion.button>
  );
}
