import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { useConfirm } from "@/components/ConfirmProvider";
import { logAudit } from "@/lib/auditLog";
import ExportCsvButton from "@/components/admin/ExportCsvButton";
import ImportCsvButton from "@/components/admin/ImportCsvButton";
import { Plus, Pencil, Trash2, Search, HeartPulse, Check, ChevronsUpDown } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";

type Action = "avoid" | "limit" | "encourage";
type ConditionKey =
  | "hypothyroid" | "hyperthyroid" | "pcos" | "ckd"
  | "uric_acid"   | "fatty_liver" | "iron_deficiency";

interface Rule {
  id: string;
  condition_key: ConditionKey;
  action: Action;
  name_pattern: string;
  filter_id: string | null;
  reason: string;
  priority: number;
  is_active: boolean;
  updated_at?: string;
}

interface FilterRow { id: string; name: string; slug: string; }
interface FoodOption { id: string; name: string; }

const CONDITIONS: { key: ConditionKey; label: string; emoji: string }[] = [
  { key: "hypothyroid",     label: "Hypothyroidism",  emoji: "🦋" },
  { key: "hyperthyroid",    label: "Hyperthyroidism", emoji: "🦋" },
  { key: "pcos",            label: "PCOS",            emoji: "🌸" },
  { key: "ckd",             label: "Kidney Disease",  emoji: "🫘" },
  { key: "uric_acid",       label: "High Uric Acid",  emoji: "🧪" },
  { key: "fatty_liver",     label: "Fatty Liver",     emoji: "🫀" },
  { key: "iron_deficiency", label: "Iron Deficiency", emoji: "🩸" },
];

