import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Languages, Search, CheckCircle2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { logAudit } from "@/lib/auditLog";
import ExportCsvButton from "@/components/admin/ExportCsvButton";
import { useAppLanguages } from "@/hooks/useAppLanguages";

export default function AdminLanguages() {
  const { languages, loading, reload } = useAppLanguages();
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const filtered = languages.filter((l) => {
    const q = search.toLowerCase().trim();
    if (!q) return true;
    return (
      l.name.toLowerCase().includes(q) ||
      l.native_name.toLowerCase().includes(q) ||
      l.code.toLowerCase().includes(q)
    );
  });

  const enabledCount = languages.filter((l) => l.is_enabled).length;

  const toggle = async (code: string, next: boolean) => {
    const language = languages.find((l) => l.code === code);
    setBusy(code);
    const { error } = await supabase
      .from("app_languages")
      .update({ is_enabled: next })
      .eq("code", code);
    if (error) {
      toast.error("Failed to update: " + error.message);
    } else {
      toast.success(next ? "Language enabled" : "Language disabled");
      logAudit({
        module: "Languages",
        action: next ? "enable" : "disable",
        target_type: "language",
        target_id: code,
        target_label: language?.name || code,
      });
      await reload();
    }
    setBusy(null);
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-3 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-foreground">Languages</h1>
          <p className="text-muted-foreground text-sm">
            {enabledCount} of {languages.length} languages enabled for users
          </p>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative w-full sm:w-60">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search languages…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <ExportCsvButton filename="languages" rows={languages as any} />
        </div>
      </div>

      <div className="space-y-3">
        {filtered.map((l) => (
          <motion.div
            key={l.code}
            layout
            className="liquid-glass rounded-2xl p-4 flex items-center justify-between"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <Languages className="w-5 h-5 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-foreground font-semibold text-sm">
                  {l.name}
                  <span className="text-muted-foreground font-normal ml-2">
                    {l.native_name}
                  </span>
                </p>
                <p className="text-muted-foreground text-xs uppercase tracking-wider">
                  {l.code}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {l.is_enabled && (
                <span className="hidden sm:inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full font-medium bg-emerald-500/10 text-emerald-600">
                  <CheckCircle2 className="w-3 h-3" /> Enabled
                </span>
              )}
              <Switch
                checked={l.is_enabled}
                disabled={busy === l.code}
                onCheckedChange={(v) => toggle(l.code, v)}
              />
            </div>
          </motion.div>
        ))}
        {filtered.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <p>No languages found</p>
          </div>
        )}
      </div>
    </div>
  );
}
