import JSZip from "jszip";
import { supabase } from "@/integrations/supabase/client";

/**
 * Generic pillar backup + restore.
 *
 * A `PillarConfig` declares which tables belong to a pillar (in dependency
 * order for restore) and which columns on those tables hold image URLs.
 *
 * Backup: every row of every table → JSON, plus every Supabase-hosted image
 * referenced by the listed columns → binaries. Everything is packed into a
 * single ZIP with a manifest.
 *
 * Restore: merge-upsert rows by primary key (no rows are deleted), then
 * re-upload each image to its original Storage bucket path. External URLs
 * (e.g. YouTube i.ytimg.com thumbnails) are preserved as-is.
 */

export interface PillarTable {
  /** public.<name> */
  name: string;
  /** Column to sort by when reading (for deterministic backups). */
  orderBy?: string;
  /** Composite conflict target for upsert. Defaults to "id". */
  onConflict?: string;
  /** Names of columns on this table that hold image URLs to snapshot. */
  imageColumns?: string[];
}

export interface PillarConfig {
  /** Slug used in ZIP filename + manifest.kind (e.g. "supplements"). */
  key: string;
  /** Human label ("Supplements"). */
  label: string;
  /** Tables in dependency order (parents before children). */
  tables: PillarTable[];
}

export const PILLAR_MANIFEST_VERSION = 1;

type Row = Record<string, any>;

export interface PillarProgress {
  stage: string;
  done: number;
  total: number;
}

export interface RestoreSummary {
  tables: Record<string, { upserted: number }>;
  imagesUploaded: number;
  imagesSkipped: number;
  warnings: string[];
}

/* ---------------------------------------------------------------- helpers */

async function fetchAll(table: string, orderBy?: string): Promise<Row[]> {
  const out: Row[] = [];
  const PAGE = 1000;
  let from = 0;
  while (true) {
    let q = (supabase as any).from(table).select("*").range(from, from + PAGE - 1);
    if (orderBy) q = q.order(orderBy, { ascending: true });
    const { data, error } = await q;
    if (error) throw new Error(`${table}: ${error.message}`);
    const rows = (data as Row[]) || [];
    out.push(...rows);
    if (rows.length < PAGE) break;
    from += PAGE;
  }
  return out;
}

function extFromPath(p: string, fallback = "jpg"): string {
  const m = /\.([a-zA-Z0-9]{2,5})(?:\?|$)/.exec(p);
  return m ? m[1].toLowerCase() : fallback;
}
function extFromMime(mime: string | null | undefined, fallback = "jpg"): string {
  if (!mime) return fallback;
  if (mime.includes("png")) return "png";
  if (mime.includes("webp")) return "webp";
  if (mime.includes("gif")) return "gif";
  if (mime.includes("svg")) return "svg";
  return "jpg";
}
function mimeForExt(ext: string): string {
  const e = (ext || "jpg").toLowerCase();
  if (e === "png") return "image/png";
  if (e === "webp") return "image/webp";
  if (e === "gif") return "image/gif";
  if (e === "svg") return "image/svg+xml";
  return "image/jpeg";
}

/**
 * Parse Supabase storage public/signed URLs into {bucket, path}.
 * Returns null for external URLs (YouTube, plain http, emoji, etc.).
 */
function parseSupabaseStorageUrl(v: unknown): { bucket: string; path: string } | null {
  if (typeof v !== "string" || !v) return null;
  try {
    const u = new URL(v);
    const m = /\/storage\/v1\/object\/(?:public|sign)\/([^/]+)\/(.+)$/.exec(u.pathname);
    if (!m) return null;
    return { bucket: m[1], path: decodeURIComponent(m[2]) };
  } catch { return null; }
}

async function downloadStoragePath(bucket: string, path: string): Promise<Blob | null> {
  try {
    const { data, error } = await supabase.storage.from(bucket).download(path);
    if (error || !data) return null;
    return data;
  } catch { return null; }
}

/* ---------------------------------------------------------------- BACKUP */

interface ImageManifestEntry {
  file: string;   // relative path inside the ZIP (e.g. "images/exercises/image_url/<id>.jpg")
  bucket: string;
  path: string;
}

