import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Plus, Pencil, Trash2, Link2, Users, User, Video, CalendarPlus, Clock, CalendarDays,
} from "lucide-react";
import {
  fetchTemplatesForPackage,
  saveTemplateWithInstances,
  deleteTemplate,
  copyTemplateToNextMonth,
  formatDays,
  DAY_SHORT,
  type SlotTemplate,
} from "@/lib/channelPartnerService";
import { useConfirm } from "@/components/ConfirmProvider";

interface DraftTemplate {
  id?: string;
  label: string;
  time_of_day: string; // "HH:MM"
  duration_min: number;
  days_of_week: number[];
  start_date: string; // YYYY-MM-DD
  weeks_count: number;
  meet_link: string;
  capacity: number;
  notes: string;
  is_active: boolean;
}

function firstOfMonth(): string {
  const d = new Date();
  d.setDate(1);
  return d.toISOString().slice(0, 10);
}

function emptyDraft(defaults: { duration: number; capacity: number; type: "group" | "private" }, label: string): DraftTemplate {
  return {
    label,
    time_of_day: "07:00",
    duration_min: defaults.duration,
    days_of_week: [1, 3, 5], // Mon/Wed/Fri
    start_date: firstOfMonth(),
    weeks_count: 4,
    meet_link: "",
    capacity: defaults.type === "private" ? 1 : defaults.capacity,
    notes: "",
    is_active: true,
  };
}

function toDraft(t: SlotTemplate): DraftTemplate {
  return {
    id: t.id,
    label: t.label,
    time_of_day: t.time_of_day.slice(0, 5),
    duration_min: t.duration_min,
    days_of_week: t.days_of_week,
    start_date: t.start_date,
    weeks_count: t.weeks_count,
    meet_link: t.meet_link ?? "",
    capacity: t.capacity,
    notes: t.notes ?? "",
    is_active: t.is_active,
  };
}

