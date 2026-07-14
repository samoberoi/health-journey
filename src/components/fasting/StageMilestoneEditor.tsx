import { useEffect, useState } from "react";
import { Plus, Trash2, Check, X, Edit3 } from "lucide-react";
import { toast } from "sonner";
import {
  fetchStageMilestones,
  upsertStageMilestone,
  deleteStageMilestone,
  type FastingStageMilestone,
} from "@/lib/streakService";
import { useConfirm } from "@/components/ConfirmProvider";

interface Props {
  badgeId: string;
  totalWeeks?: number;
}

export default function StageMilestoneEditor({ badgeId, totalWeeks }: Props) {
  const confirm = useConfirm();
  const [items, setItems] = useState<FastingStageMilestone[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Partial<FastingStageMilestone>>({});
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      setItems(await fetchStageMilestones(badgeId));
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [badgeId]);

  const startEdit = (m: FastingStageMilestone) => {
    setEditingId(m.id);
    setDraft({
      name: m.name,
      description: m.description,
      milestone_order: m.milestone_order,
      compliant_days_required: m.compliant_days_required,
    });
  };

  const startNew = () => {
    const nextOrder = (items[items.length - 1]?.milestone_order ?? 0) + 1;
    setEditingId("__new__");
    setDraft({
      name: `Milestone ${nextOrder}`,
      description: "",
      milestone_order: nextOrder,
      compliant_days_required: nextOrder * 7,
    });
  };

  const save = async () => {
    if (!draft.name?.trim()) { toast.error("Name required"); return; }
    setBusy(true);
    try {
      await upsertStageMilestone({
        id: editingId === "__new__" ? undefined : editingId!,
        badge_id: badgeId,
        name: draft.name!,
        description: draft.description ?? null,
        milestone_order: Number(draft.milestone_order) || 1,
        compliant_days_required: Number(draft.compliant_days_required) || 1,
      });
      toast.success("Milestone saved");
      setEditingId(null);
      await load();
    } catch (e: any) {
      toast.error(e.message);
    }
    setBusy(false);
  };

  const remove = async (id: string) => {
    if (!(await confirm({ title: "Delete milestone?", description: "This cannot be undone.", destructive: true, confirmText: "Delete" }))) return;
    try {
      await deleteStageMilestone(id);
      toast.success("Deleted");
      await load();
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <div className="mt-3 rounded-xl border border-dashed border-border p-3 space-y-2 bg-background/50">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          Milestones ({items.length}){totalWeeks ? ` · ${totalWeeks} week${totalWeeks > 1 ? "s" : ""} in stage` : ""}
        </p>
        <button
          onClick={startNew}
          className="text-[10px] font-bold uppercase tracking-wider text-primary hover:underline flex items-center gap-1"
        >
          <Plus className="w-3 h-3" /> Add milestone
        </button>
      </div>

      {items.length === 0 && editingId !== "__new__" && (
        <p className="text-[11px] text-muted-foreground italic">No milestones yet. Add one to gate this stage badge.</p>
      )}

      <div className="space-y-1.5">
        {items.map((m) => {
          const isEditing = editingId === m.id;
          if (isEditing) return renderEditor(m.id);
          return (
            <div key={m.id} className="flex items-center gap-2 rounded-lg bg-card border border-border px-2.5 py-1.5">
              <span className="w-6 h-6 rounded-md bg-primary/10 text-primary text-[11px] font-black flex items-center justify-center shrink-0">
                {m.milestone_order}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-foreground truncate">{m.name}</p>
                {m.description && <p className="text-[10px] text-muted-foreground truncate">{m.description}</p>}
              </div>
              <span className="text-[10px] font-bold text-muted-foreground shrink-0">{m.compliant_days_required}d</span>
              <button onClick={() => startEdit(m)} className="p-1 rounded-md hover:bg-accent text-muted-foreground">
                <Edit3 className="w-3 h-3" />
              </button>
              <button onClick={() => remove(m.id)} className="p-1 rounded-md hover:bg-destructive/10 text-destructive">
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          );
        })}
        {editingId === "__new__" && renderEditor("__new__")}
      </div>
    </div>
  );

  function renderEditor(_id: string) {
    return (
      <div className="rounded-lg border border-primary/30 bg-primary/5 p-2 space-y-1.5">
        <div className="flex gap-1.5">
          <input
            type="number"
            min={1}
            className="w-12 rounded-md border border-input bg-background px-1 py-1 text-xs text-center"
            value={draft.milestone_order ?? 1}
            onChange={(e) => setDraft({ ...draft, milestone_order: parseInt(e.target.value) || 1 })}
            placeholder="#"
          />
          <input
            className="flex-1 rounded-md border border-input bg-background px-2 py-1 text-xs font-bold"
            value={draft.name ?? ""}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            placeholder="Milestone name (e.g. Foundation Faster)"
          />
          <div className="flex items-center gap-1">
            <input
              type="number"
              min={1}
              className="w-12 rounded-md border border-input bg-background px-1 py-1 text-xs text-center"
              value={draft.compliant_days_required ?? 7}
              onChange={(e) => setDraft({ ...draft, compliant_days_required: parseInt(e.target.value) || 1 })}
            />
            <span className="text-[10px] text-muted-foreground">days</span>
          </div>
        </div>
        <input
          className="w-full rounded-md border border-input bg-background px-2 py-1 text-xs"
          value={draft.description ?? ""}
          onChange={(e) => setDraft({ ...draft, description: e.target.value })}
          placeholder="Short description (optional)"
        />
        <div className="flex gap-1">
          <button disabled={busy} onClick={save} className="flex-1 py-1 rounded-md bg-primary text-primary-foreground text-[11px] font-bold flex items-center justify-center gap-1">
            <Check className="w-3 h-3" /> Save
          </button>
          <button onClick={() => setEditingId(null)} className="px-3 py-1 rounded-md bg-accent text-muted-foreground text-[11px] font-bold">
            <X className="w-3 h-3" />
          </button>
        </div>
      </div>
    );
  }
}