export async function exportPillarBackup(
  config: PillarConfig,
  onProgress?: (p: PillarProgress) => void,
): Promise<Blob> {
  const zip = new JSZip();
  const report = (stage: string, done: number, total: number) =>
    onProgress?.({ stage, done, total });

  // 1) Tables
  const tableData: Record<string, Row[]> = {};
  for (let i = 0; i < config.tables.length; i++) {
    const t = config.tables[i];
    report(`Reading ${t.name}`, i, config.tables.length);
    tableData[t.name] = await fetchAll(t.name, t.orderBy);
  }
  report("Reading tables", config.tables.length, config.tables.length);

  const dataFolder = zip.folder("data")!;
  for (const t of config.tables) {
    dataFolder.file(`${t.name}.json`, JSON.stringify(tableData[t.name], null, 2));
  }

  // 2) Images
  const imagesFolder = zip.folder("images")!;
  const imageManifest: ImageManifestEntry[] = [];

  // Collect all (table, column, row) triples that reference storage-hosted images
  const jobs: Array<{ table: string; column: string; row: Row; parsed: { bucket: string; path: string } }> = [];
  for (const t of config.tables) {
    if (!t.imageColumns?.length) continue;
    for (const row of tableData[t.name]) {
      for (const col of t.imageColumns) {
        const parsed = parseSupabaseStorageUrl(row[col]);
        if (parsed) jobs.push({ table: t.name, column: col, row, parsed });
      }
    }
  }

  let done = 0;
  for (const j of jobs) {
    const blob = await downloadStoragePath(j.parsed.bucket, j.parsed.path);
    if (blob) {
      const rowKey = String(j.row.id ?? j.row.video_id ?? j.row.key ?? j.row.badge_key ?? done);
      const ext = extFromMime(blob.type, extFromPath(j.parsed.path));
      const zipPath = `images/${j.table}/${j.column}/${rowKey}.${ext}`;
      imagesFolder.file(zipPath.replace(/^images\//, ""), blob);
      imageManifest.push({ file: zipPath, bucket: j.parsed.bucket, path: j.parsed.path });
    }
    report("Downloading images", ++done, jobs.length);
  }

  const counts = Object.fromEntries(
    config.tables.map((t) => [t.name, tableData[t.name].length]),
  );
  zip.file("manifest.json", JSON.stringify({
    version: PILLAR_MANIFEST_VERSION,
    kind: `bbdo-${config.key}-backup`,
    label: config.label,
    created_at: new Date().toISOString(),
    counts,
    images: imageManifest,
  }, null, 2));

  report("Compressing archive", 0, 1);
  const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE" });
  report("Done", 1, 1);
  return blob;
}

/* --------------------------------------------------------------- RESTORE */

async function upsertAll(
  table: string,
  rows: Row[],
  onConflict = "id",
): Promise<{ upserted: number; error?: string }> {
  if (!rows.length) return { upserted: 0 };
  const BATCH = 500;
  let upserted = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const chunk = rows.slice(i, i + BATCH);
    const { error } = await (supabase as any).from(table).upsert(chunk, { onConflict });
    if (error) return { upserted, error: error.message };
    upserted += chunk.length;
  }
  return { upserted };
}

export async function importPillarBackup(
  config: PillarConfig,
  file: File | Blob,
  onProgress?: (p: PillarProgress) => void,
): Promise<RestoreSummary> {
  const report = (stage: string, done: number, total: number) =>
    onProgress?.({ stage, done, total });

  report("Reading archive", 0, 1);
  const zip = await JSZip.loadAsync(file);
  const manifestFile = zip.file("manifest.json");
  if (!manifestFile) throw new Error("Not a pillar backup (manifest.json missing).");
  const manifest = JSON.parse(await manifestFile.async("string"));
  const expected = `bbdo-${config.key}-backup`;
  if (manifest?.kind !== expected) {
    throw new Error(`Archive is not a ${config.label} backup (expected ${expected}, got ${manifest?.kind}).`);
  }
  report("Reading archive", 1, 1);

  const warnings: string[] = [];
  const tables: Record<string, { upserted: number }> = {};

  // 1) Upsert tables in dependency order
  for (let i = 0; i < config.tables.length; i++) {
    const t = config.tables[i];
    const f = zip.file(`data/${t.name}.json`);
    if (!f) { tables[t.name] = { upserted: 0 }; continue; }
    const rows: Row[] = JSON.parse(await f.async("string"));
    report(`Restoring ${t.name}`, 0, rows.length);
    const res = await upsertAll(t.name, rows, t.onConflict || "id");
    tables[t.name] = { upserted: res.upserted };
    if (res.error) warnings.push(`${t.name}: ${res.error}`);
    report(`Restoring ${t.name}`, rows.length, rows.length);
  }

  // 2) Re-upload images to their original bucket/path
  const imageManifest: ImageManifestEntry[] = Array.isArray(manifest.images) ? manifest.images : [];
  let imagesUploaded = 0;
  let imagesSkipped = 0;
  for (let i = 0; i < imageManifest.length; i++) {
    const entry = imageManifest[i];
    const zf = zip.file(entry.file);
    if (!zf) { imagesSkipped++; continue; }
    const blob = await zf.async("blob");
    const ext = extFromPath(entry.path);
    const up = await supabase.storage
      .from(entry.bucket)
      .upload(entry.path, blob, {
        upsert: true,
        contentType: mimeForExt(ext),
        cacheControl: "31536000",
      });
    if (up.error) {
      warnings.push(`Image ${entry.bucket}/${entry.path}: ${up.error.message}`);
      imagesSkipped++;
    } else {
      imagesUploaded++;
    }
    report("Restoring images", i + 1, imageManifest.length);
  }

  return { tables, imagesUploaded, imagesSkipped, warnings };
}