const ACTIONS: { value: Action; label: string; cls: string }[] = [
  { value: "avoid",     label: "Avoid",     cls: "bg-destructive/10 text-destructive border-destructive/30" },
  { value: "limit",     label: "Limit",     cls: "bg-amber-500/10 text-amber-600 border-amber-500/30" },
  { value: "encourage", label: "Encourage", cls: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30" },
];

const emptyForm = (): Omit<Rule, "id" | "updated_at"> => ({
  condition_key: "hypothyroid",
  action: "avoid",
  name_pattern: "",
  filter_id: null,
  reason: "",
  priority: 100,
  is_active: true,
});

export default function AdminFoodConditionRules() {
  const confirm = useConfirm();
  const [rules, setRules] = useState<Rule[]>([]);
  const [filters, setFilters] = useState<FilterRow[]>([]);
  const [foods, setFoods] = useState<FoodOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [conditionFilter, setConditionFilter] = useState<"all" | ConditionKey>("all");
  const [actionFilter, setActionFilter] = useState<"all" | Action>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Rule | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [foodPickerOpen, setFoodPickerOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    const [rRes, fRes, foodRes] = await Promise.all([
      supabase.from("food_condition_rules").select("*").order("condition_key").order("priority", { ascending: false }),
      supabase.from("food_filters").select("id,name,slug").order("name"),
      supabase.from("food_items").select("id,name").order("name"),
    ]);
    setRules(((rRes.data as any[]) || []) as Rule[]);
    setFilters(((fRes.data as any[]) || []) as FilterRow[]);
    setFoods(((foodRes.data as any[]) || []) as FoodOption[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filterById = useMemo(() => new Map(filters.map((f) => [f.id, f])), [filters]);
  const conditionByKey = useMemo(() => new Map(CONDITIONS.map((c) => [c.key, c])), []);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rules.filter((r) => {
      if (conditionFilter !== "all" && r.condition_key !== conditionFilter) return false;
      if (actionFilter !== "all" && r.action !== actionFilter) return false;
      if (!q) return true;
      return (
        r.name_pattern.toLowerCase().includes(q) ||
        r.reason.toLowerCase().includes(q)
      );
    });
  }, [rules, search, conditionFilter, actionFilter]);

  const countsByCondition = useMemo(() => {
    const map: Record<string, number> = {};
    rules.forEach((r) => { map[r.condition_key] = (map[r.condition_key] || 0) + 1; });
    return map;
  }, [rules]);

  const openNew = () => { setEditing(null); setForm(emptyForm()); setDialogOpen(true); };
  const openEdit = (r: Rule) => {
    setEditing(r);
    setForm({
      condition_key: r.condition_key, action: r.action,
      name_pattern: r.name_pattern, filter_id: r.filter_id,
      reason: r.reason, priority: r.priority, is_active: r.is_active,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name_pattern.trim()) { toast.error("Food name pattern is required"); return; }
    if (!form.reason.trim()) { toast.error("Reason is required"); return; }
    const payload = {
      condition_key: form.condition_key,
      action: form.action,
      name_pattern: form.name_pattern.trim().toLowerCase(),
      filter_id: form.filter_id || null,
      reason: form.reason.trim(),
      priority: Number(form.priority) || 100,
      is_active: form.is_active,
    };
    if (editing) {
      const { error } = await supabase.from("food_condition_rules").update(payload).eq("id", editing.id);
      if (error) { toast.error(error.message); return; }
      logAudit({ module: "Diet", action: "update", target_type: "rule", target_id: editing.id, target_label: `${payload.condition_key}: ${payload.name_pattern}` });
      toast.success("Rule updated");
    } else {
      const { error } = await supabase.from("food_condition_rules").insert(payload);
      if (error) { toast.error(error.message); return; }
      logAudit({ module: "Diet", action: "create", target_type: "rule", target_label: `${payload.condition_key}: ${payload.name_pattern}` });
      toast.success("Rule created");
    }
    setDialogOpen(false);
    load();
  };

  const handleDelete = async (r: Rule) => {
    const ok = await confirm({
      title: "Delete rule?",
      description: `Remove "${r.name_pattern}" for ${conditionByKey.get(r.condition_key)?.label}?`,
      confirmText: "Delete",
      
    });
    if (!ok) return;
    const { error } = await supabase.from("food_condition_rules").delete().eq("id", r.id);
    if (error) { toast.error(error.message); return; }
    logAudit({ module: "Diet", action: "delete", target_type: "rule", target_id: r.id, target_label: `${r.condition_key}: ${r.name_pattern}` });
    toast.success("Deleted");
    load();
  };

  const toggleActive = async (r: Rule) => {
    const { error } = await supabase.from("food_condition_rules").update({ is_active: !r.is_active }).eq("id", r.id);
    if (error) { toast.error(error.message); return; }
    load();
  };

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <HeartPulse className="w-6 h-6 text-primary" />
            Food ↔ Condition Rules
          </h2>
          <p className="text-muted-foreground text-sm">
            Tag foods to auto-flag <b>avoid</b>, <b>limit</b>, or <b>encourage</b> for users with specific
            clinical conditions. {rules.length} total rules.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ExportCsvButton filename="food_condition_rules" rows={rules as any} />
<ImportCsvButton table="food_condition_rules" onImported={() => window.location.reload()} />
          <Button onClick={openNew}><Plus className="w-4 h-4 mr-2" />Add Rule</Button>
        </div>
      </div>

      {/* Condition summary chips */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setConditionFilter("all")}
          className={`px-3 py-1.5 rounded-full text-sm border transition ${
            conditionFilter === "all" ? "bg-primary text-primary-foreground border-primary" : "bg-card hover:bg-muted"
          }`}
        >
          All · {rules.length}
        </button>
        {CONDITIONS.map((c) => (
          <button
            key={c.key}
            onClick={() => setConditionFilter(c.key)}
            className={`px-3 py-1.5 rounded-full text-sm border transition ${
              conditionFilter === c.key ? "bg-primary text-primary-foreground border-primary" : "bg-card hover:bg-muted"
            }`}
          >
            {c.emoji} {c.label} · {countsByCondition[c.key] || 0}
          </button>
        ))}
      </div>

      {/* Search + action filter */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search food pattern or reason..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={actionFilter} onValueChange={(v) => setActionFilter(v as any)}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All actions</SelectItem>
            {ACTIONS.map((a) => <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="rounded-xl border bg-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Condition</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Food pattern</TableHead>
              <TableHead>Scope (filter)</TableHead>
              <TableHead>Reason</TableHead>
              <TableHead className="text-center">Priority</TableHead>
              <TableHead className="text-center">Active</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
            ) : visible.length === 0 ? (
              <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No rules match</TableCell></TableRow>
            ) : visible.map((r) => {
              const cond = conditionByKey.get(r.condition_key);
              const act = ACTIONS.find((a) => a.value === r.action)!;
              return (
                <TableRow key={r.id} className={r.is_active ? "" : "opacity-50"}>
                  <TableCell><Badge variant="outline">{cond?.emoji} {cond?.label || r.condition_key}</Badge></TableCell>
                  <TableCell><Badge variant="outline" className={act.cls}>{act.label}</Badge></TableCell>
                  <TableCell className="font-mono text-sm">{r.name_pattern}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {r.filter_id ? filterById.get(r.filter_id)?.name || "—" : <span className="italic">All foods</span>}
                  </TableCell>
                  <TableCell className="text-sm max-w-[360px]"><span className="line-clamp-2">{r.reason}</span></TableCell>
                  <TableCell className="text-center">{r.priority}</TableCell>
                  <TableCell className="text-center">
                    <Switch checked={r.is_active} onCheckedChange={() => toggleActive(r)} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(r)}><Pencil className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(r)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Rule" : "Add Food ↔ Condition Rule"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label>Condition *</Label>
                <Select value={form.condition_key} onValueChange={(v) => setForm((f) => ({ ...f, condition_key: v as ConditionKey }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CONDITIONS.map((c) => (
                      <SelectItem key={c.key} value={c.key}>{c.emoji} {c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Action *</Label>
                <Select value={form.action} onValueChange={(v) => setForm((f) => ({ ...f, action: v as Action }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ACTIONS.map((a) => <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>Food *</Label>
              <Popover open={foodPickerOpen} onOpenChange={setFoodPickerOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    role="combobox"
                    aria-expanded={foodPickerOpen}
                    className={cn(
                      "w-full justify-between font-normal",
                      !form.name_pattern && "text-muted-foreground",
                    )}
                  >
                    {form.name_pattern
                      ? (foods.find((fd) => fd.name.toLowerCase() === form.name_pattern.toLowerCase())?.name
                          ?? form.name_pattern)
                      : "Pick a food from the master list…"}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="p-0 w-[--radix-popover-trigger-width]" align="start">
                  <Command>
                    <CommandInput placeholder="Search foods…" />
                    <CommandList className="max-h-72">
                      <CommandEmpty>No food found. Add it in Foods first.</CommandEmpty>
                      <CommandGroup>
                        {foods.map((fd) => {
                          const selected = form.name_pattern.toLowerCase() === fd.name.toLowerCase();
                          return (
                            <CommandItem
                              key={fd.id}
                              value={fd.name}
                              onSelect={() => {
                                setForm((f) => ({ ...f, name_pattern: fd.name }));
                                setFoodPickerOpen(false);
                              }}
                            >
                              <Check className={cn("mr-2 h-4 w-4", selected ? "opacity-100" : "opacity-0")} />
                              {fd.name}
                            </CommandItem>
                          );
                        })}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              <p className="text-xs text-muted-foreground mt-1">
                Only foods from the master Foods list can be mapped. {foods.length} foods available.
              </p>
            </div>


            <div>
              <Label>Scope to filter (optional)</Label>
              <Select
                value={form.filter_id || "__all__"}
                onValueChange={(v) => setForm((f) => ({ ...f, filter_id: v === "__all__" ? null : v }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All food filters</SelectItem>
                  {filters.map((f) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Reason (shown to user) *</Label>
              <Textarea
                rows={2}
                value={form.reason}
                onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
                placeholder="e.g. High iodine — avoid with hypothyroidism"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
              <div>
                <Label>Priority</Label>
                <Input
                  type="number"
                  value={form.priority}
                  onChange={(e) => setForm((f) => ({ ...f, priority: Number(e.target.value) }))}
                />
                <p className="text-xs text-muted-foreground mt-1">Higher wins when multiple rules of the same action match.</p>
              </div>
              <div className="flex items-center gap-2 pb-2">
                <Switch checked={form.is_active} onCheckedChange={(v) => setForm((f) => ({ ...f, is_active: v }))} />
                <Label>Active</Label>
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave}>{editing ? "Update" : "Create"}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
