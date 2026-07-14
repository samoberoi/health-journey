import { useEffect, useMemo, useState } from "react";
import { Loader2, Save, X, FlaskConical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  fetchParametersForProducts,
  fetchUserResults,
  saveResultsForOrder,
  type LabParameter,
  type ResultInput,
} from "@/lib/labResultsService";

interface Props {
  open: boolean;
  onClose: () => void;
  userId: string;
  orderId: string;
  reportId: string | null;
  productCodes: string[];
  collectionDate?: string | null;
  onSaved?: () => void;
}

export default function LabResultsEntry({
  open,
  onClose,
  userId,
  orderId,
  reportId,
  productCodes,
  collectionDate,
  onSaved,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [params, setParams] = useState<LabParameter[]>([]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [observedAt, setObservedAt] = useState<string>(() => {
    const base = collectionDate ? new Date(collectionDate) : new Date();
    return base.toISOString().slice(0, 10);
  });

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    Promise.all([fetchParametersForProducts(productCodes), fetchUserResults(userId)])
      .then(([catalog, results]) => {
        setParams(catalog);
        const orderRows = results.filter((r) => r.order_id === orderId);
        const seed: Record<string, string> = {};
        for (const r of orderRows) {
          seed[r.parameter_code] = r.value_numeric != null ? String(r.value_numeric) : r.value_text || "";
        }
        setValues(seed);
      })
      .catch((e) => {
        console.error(e);
        toast.error("Couldn't load parameters");
      })
      .finally(() => setLoading(false));
  }, [open, productCodes.join(","), userId, orderId]);

  const grouped = useMemo(() => {
    const map: Record<string, LabParameter[]> = {};
    for (const p of params) {
      const g = p.group_name || "OTHER";
      (map[g] = map[g] || []).push(p);
    }
    return Object.entries(map).sort((a, b) => a[0].localeCompare(b[0]));
  }, [params]);

  async function handleSave() {
    setSaving(true);
    try {
      const rows: ResultInput[] = params.map((p) => {
        const raw = (values[p.code] || "").trim();
        const num = raw === "" ? null : Number(raw);
        const isNum = num != null && Number.isFinite(num);
        return {
          parameter_code: p.code,
          parameter_name: p.name,
          value_numeric: isNum ? num : null,
          value_text: !isNum && raw ? raw : null,
          unit: p.unit,
          ref_low: p.ref_low,
          ref_high: p.ref_high,
        };
      });
      await saveResultsForOrder({
        userId,
        orderId,
        reportId,
        observedAt: new Date(observedAt + "T08:00:00").toISOString(),
        source: "manual",
        rows,
      });
      toast.success("Lab results saved");
      onSaved?.();
      onClose();
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "Couldn't save");
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm overflow-y-auto">
      <div className="min-h-dvh flex flex-col">
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 px-4 py-3 border-b border-border bg-background">
          <div className="flex items-center gap-2 min-w-0">
            <FlaskConical className="w-4 h-4 text-primary shrink-0" />
            <div className="min-w-0">
              <div className="text-sm font-black truncate">Enter Lab Results</div>
              <div className="text-[10px] text-muted-foreground">{params.length} parameters</div>
            </div>
          </div>
          <button onClick={onClose} aria-label="Close" className="w-9 h-9 rounded-full liquid-glass flex items-center justify-center">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-4 flex-1">
          <div className="rounded-xl border border-border bg-card p-3">
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Report date</label>
            <Input
              type="date"
              value={observedAt}
              onChange={(e) => setObservedAt(e.target.value)}
              className="mt-1"
            />
            <p className="text-[10px] text-muted-foreground mt-1">
              Used to compare against your baseline and previous report.
            </p>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
              <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Loading parameters…
            </div>
          ) : params.length === 0 ? (
            <div className="rounded-xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
              No parameters found for this package yet.
            </div>
          ) : (
            grouped.map(([group, items]) => (
              <div key={group} className="rounded-2xl border border-border bg-card overflow-hidden">
                <div className="px-3 py-2 text-[10px] font-black uppercase tracking-wider text-primary bg-primary/5 border-b border-border">
                  {group}
                </div>
                <div className="divide-y divide-border">
                  {items.map((p) => (
                    <div key={p.code} className="flex items-center gap-2 px-3 py-2">
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-semibold truncate">{p.name}</div>
                        <div className="text-[10px] text-muted-foreground truncate">
                          {p.code}
                          {p.ref_low != null && p.ref_high != null
                            ? ` · Ref ${p.ref_low}–${p.ref_high}${p.unit ? ` ${p.unit}` : ""}`
                            : p.unit
                              ? ` · ${p.unit}`
                              : ""}
                        </div>
                      </div>
                      <Input
                        className="w-28 text-right tabular-nums"
                        placeholder="—"
                        inputMode="decimal"
                        value={values[p.code] ?? ""}
                        onChange={(e) => setValues((v) => ({ ...v, [p.code]: e.target.value }))}
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>

        <div className="sticky bottom-0 z-10 p-4 border-t border-border bg-background">
          <Button onClick={handleSave} disabled={saving || loading} className="w-full rounded-full">
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Save Results
          </Button>
        </div>
      </div>
    </div>
  );
}
