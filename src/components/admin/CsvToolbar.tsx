import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { exportToCsv } from "./ExportCsvButton";
import ImportCsvButton from "./ImportCsvButton";
import { fetchAllRows } from "@/lib/csvIo";

interface Props {
  /** Supabase table for both export (full fetch) and import (upsert). */
  table: string;
  /** File name stem for the CSV. Defaults to the table name. */
  filename?: string;
  /** PK to upsert on. Default `id`. */
  pk?: string;
  /** Optional order column when exporting. */
  orderBy?: string;
  /** Called after a successful import so the page can refetch. */
  onImported?: () => void;
  className?: string;
}

/**
 * One-stop Export + Import strip. Export fetches every row from `table`;
 * Import upserts by `pk`.
 */
export default function CsvToolbar({ table, filename, pk = "id", orderBy, onImported, className = "" }: Props) {
  const [busy, setBusy] = useState(false);

  const doExport = async () => {
    setBusy(true);
    try {
      const data = await fetchAllRows(table, orderBy);
      exportToCsv(filename ?? table, data);
    } catch (e: any) {
      toast.error(e?.message || "Export failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`flex items-center gap-2 flex-wrap ${className}`}>
      <Button
        variant="outline"
        size="sm"
        className="shrink-0 w-fit self-start gap-2"
        title="Export CSV"
        aria-label="Export CSV"
        disabled={busy}
        onClick={doExport}
      >
        {busy ? <Loader2 className="w-4 h-4 shrink-0 animate-spin" /> : <Download className="w-4 h-4 shrink-0" />}
        <span className="hidden sm:inline">Export CSV</span>
      </Button>
      <ImportCsvButton table={table} pk={pk} onImported={onImported} />
    </div>
  );
}
