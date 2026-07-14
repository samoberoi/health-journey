import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Trash2, Wheat, Beef, Droplets, Leaf, Flame } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useConfirm } from "@/components/ConfirmProvider";
import { toast } from "sonner";

interface SavedPlate {
  id: string; name: string; items: any[];
  total_carbs_g: number | null; total_protein_g: number | null; total_fat_g: number | null;
  total_fiber_g: number | null; total_calories_kcal: number | null;
  avg_gi: number | null; sugar_spike_risk: string | null; created_at: string;
  snapshot_url: string | null;
}

export default function SavedPlates({ onClose }: { onClose: () => void }) {
  const { user } = useAuth();
  const confirm = useConfirm();
  const [plates, setPlates] = useState<SavedPlate[]>([]);
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase.from("user_plates").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
    const rows = (data as any as SavedPlate[]) || [];
    setPlates(rows);
    setLoading(false);

    const paths = rows.map((r) => r.snapshot_url).filter((p): p is string => !!p);
    if (paths.length) {
      const { data: signed } = await supabase.storage
        .from("plate-snapshots")
        .createSignedUrls(paths, 60 * 60);
      if (signed) {
        const map: Record<string, string> = {};
        signed.forEach((s: any) => { if (s.path && s.signedUrl) map[s.path] = s.signedUrl; });
        setSignedUrls(map);
      }
    }
  };

  useEffect(() => { load(); }, [user]);


  const handleDelete = async (id: string) => {
    const ok = await confirm({ title: "Delete plate?", description: "This cannot be undone.", destructive: true, confirmText: "Delete" });
    if (!ok) return;
    const { error } = await supabase.from("user_plates").delete().eq("id", id);
    if (error) { toast.error("Couldn't delete"); return; }
    toast.success("Plate deleted");
    load();
  };

  return (
    <div className="fixed inset-0 z-50 bg-background overflow-y-auto">
      <header className="px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 flex items-center gap-2 max-w-3xl mx-auto">
        <button onClick={onClose} className="w-10 h-10 -ml-2 rounded-full flex items-center justify-center active:scale-95">
          <ArrowLeft className="w-5 h-5" strokeWidth={2} />
        </button>
        <p className="text-[10px] font-bold tracking-[0.18em] uppercase text-[var(--bbdo-blue)]">My Saved Plates</p>
      </header>

      <div className="max-w-2xl mx-auto px-5 pt-2 pb-32">
        <h1 className="text-2xl font-black text-foreground leading-tight">Your plates</h1>
        <p className="text-sm text-muted-foreground mt-2">Tap to view nutrition or delete.</p>

        {loading ? (
          <div className="mt-6 space-y-3">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-28 rounded-2xl bg-muted animate-pulse" />)}</div>
        ) : plates.length === 0 ? (
          <div className="mt-12 text-center">
            <p className="text-sm text-muted-foreground">No saved plates yet.</p>
            <p className="text-xs text-muted-foreground mt-1">Build one to see it here.</p>
          </div>
        ) : (
          <div className="mt-5 space-y-3">
            <AnimatePresence>
              {plates.map((p, i) => (
                <motion.div
                  key={p.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.97 }}
                  transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1], delay: i * 0.03 }}
                  className="rounded-2xl bg-card border border-border/60 p-4"
                >
                  <div className="flex items-start gap-3">
                    {p.snapshot_url && signedUrls[p.snapshot_url] ? (
                      <img
                        src={signedUrls[p.snapshot_url]}
                        alt={p.name}
                        loading="lazy"
                        className="w-20 h-20 rounded-xl object-cover shrink-0 bg-muted"
                      />
                    ) : (
                      <div className="w-20 h-20 rounded-xl bg-muted shrink-0 flex items-center justify-center text-[10px] text-muted-foreground">
                        No image
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-black text-foreground">{p.name}</p>
                          <p className="text-[11px] text-muted-foreground mt-0.5">
                            {(p.items || []).length} items · {new Date(p.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                          </p>
                        </div>
                        {p.sugar_spike_risk && (
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize shrink-0 ${
                            p.sugar_spike_risk === "low" ? "bg-emerald-500/15 text-emerald-700"
                            : p.sugar_spike_risk === "moderate" ? "bg-amber-500/15 text-amber-700"
                            : "bg-rose-500/15 text-rose-700"
                          }`}>
                            {p.sugar_spike_risk} risk
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-5 gap-2 mt-3">
                    <Tiny icon={Wheat} value={`${p.total_carbs_g ?? 0}g`} label="C" />
                    <Tiny icon={Beef} value={`${p.total_protein_g ?? 0}g`} label="P" />
                    <Tiny icon={Droplets} value={`${p.total_fat_g ?? 0}g`} label="F" />
                    <Tiny icon={Leaf} value={`${p.total_fiber_g ?? 0}g`} label="Fb" />
                    <Tiny icon={Flame} value={`${p.total_calories_kcal ?? 0}`} label="kcal" />
                  </div>

                  <div className="mt-3 flex flex-wrap gap-1">
                    {(p.items || []).slice(0, 6).map((it: any) => (
                      <span key={it.id} className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-muted text-foreground">{it.name}</span>
                    ))}
                    {(p.items || []).length > 6 && (
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground">+{(p.items || []).length - 6}</span>
                    )}
                  </div>

                  <div className="mt-3 flex justify-end">
                    <button
                      onClick={() => handleDelete(p.id)}
                      className="flex items-center gap-1 text-[11px] font-bold text-rose-600 px-2 py-1 rounded-lg hover:bg-rose-500/10"
                    >
                      <Trash2 className="w-3 h-3" strokeWidth={2} /> Delete
                    </button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}

function Tiny({ icon: Icon, value, label }: { icon: any; value: string; label: string }) {
  return (
    <div className="rounded-lg bg-muted/60 px-2 py-1.5 text-center">
      <Icon className="w-3 h-3 mx-auto text-muted-foreground" strokeWidth={2} />
      <p className="text-[11px] font-black text-foreground mt-0.5 leading-none">{value}</p>
      <p className="text-[8px] text-muted-foreground mt-0.5 leading-none">{label}</p>
    </div>
  );
}
