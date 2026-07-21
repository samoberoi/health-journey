import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Archive, Upload, Download, Database, Loader2, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { exportToCsv } from "./ExportCsvButton";
import { importCsvToTable } from "@/lib/csvIo";
import { exportDietBackup, importDietBackup } from "@/lib/dietBackup";
import { exportPillarBackup, importPillarBackup, type PillarConfig } from "@/lib/pillarBackup";

type Row = Record<string, any>;

interface Props {
  /** CSV export config. Omit to hide the CSV export item. */
  csvExport?: { filename: string; rows: Row[] | (() => Row[]); columns?: string[] };
  /** CSV import config. Omit to hide the CSV import item. */
  csvImport?: { table: string; pk?: string };
  /** Pillar backup config. If provided, adds ZIP backup/restore items. */
  pillar?: PillarConfig;
  /** Use the legacy diet backup instead of a pillar config. */
  useDietBackup?: boolean;
  onChanged?: () => void;
  label?: string;
}

export default function DataToolsMenu({
  csvExport,
  csvImport,
  pillar,
  useDietBackup,
  onChanged,
  label = "Data tools",
}: Props) {
  const [busy, setBusy] = useState<null | "backup" | "restore" | "import">(null);
  const [progress, setProgress] = useState("");
  const zipInputRef = useRef<HTMLInputElement>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);

  const runBackup = async () => {
    setBusy("backup");
    setProgress("Starting…");
    try {
      const blob = useDietBackup
        ? await exportDietBackup((p) => setProgress(`${p.stage} — ${p.done}/${p.total}`))
        : pillar
        ? await exportPillarBackup(pillar, (p) => setProgress(`${p.stage} — ${p.done}/${p.total}`))
        : null;
      if (!blob) return;
      const stamp = new Date().toISOString().slice(0, 10);
      const key = useDietBackup ? "diet" : pillar!.key;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `bbdo-${key}-backup-${stamp}.zip`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Backup downloaded");
    } catch (e: any) {
      toast.error(e?.message || "Backup failed");
    } finally {
      setBusy(null);
      setProgress("");
    }
  };

  const runRestore = async (file: File) => {
    if (!confirm(`Restore from "${file.name}"?\n\nRows are merged by ID (existing rows updated, missing rows inserted). No rows are deleted.`))
      return;
    setBusy("restore");
    setProgress("Reading archive…");
    try {
      if (useDietBackup) {
        const s = await importDietBackup(file, (p) => setProgress(`${p.stage} — ${p.done}/${p.total}`));
        const total = Object.values(s.tables).reduce((a, t) => a + t.upserted, 0);
        const imgs = s.images.foods + s.images.categories + s.images.filters + s.images.conditions;
        toast.success(`Restored ${total} rows, ${imgs} images`);
        if (s.warnings.length) toast.warning(`${s.warnings.length} warnings — see console`);
      } else if (pillar) {
        const s = await importPillarBackup(pillar, file, (p) => setProgress(`${p.stage} — ${p.done}/${p.total}`));
        const total = Object.values(s.tables).reduce((a, t) => a + t.upserted, 0);
        toast.success(`Restored ${total} rows, ${s.imagesUploaded} images`);
        if (s.warnings.length) toast.warning(`${s.warnings.length} warnings — see console`);
      }
      onChanged?.();
    } catch (e: any) {
      toast.error(e?.message || "Restore failed");
    } finally {
      setBusy(null);
      setProgress("");
      if (zipInputRef.current) zipInputRef.current.value = "";
    }
  };

  const runCsvImport = async (file: File) => {
    if (!csvImport) return;
    const pk = csvImport.pk || "id";
    if (!confirm(`Import CSV into "${csvImport.table}"?\n\nRows with an existing ${pk} will be updated. Rows without ${pk} will be inserted.`))
      return;
    setBusy("import");
    try {
      const text = await file.text();
      const res = await importCsvToTable(csvImport.table, text, { pk });
      const parts = [`${res.updated} updated`, `${res.inserted} inserted`, res.failed ? `${res.failed} failed` : null].filter(Boolean).join(" · ");
      if (res.failed) toast.error(`Imported with errors: ${parts}`, { description: res.errors.slice(0, 2).join(" | ") });
      else toast.success(`Imported ${res.total} rows — ${parts}`);
      onChanged?.();
    } catch (e: any) {
      toast.error(e?.message || "Import failed");
    } finally {
      setBusy(null);
      if (csvInputRef.current) csvInputRef.current.value = "";
    }
  };

  const hasBackup = useDietBackup || !!pillar;

  return (
    <div className="flex items-center gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="shrink-0 gap-2" disabled={busy !== null}>
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />}
            <span>{label}</span>
            <ChevronDown className="w-3.5 h-3.5 opacity-60" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56 bg-popover z-50">
          {hasBackup && (
            <>
              <DropdownMenuItem onClick={runBackup} disabled={busy !== null}>
                <Archive className="w-4 h-4 mr-2" /> Backup (ZIP)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => zipInputRef.current?.click()} disabled={busy !== null}>
                <Upload className="w-4 h-4 mr-2" /> Restore (ZIP)
              </DropdownMenuItem>
              {(csvExport || csvImport) && <DropdownMenuSeparator />}
            </>
          )}
          {csvExport && (
            <DropdownMenuItem
              onClick={() =>
                exportToCsv(csvExport.filename, typeof csvExport.rows === "function" ? csvExport.rows() : csvExport.rows, csvExport.columns)
              }
              disabled={busy !== null}
            >
              <Download className="w-4 h-4 mr-2" /> Export CSV
            </DropdownMenuItem>
          )}
          {csvImport && (
            <DropdownMenuItem onClick={() => csvInputRef.current?.click()} disabled={busy !== null}>
              <Upload className="w-4 h-4 mr-2" /> Import CSV
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      {busy && progress && <span className="text-xs text-muted-foreground truncate max-w-[200px]">{progress}</span>}
      <input
        ref={zipInputRef}
        type="file"
        accept=".zip,application/zip"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) runRestore(f);
        }}
      />
      <input
        ref={csvInputRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) runCsvImport(f);
        }}
      />
    </div>
  );
}
