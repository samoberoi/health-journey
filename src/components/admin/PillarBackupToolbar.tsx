import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Archive, Upload, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { exportPillarBackup, importPillarBackup, type PillarConfig } from "@/lib/pillarBackup";

interface Props {
  config: PillarConfig;
  onRestored?: () => void;
}

/**
 * Generic backup/restore buttons for a content pillar (Diet, Supplements,
 * Fasting, Exercise, Stress & Yoga). Downloads a full ZIP snapshot and
 * merge-upserts by primary key on restore (no rows deleted).
 */
export default function PillarBackupToolbar({ config, onRestored }: Props) {
  const [busy, setBusy] = useState<null | "backup" | "restore">(null);
  const [progressText, setProgressText] = useState<string>("");
  const fileRef = useRef<HTMLInputElement>(null);

  const runBackup = async () => {
    setBusy("backup");
    setProgressText("Starting…");
    try {
      const blob = await exportPillarBackup(config, (p) => {
        setProgressText(`${p.stage} — ${p.done}/${p.total}`);
      });
      const stamp = new Date().toISOString().slice(0, 10);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `bbdo-${config.key}-backup-${stamp}.zip`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`${config.label} backup downloaded`);
    } catch (e: any) {
      toast.error(e?.message || "Backup failed");
    } finally {
      setBusy(null);
      setProgressText("");
    }
  };

  const runRestore = async (file: File) => {
    if (!confirm(
      `Restore ${config.label} data from "${file.name}"?\n\n` +
      `Rows are merged by ID (existing rows are updated, missing rows are inserted). ` +
      `No rows are deleted.`
    )) return;
    setBusy("restore");
    setProgressText("Reading archive…");
    try {
      const summary = await importPillarBackup(config, file, (p) => {
        setProgressText(`${p.stage} — ${p.done}/${p.total}`);
      });
      const totalRows = Object.values(summary.tables).reduce((s, t) => s + t.upserted, 0);
      toast.success(`Restored ${totalRows} rows, ${summary.imagesUploaded} images`);
      if (summary.warnings.length) {
        console.warn(`${config.label} restore warnings:`, summary.warnings);
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
        title={`Download every ${config.label} row and image as a ZIP`}
      >
        {busy === "backup" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Archive className="w-4 h-4" />}
        <span className="ml-1.5">Backup (ZIP)</span>
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() => fileRef.current?.click()}
        disabled={busy !== null}
        title={`Upload a ${config.label} backup ZIP to restore (merge-upsert by ID)`}
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