export default function PackageSlotsManager({
  partnerId,
  packageId,
  packageType,
  packageName,
  defaultCapacity,
  defaultDurationMin,
  onChanged,
}: {
  partnerId: string;
  packageId: string;
  packageType: "group" | "private";
  packageName: string;
  defaultCapacity?: number;
  defaultDurationMin?: number;
  onChanged?: () => void;
}) {
  const confirm = useConfirm();
  const [templates, setTemplates] = useState<SlotTemplate[]>([]);
  const [instanceCounts, setInstanceCounts] = useState<Record<string, number>>({});
  const [bookedCounts, setBookedCounts] = useState<Record<string, number>>({});
  const [capacityTotals, setCapacityTotals] = useState<Record<string, number>>({});
  const [templateInstances, setTemplateInstances] = useState<Record<string, any[]>>({});
  const [templateBookings, setTemplateBookings] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState(true);
  const [dialog, setDialog] = useState<{ open: boolean; draft: DraftTemplate | null }>({ open: false, draft: null });
  const [monthOffset, setMonthOffset] = useState(0); // 0 = this month, 1 = next, ...
  const [detailTemplate, setDetailTemplate] = useState<SlotTemplate | null>(null);

  const load = async () => {
    setLoading(true);
    const tmpl = await fetchTemplatesForPackage(packageId);
    setTemplates(tmpl);
    const ids = tmpl.map((t) => t.id);
    const counts: Record<string, number> = {};
    const booked: Record<string, number> = {};
    const capacity: Record<string, number> = {};
    const instMap: Record<string, any[]> = {};
    const bookingsMap: Record<string, any[]> = {};
    if (ids.length) {
      const { data: instances } = await supabase
        .from("channel_partner_slots" as any)
        .select("id, template_id, scheduled_at, capacity, booked_count")
        .in("template_id", ids)
        .order("scheduled_at", { ascending: true });
      const instanceRows = ((instances as any) ?? []) as any[];
      const instanceIds: string[] = [];
      instanceRows.forEach((r) => {
        counts[r.template_id] = (counts[r.template_id] ?? 0) + 1;
        booked[r.template_id] = (booked[r.template_id] ?? 0) + (r.booked_count ?? 0);
        capacity[r.template_id] = (capacity[r.template_id] ?? 0) + (r.capacity ?? 0);
        if (!instMap[r.template_id]) instMap[r.template_id] = [];
        instMap[r.template_id].push(r);
        instanceIds.push(r.id);
      });
      if (instanceIds.length) {
        const { data: bookings } = await supabase
          .from("yoga_bookings" as any)
          .select("id, user_id, slot_id, template_id, status, selected_slot, preferred_time, starts_on, expires_on")
          .or(`template_id.in.(${ids.join(",")}),slot_id.in.(${instanceIds.join(",")})`);
        const bookingRows = ((bookings as any) ?? []) as any[];
        const bookingIds = bookingRows.map((b) => b.id);
        const { data: bookedInstances } = bookingIds.length
          ? await supabase
              .from("yoga_booking_instances" as any)
              .select("booking_id, slot_id")
              .in("booking_id", bookingIds)
          : { data: [] as any[] };
        const reservedByBooking = new Map<string, Set<string>>();
        ((bookedInstances as any) ?? []).forEach((row: any) => {
          if (!reservedByBooking.has(row.booking_id)) reservedByBooking.set(row.booking_id, new Set());
          reservedByBooking.get(row.booking_id)!.add(row.slot_id);
        });
        const userIds = Array.from(new Set(bookingRows.map((b) => b.user_id))).filter(Boolean);
        let profileMap = new Map<string, any>();
        if (userIds.length) {
          const { data: profiles } = await supabase
            .from("profiles" as any)
            .select("user_id, name, phone")
            .in("user_id", userIds);
          ((profiles as any) ?? []).forEach((p: any) => profileMap.set(p.user_id, p));
        }
        // Attach profile info + template_id to each booking via its recurring template or anchor slot.
        const slotToTemplate = new Map<string, string>();
        instanceRows.forEach((r) => slotToTemplate.set(r.id, r.template_id));
        bookingRows.forEach((b) => {
          if (["cancelled", "completed"].includes(String(b.status))) return;
          const templateId = b.template_id ?? slotToTemplate.get(b.slot_id);
          if (!templateId) return;
          if (!bookingsMap[templateId]) bookingsMap[templateId] = [];
          const prof = profileMap.get(b.user_id);
          bookingsMap[templateId].push({
            ...b,
            booked_slot_ids: Array.from(reservedByBooking.get(b.id) ?? []),
            user_name: prof?.name ?? "Subscriber",
            user_phone: prof?.phone ?? null,
          });
        });
      }
    }
    setInstanceCounts(counts);
    setBookedCounts(booked);
    setCapacityTotals(capacity);
    setTemplateInstances(instMap);
    setTemplateBookings(bookingsMap);
    setLoading(false);
  };


  useEffect(() => { load(); }, [packageId]);

  const nextLabel = useMemo(() => `Slot ${templates.length + 1}`, [templates.length]);

  const openNew = () => {
    const now = new Date();
    const first = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
    const startDate = first.toISOString().slice(0, 10);
    setDialog({
      open: true,
      draft: {
        ...emptyDraft(
          { duration: defaultDurationMin ?? 60, capacity: defaultCapacity ?? 10, type: packageType },
          nextLabel,
        ),
        start_date: startDate,
      },
    });
  };

  const save = async () => {
    const d = dialog.draft;
    if (!d) return;
    if (!d.label.trim()) return toast.error("Give this slot a name (e.g. Slot 1)");
    if (!d.days_of_week.length) return toast.error("Pick at least one weekday");
    if (!d.start_date) return toast.error("Pick a start date");
    if (d.weeks_count < 1) return toast.error("Weeks must be at least 1");
    try {
      await saveTemplateWithInstances({
        id: d.id,
        partner_id: partnerId,
        package_id: packageId,
        package_type: packageType,
        label: d.label.trim(),
        time_of_day: `${d.time_of_day}:00`,
        duration_min: d.duration_min,
        days_of_week: d.days_of_week,
        start_date: d.start_date,
        weeks_count: d.weeks_count,
        meet_link: d.meet_link.trim() || null,
        capacity: packageType === "private" ? 1 : d.capacity,
        notes: d.notes.trim() || null,
        is_active: d.is_active,
      });
      toast.success(d.id ? "Slot updated" : "Slot created with classes");
      setDialog({ open: false, draft: null });
      await load();
      onChanged?.();
    } catch (e: any) {
      toast.error(e.message ?? "Save failed");
    }
  };

  const remove = async (t: SlotTemplate) => {
    if (!(await confirm({ title: "Delete slot?", description: `Delete "${t.label}" and all its unbooked classes?`, destructive: true, confirmText: "Delete" }))) return;
    try {
      await deleteTemplate(t.id);
      toast.success("Slot deleted");
      await load();
      onChanged?.();
    } catch (e: any) {
      toast.error(e.message ?? "Delete failed");
    }
  };

  const copyNext = async (t: SlotTemplate) => {
    try {
      await copyTemplateToNextMonth(t);
      toast.success(`${t.label} copied to next month`);
      await load();
      onChanged?.();
    } catch (e: any) {
      toast.error(e.message ?? "Copy failed");
    }
  };

  const toggleDay = (day: number) => {
    if (!dialog.draft) return;
    const has = dialog.draft.days_of_week.includes(day);
    const next = has ? dialog.draft.days_of_week.filter((x) => x !== day) : [...dialog.draft.days_of_week, day];
    setDialog({ open: true, draft: { ...dialog.draft, days_of_week: next } });
  };

  const monthLabel = (d: string) =>
    new Date(`${d}T00:00:00`).toLocaleDateString([], { month: "short", year: "numeric" });

  const timeLabel = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    const period = h >= 12 ? "PM" : "AM";
    const hh = ((h + 11) % 12) + 1;
    return `${hh}:${String(m).padStart(2, "0")} ${period}`;
  };

  // Month filter: build 3 tabs (this / next / +2 months)
  const monthTabs = useMemo(() => {
    const now = new Date();
    return [0, 1, 2].map((off) => {
      const d = new Date(now.getFullYear(), now.getMonth() + off, 1);
      return {
        offset: off,
        key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
        label: d.toLocaleString([], { month: "short", year: "numeric" }),
      };
    });
  }, []);

  const activeMonthKey = monthTabs[monthOffset]?.key;
  const templateHasInstancesInMonth = (templateId: string, monthKey: string) => {
    const rows = templateInstances[templateId] ?? [];
    return rows.some((r: any) => {
      const d = new Date(r.scheduled_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      return key === monthKey;
    });
  };
  const filteredTemplates = useMemo(
    () => templates.filter(
      (t) =>
        templateHasInstancesInMonth(t.id, activeMonthKey) ||
        t.start_date.slice(0, 7) === activeMonthKey,
    ),
    [templates, activeMonthKey, templateInstances],
  );

  return (
    <div className="mt-3 pt-3 border-t">
      <div className="flex items-center justify-between mb-2 gap-2">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
          {packageType === "group" ? <Users className="w-3.5 h-3.5" /> : <User className="w-3.5 h-3.5" />}
          Recurring slots ({filteredTemplates.length})
        </div>
        <Button size="sm" variant="ghost" onClick={openNew}>
          <Plus className="w-3.5 h-3.5 mr-1" /> Add slot
        </Button>
      </div>

      <div className="flex gap-1 mb-2 overflow-x-auto">
        {monthTabs.map((m) => {
          const count = templates.filter(
            (t) => templateHasInstancesInMonth(t.id, m.key) || t.start_date.slice(0, 7) === m.key,
          ).length;
          const active = m.offset === monthOffset;
          return (
            <button
              key={m.key}
              type="button"
              onClick={() => setMonthOffset(m.offset)}
              className={`px-3 py-1 rounded-full text-[11px] font-bold whitespace-nowrap transition-colors ${
                active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/70"
              }`}
            >
              {m.offset === 0 ? "This month" : m.offset === 1 ? "Next month" : m.label}
              <span className={`ml-1 ${active ? "opacity-80" : "opacity-60"}`}>· {count}</span>
            </button>
          );
        })}
      </div>

      {loading ? (
        <p className="text-xs text-muted-foreground">Loading slots…</p>
      ) : filteredTemplates.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">
          No slots for {monthTabs[monthOffset]?.label}. {monthOffset > 0 && "Use \"Copy to next month\" on an existing slot, or add one."}
        </p>
      ) : (
        <div className="space-y-2">
          {filteredTemplates.map((t) => {
            const count = instanceCounts[t.id] ?? 0;
            const bookedTotal = bookedCounts[t.id] ?? 0;
            const capacityTotal = capacityTotals[t.id] ?? 0;
            const fullyBooked = capacityTotal > 0 && bookedTotal >= capacityTotal;
            const partiallyBooked = bookedTotal > 0 && !fullyBooked;
            return (
              <div
                key={t.id}
                onClick={() => setDetailTemplate(t)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && setDetailTemplate(t)}
                className={`rounded-xl border px-3 py-2.5 cursor-pointer transition-colors hover:bg-accent/40 ${
                  fullyBooked
                    ? "border-destructive/50 bg-destructive/5"
                    : partiallyBooked
                    ? "border-emerald-500/40 bg-emerald-500/5"
                    : ""
                }`}
              >
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <span className="font-black text-sm text-foreground">{t.label}</span>
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="w-3 h-3" /> {timeLabel(t.time_of_day.slice(0, 5))}
                      </span>
                      <span className="text-xs text-muted-foreground">({formatDays(t.days_of_week)})</span>
                      <span className="text-xs text-muted-foreground">· {t.duration_min}m</span>
                      {fullyBooked && (
                        <span className="text-[10px] font-bold uppercase tracking-wider bg-destructive/15 text-destructive px-2 py-0.5 rounded-full">
                          {packageType === "private" ? `Recurring slot ${bookedTotal}/${capacityTotal} booked` : "Fully booked"}
                        </span>
                      )}
                      {partiallyBooked && (
                        <span className="text-[10px] font-bold uppercase tracking-wider bg-emerald-500/15 text-emerald-700 px-2 py-0.5 rounded-full">
                          {bookedTotal}/{capacityTotal} booked
                        </span>
                      )}
                      {!t.is_active && <span className="text-[10px] text-muted-foreground">inactive</span>}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1 text-[11px] text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <CalendarDays className="w-3 h-3" /> {monthLabel(t.start_date)} · {t.weeks_count} wk
                      </span>
                      <span className="font-semibold text-foreground/80">{count} upcoming classes</span>
                      <span className="font-semibold text-foreground/80">{bookedTotal}/{capacityTotal} booked</span>
                      <span>Cap {t.capacity}/class</span>
                      {t.meet_link ? (
                        <a href={t.meet_link} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}
                           className="inline-flex items-center gap-1 text-primary font-semibold hover:underline">
                          <Video className="w-3 h-3" /> Meet link
                        </a>
                      ) : (
                        <span className="text-amber-600 font-semibold">No Meet link</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                    <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => copyNext(t)}>
                      <CalendarPlus className="w-3.5 h-3.5 mr-1" /> Copy to next month
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setDialog({ open: true, draft: toDraft(t) })}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => remove(t)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Slot details dialog: instances + who booked each */}
      <Dialog open={!!detailTemplate} onOpenChange={(o) => !o && setDetailTemplate(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {detailTemplate?.label} · {detailTemplate && timeLabel(detailTemplate.time_of_day.slice(0, 5))}{" "}
              ({detailTemplate && formatDays(detailTemplate.days_of_week)})
            </DialogTitle>
          </DialogHeader>
          {detailTemplate && (() => {
            const instances = templateInstances[detailTemplate.id] ?? [];
            const bookings = templateBookings[detailTemplate.id] ?? [];
            const bookingsForInstance = (inst: any) => bookings.filter((b) => {
              if (Array.isArray(b.booked_slot_ids) && b.booked_slot_ids.length > 0) return b.booked_slot_ids.includes(inst.id);
              if (b.slot_id === inst.id) return true;
              if (b.template_id !== detailTemplate.id) return false;
              const day = new Date(inst.scheduled_at);
              day.setHours(0, 0, 0, 0);
              const starts = b.starts_on ? new Date(`${b.starts_on}T00:00:00`) : null;
              const expires = b.expires_on ? new Date(`${b.expires_on}T23:59:59`) : null;
              return (!starts || day >= starts) && (!expires || day <= expires);
            });
            if (!instances.length) {
              return <p className="text-sm text-muted-foreground">No upcoming classes for this slot.</p>;
            }
            return (
              <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                {instances.map((inst) => {
                  const bList = bookingsForInstance(inst);
                  const full = inst.booked_count >= inst.capacity;
                  return (
                    <div key={inst.id} className={`rounded-lg border px-3 py-2 ${full ? "border-destructive/40 bg-destructive/5" : ""}`}>
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="text-sm font-semibold">
                          {new Date(inst.scheduled_at).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}
                        </div>
                        <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                          full ? "bg-destructive/15 text-destructive" : bList.length > 0 ? "bg-emerald-500/15 text-emerald-700" : "bg-muted text-muted-foreground"
                        }`}>
                          {inst.booked_count}/{inst.capacity} {full ? "Full" : "booked"}
                        </span>
                      </div>
                      {bList.length > 0 ? (
                        <div className="mt-1.5 space-y-0.5">
                          {bList.map((b) => (
                            <div key={b.id} className="text-xs text-muted-foreground flex items-center gap-2">
                              <span className="font-semibold text-foreground">{b.user_name}</span>
                              {b.user_phone && <span>· {b.user_phone}</span>}
                              <span className="capitalize">· {String(b.status).replace(/_/g, " ")}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-[11px] text-muted-foreground mt-1 italic">Available — no bookings yet.</p>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })()}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailTemplate(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


      <Dialog open={dialog.open} onOpenChange={(o) => !o && setDialog({ open: false, draft: null })}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{dialog.draft?.id ? "Edit slot" : `New recurring slot · ${packageName}`}</DialogTitle>
          </DialogHeader>
          {dialog.draft && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Slot name</Label>
                  <Input
                    value={dialog.draft.label}
                    onChange={(e) => setDialog({ open: true, draft: { ...dialog.draft!, label: e.target.value } })}
                    placeholder="Slot 1"
                  />
                </div>
                <div>
                  <Label>Time</Label>
                  <Input
                    type="time"
                    value={dialog.draft.time_of_day}
                    onChange={(e) => setDialog({ open: true, draft: { ...dialog.draft!, time_of_day: e.target.value } })}
                  />
                </div>
              </div>

              <div>
                <Label>Days of week</Label>
                <div className="flex gap-1.5 mt-1">
                  {DAY_SHORT.map((s, i) => {
                    const on = dialog.draft!.days_of_week.includes(i);
                    return (
                      <button
                        key={i}
                        type="button"
                        onClick={() => toggleDay(i)}
                        className={`w-9 h-9 rounded-lg text-xs font-black transition-colors ${
                          on ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/70"
                        }`}
                      >
                        {s}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label>Start date</Label>
                  <Input
                    type="date"
                    value={dialog.draft.start_date}
                    onChange={(e) => setDialog({ open: true, draft: { ...dialog.draft!, start_date: e.target.value } })}
                  />
                </div>
                <div>
                  <Label>Weeks</Label>
                  <Input
                    type="number" min={1} max={12}
                    value={dialog.draft.weeks_count}
                    onChange={(e) => setDialog({ open: true, draft: { ...dialog.draft!, weeks_count: Number(e.target.value) } })}
                  />
                </div>
                <div>
                  <Label>Duration (m)</Label>
                  <Input
                    type="number" min={15}
                    value={dialog.draft.duration_min}
                    onChange={(e) => setDialog({ open: true, draft: { ...dialog.draft!, duration_min: Number(e.target.value) } })}
                  />
                </div>
              </div>

              <div>
                <Label className="flex items-center gap-1"><Link2 className="w-3.5 h-3.5" /> Google Meet link (shared for all classes)</Label>
                <Input
                  placeholder="https://meet.google.com/xxx-xxxx-xxx"
                  value={dialog.draft.meet_link}
                  onChange={(e) => setDialog({ open: true, draft: { ...dialog.draft!, meet_link: e.target.value } })}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Capacity {packageType === "private" && "(fixed at 1)"}</Label>
                  <Input
                    type="number" min={1}
                    disabled={packageType === "private"}
                    value={dialog.draft.capacity}
                    onChange={(e) => setDialog({ open: true, draft: { ...dialog.draft!, capacity: Number(e.target.value) } })}
                  />
                </div>
                <div className="flex items-end justify-between">
                  <Label>Active</Label>
                  <Switch
                    checked={dialog.draft.is_active}
                    onCheckedChange={(v) => setDialog({ open: true, draft: { ...dialog.draft!, is_active: v } })}
                  />
                </div>
              </div>

              <div>
                <Label>Notes (optional)</Label>
                <Textarea
                  rows={2}
                  value={dialog.draft.notes}
                  onChange={(e) => setDialog({ open: true, draft: { ...dialog.draft!, notes: e.target.value } })}
                />
              </div>

              <p className="text-[11px] text-muted-foreground">
                This will create {dialog.draft.days_of_week.length * dialog.draft.weeks_count} class{" "}
                {dialog.draft.days_of_week.length * dialog.draft.weeks_count === 1 ? "instance" : "instances"} using the same Meet link.
                Unbooked future classes are regenerated on save.
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog({ open: false, draft: null })}>Cancel</Button>
            <Button onClick={save}>{dialog.draft?.id ? "Save slot" : "Create slot & classes"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
