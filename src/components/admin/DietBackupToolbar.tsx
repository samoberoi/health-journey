import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Archive, Upload, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { exportDietBackup, importDietBackup } from "@/lib/dietBackup";

interface Props {
  onRestored?: () => void;
}

/**
 * Full backup & restore for the Diet Intelligence pillar — every row from
 * every taxonomy/rules table plus every image, packaged into a single ZIP.
 * Restore is a merge-upsert by primary key (safe to re-run).
 */
export default function DietBackupToolbar({ onRestored }: Props) {
  const [busy, setBusy] = useState<null | "backup" | "restore">(null);
  const [progressText, setProgressText] = useState<string>("");
  const fileRef = useRef<HTMLInputElement>(null);

  const runBackup = async () => {
    setBusy("backup");
    setProgressText("Starting…");
    try {
      const blob = await exportDietBackup((p) => {
        setProgressText(`${p.stage} — ${p.done}/${p.total}`);
      });
      const stamp = new Date().toISOString().slice(0, 10);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `bbdo-diet-backup-${stamp}.zip`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Diet backup downloaded");
    } catch (e: any) {
      toast.error(e?.message || "Backup failed");
    } finally {
      setBusy(null);
      setProgressText("");
    }
  };

  const runRestore = async (file: File) => {
    if (!confirm(
      `Restore diet data from "${file.name}"?\n\n` +
      `This will merge rows by ID (existing rows are updated, missing rows are inserted). ` +
      `No rows are deleted.`
    )) return;
    setBusy("restore");
    setProgressText("Reading archive…");
    try {
      const summary = await importDietBackup(file, (p) => {
        setProgressText(`${p.stage} — ${p.done}/${p.total}`);
      });
      const totalRows = Object.values(summary.tables).reduce((s, t) => s + t.upserted, 0);
      const totalImgs =
        summary.images.foods + summary.images.categories + summary.images.filters + summary.images.conditions;
      toast.success(`Restored ${totalRows} rows, ${totalImgs} images`);
      if (summary.warnings.length) {
        console.warn("Restore warnings:", summary.warnings);
        toast.warning(`${summary.warnings.length} warnings — see console`);
      }
      onRestored?.();
    } catch (e: any) {
      toast.error(e?.message || "Restore failed");
    } finally {
      setBusy(null);
      setProgressText("");
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={runBackup}
        disabled={busy !== null}
        title="Download every diet row and image as a ZIP"
      >
        {busy === "backup" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Archive className="w-4 h-4" />}
        <span className="ml-1.5">Backup (ZIP)</span>
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() => fileRef.current?.click()}
        disabled={busy !== null}
        title="Upload a diet backup ZIP to restore (merge-upsert by ID)"
      >
        {busy === "restore" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
        <span className="ml-1.5">Restore</span>
      </Button>
      <input
        ref={fileRef}
        type="file"
        accept=".zip,application/zip"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) runRestore(f);
        }}
      />
      {busy && progressText && (
        <span className="text-xs text-muted-foreground">{progressText}</span>
      )}
    </div>
  );
}
