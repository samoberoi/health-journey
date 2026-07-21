import JSZip from "jszip";
import { supabase } from "@/integrations/supabase/client";

/**
 * Diet Intelligence backup & restore.
 *
 * Backup: exports every row from the Diet taxonomy tables plus all referenced
 * images into a single ZIP. Restore: reads the ZIP and merge-upserts rows by
 * primary key, re-uploading images to their respective Storage buckets.
 *
 * Tables covered:
 *   - food_categories
 *   - food_filters
 *   - food_items
 *   - food_item_tags
 *   - food_item_tag_links
 *   - food_conditions
 *   - food_condition_rules
 *
 * Image sources:
 *   - food_items.image_url  → storage path in bucket `food-images`
 *   - food_categories.image_url / food_filters.image_url → public URL on `avatars`
 *   - food_conditions.icon_url → signed URL on `condition-icons`
 */

const MANIFEST_VERSION = 1;

type Row = Record<string, any>;

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

function extFromMime(mime: string | null | undefined, fallback = "jpg"): string {
  if (!mime) return fallback;
  if (mime.includes("png")) return "png";
  if (mime.includes("webp")) return "webp";
  if (mime.includes("gif")) return "gif";
  if (mime.includes("svg")) return "svg";
  return "jpg";
}

function extFromPath(p: string, fallback = "jpg"): string {
  const m = /\.([a-zA-Z0-9]{2,5})(?:\?|$)/.exec(p);
  return m ? m[1].toLowerCase() : fallback;
}

async function downloadStoragePath(bucket: string, path: string): Promise<Blob | null> {
  try {
    const { data, error } = await supabase.storage.from(bucket).download(path);
    if (error || !data) return null;
    return data;
  } catch { return null; }
}

async function downloadUrl(url: string): Promise<Blob | null> {
  try {
    const r = await fetch(url);
    if (!r.ok) return null;
    return await r.blob();
  } catch { return null; }
}

/**
 * Try to extract the storage bucket path from a public/signed Supabase URL.
 * Public: /storage/v1/object/public/<bucket>/<path>
 * Signed: /storage/v1/object/sign/<bucket>/<path>?token=...
 */
function parseSupabaseStorageUrl(url: string): { bucket: string; path: string } | null {
  try {
    const u = new URL(url);
    const m = /\/storage\/v1\/object\/(?:public|sign)\/([^/]+)\/(.+)$/.exec(u.pathname);
    if (!m) return null;
    return { bucket: m[1], path: decodeURIComponent(m[2]) };
  } catch { return null; }
}

/* ---------------------------------------------------------------- BACKUP */

export interface BackupProgress {
  stage: string;
  done: number;
  total: number;
}

export async function exportDietBackup(onProgress?: (p: BackupProgress) => void): Promise<Blob> {
  const zip = new JSZip();
  const report = (stage: string, done: number, total: number) =>
    onProgress?.({ stage, done, total });

  report("Reading tables", 0, 7);
  const [categories, filters, items, tags, tagLinks, conditions, rules] = await Promise.all([
    fetchAll("food_categories", "display_order"),
    fetchAll("food_filters", "display_order"),
    fetchAll("food_items", "display_order"),
    fetchAll("food_item_tags"),
    fetchAll("food_item_tag_links"),
    fetchAll("food_conditions", "sort_order"),
    fetchAll("food_condition_rules"),
  ]);
  report("Reading tables", 7, 7);

  const data = zip.folder("data")!;
  data.file("food_categories.json", JSON.stringify(categories, null, 2));
  data.file("food_filters.json", JSON.stringify(filters, null, 2));
  data.file("food_items.json", JSON.stringify(items, null, 2));
  data.file("food_item_tags.json", JSON.stringify(tags, null, 2));
  data.file("food_item_tag_links.json", JSON.stringify(tagLinks, null, 2));
  data.file("food_conditions.json", JSON.stringify(conditions, null, 2));
  data.file("food_condition_rules.json", JSON.stringify(rules, null, 2));

  const images = zip.folder("images")!;
  const foodsDir = images.folder("foods")!;
  const catsDir = images.folder("categories")!;
  const filtersDir = images.folder("filters")!;
  const condsDir = images.folder("conditions")!;

  // ---- Food item images (storage path in `food-images`)
  const itemsWithImg = items.filter((r) => r.image_url);
  let done = 0;
  for (const row of itemsWithImg) {
    const blob = await downloadStoragePath("food-images", row.image_url as string);
    if (blob) {
      const ext = extFromMime(blob.type, extFromPath(row.image_url as string));
      foodsDir.file(`${row.id}.${ext}`, blob);
    }
    report("Downloading food images", ++done, itemsWithImg.length);
  }

  // ---- Category images
  const catsWithImg = categories.filter((r) => r.image_url);
  done = 0;
  for (const row of catsWithImg) {
    const parsed = parseSupabaseStorageUrl(row.image_url);
    const blob = parsed
      ? await downloadStoragePath(parsed.bucket, parsed.path)
      : await downloadUrl(row.image_url);
    if (blob) {
      const ext = extFromMime(blob.type, extFromPath(row.image_url));
      catsDir.file(`${row.id}.${ext}`, blob);
    }
    report("Downloading category images", ++done, catsWithImg.length);
  }

  // ---- Filter images
  const filtersWithImg = filters.filter((r) => r.image_url);
  done = 0;
  for (const row of filtersWithImg) {
    const parsed = parseSupabaseStorageUrl(row.image_url);
    const blob = parsed
      ? await downloadStoragePath(parsed.bucket, parsed.path)
      : await downloadUrl(row.image_url);
    if (blob) {
      const ext = extFromMime(blob.type, extFromPath(row.image_url));
      filtersDir.file(`${row.id}.${ext}`, blob);
    }
    report("Downloading filter images", ++done, filtersWithImg.length);
  }

  // ---- Condition icons
  const condsWithIcon = conditions.filter((r) => r.icon_url);
  done = 0;
  for (const row of condsWithIcon) {
    const parsed = parseSupabaseStorageUrl(row.icon_url);
    const blob = parsed
      ? await downloadStoragePath(parsed.bucket, parsed.path)
      : await downloadUrl(row.icon_url);
    if (blob) {
      const ext = extFromMime(blob.type, extFromPath(row.icon_url));
      condsDir.file(`${row.id}.${ext}`, blob);
    }
    report("Downloading condition icons", ++done, condsWithIcon.length);
  }

  const manifest = {
    version: MANIFEST_VERSION,
    kind: "bbdo-diet-backup",
    created_at: new Date().toISOString(),
    counts: {
      food_categories: categories.length,
      food_filters: filters.length,
      food_items: items.length,
      food_item_tags: tags.length,
      food_item_tag_links: tagLinks.length,
      food_conditions: conditions.length,
      food_condition_rules: rules.length,
    },
  };
  zip.file("manifest.json", JSON.stringify(manifest, null, 2));

  report("Compressing archive", 0, 1);
  const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE" });
  report("Done", 1, 1);
  return blob;
}

/* --------------------------------------------------------------- RESTORE */

export interface RestoreSummary {
  tables: Record<string, { upserted: number }>;
  images: {
    foods: number;
    categories: number;
    filters: number;
    conditions: number;
  };
  warnings: string[];
}

async function upsertAll(table: string, rows: Row[], pk = "id"): Promise<number> {
  if (!rows.length) return 0;
  const BATCH = 200;
  let upserted = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const chunk = rows.slice(i, i + BATCH);
    const { error } = await (supabase as any).from(table).upsert(chunk, { onConflict: pk });
    if (error) throw new Error(`${table}: ${error.message}`);
    upserted += chunk.length;
  }
  return upserted;
}

async function readJson(zip: JSZip, path: string): Promise<Row[]> {
  const f = zip.file(path);
  if (!f) return [];
  const text = await f.async("string");
  return JSON.parse(text) as Row[];
}

async function findImageInZip(
  zip: JSZip,
  folder: string,
  rowId: string,
): Promise<{ blob: Blob; ext: string } | null> {
  const prefix = `images/${folder}/${rowId}.`;
  const match = Object.keys(zip.files).find((k) => k.startsWith(prefix));
  if (!match) return null;
  const blob = await zip.file(match)!.async("blob");
  const ext = match.slice(prefix.length).toLowerCase();
  return { blob, ext };
}

function mimeForExt(ext: string): string {
  const e = ext.toLowerCase();
  if (e === "png") return "image/png";
  if (e === "webp") return "image/webp";
  if (e === "gif") return "image/gif";
  if (e === "svg") return "image/svg+xml";
  return "image/jpeg";
}

export interface RestoreProgress {
  stage: string;
  done: number;
  total: number;
}

export async function importDietBackup(
  file: File | Blob,
  onProgress?: (p: RestoreProgress) => void,
): Promise<RestoreSummary> {
  const report = (stage: string, done: number, total: number) =>
    onProgress?.({ stage, done, total });

  report("Reading archive", 0, 1);
  const zip = await JSZip.loadAsync(file);
  const manifestFile = zip.file("manifest.json");
  if (!manifestFile) throw new Error("Not a BBDO diet backup (manifest.json missing).");
  const manifest = JSON.parse(await manifestFile.async("string"));
  if (manifest?.kind !== "bbdo-diet-backup") {
    throw new Error("Archive is not a BBDO diet backup.");
  }
  report("Reading archive", 1, 1);

  const categories = await readJson(zip, "data/food_categories.json");
  const filters = await readJson(zip, "data/food_filters.json");
  const items = await readJson(zip, "data/food_items.json");
  const tags = await readJson(zip, "data/food_item_tags.json");
  const tagLinks = await readJson(zip, "data/food_item_tag_links.json");
  const conditions = await readJson(zip, "data/food_conditions.json");
  const rules = await readJson(zip, "data/food_condition_rules.json");

  const warnings: string[] = [];
  const imagesUploaded = { foods: 0, categories: 0, filters: 0, conditions: 0 };

  // 1) Categories (must exist before filters)
  report("Restoring categories", 0, categories.length);
  const catsClean = categories.map(({ ...r }) => r);
  await upsertAll("food_categories", catsClean);

  // Category images → avatars bucket, public URL
  for (let i = 0; i < categories.length; i++) {
    const row = categories[i];
    const img = await findImageInZip(zip, "categories", row.id);
    if (img) {
      const path = `food-taxonomy/categories/${row.id}/${Date.now()}.${img.ext}`;
      const up = await supabase.storage.from("avatars").upload(path, img.blob, {
        upsert: true, contentType: mimeForExt(img.ext), cacheControl: "31536000",
      });
      if (!up.error) {
        const { data } = supabase.storage.from("avatars").getPublicUrl(path);
        await (supabase as any).from("food_categories").update({ image_url: data.publicUrl }).eq("id", row.id);
        imagesUploaded.categories++;
      } else {
        warnings.push(`Category image ${row.id}: ${up.error.message}`);
      }
    }
    report("Restoring categories", i + 1, categories.length);
  }

  // 2) Filters
  report("Restoring filters", 0, filters.length);
  await upsertAll("food_filters", filters);
  for (let i = 0; i < filters.length; i++) {
    const row = filters[i];
    const img = await findImageInZip(zip, "filters", row.id);
    if (img) {
      const path = `food-taxonomy/filters/${row.id}/${Date.now()}.${img.ext}`;
      const up = await supabase.storage.from("avatars").upload(path, img.blob, {
        upsert: true, contentType: mimeForExt(img.ext), cacheControl: "31536000",
      });
      if (!up.error) {
        const { data } = supabase.storage.from("avatars").getPublicUrl(path);
        await (supabase as any).from("food_filters").update({ image_url: data.publicUrl }).eq("id", row.id);
        imagesUploaded.filters++;
      } else {
        warnings.push(`Filter image ${row.id}: ${up.error.message}`);
      }
    }
    report("Restoring filters", i + 1, filters.length);
  }

  // 3) Tags (referenced by tag_links)
  report("Restoring tags", 0, tags.length);
  await upsertAll("food_item_tags", tags);
  report("Restoring tags", tags.length, tags.length);

  // 4) Food items
  report("Restoring foods", 0, items.length);
  await upsertAll("food_items", items);

  // Food images → food-images bucket at original storage path
  for (let i = 0; i < items.length; i++) {
    const row = items[i];
    const img = await findImageInZip(zip, "foods", row.id);
    if (img && row.image_url) {
      const up = await supabase.storage.from("food-images").upload(row.image_url as string, img.blob, {
        upsert: true, contentType: mimeForExt(img.ext), cacheControl: "31536000",
      });
      if (up.error) warnings.push(`Food image ${row.id}: ${up.error.message}`);
      else imagesUploaded.foods++;
    }
    report("Restoring foods", i + 1, items.length);
  }

  // 5) Tag links (after items + tags)
  report("Restoring tag links", 0, tagLinks.length);
  // tag_links uses composite PK (item_id, tag_id) — assume table has that PK
  if (tagLinks.length) {
    // Try upsert with composite conflict target; fall back to insert-ignore.
    const { error } = await (supabase as any)
      .from("food_item_tag_links")
      .upsert(tagLinks, { onConflict: "food_item_id,tag_id", ignoreDuplicates: true });
    if (error) warnings.push(`food_item_tag_links: ${error.message}`);
  }
  report("Restoring tag links", tagLinks.length, tagLinks.length);

  // 6) Conditions
  report("Restoring conditions", 0, conditions.length);
  await upsertAll("food_conditions", conditions);
  for (let i = 0; i < conditions.length; i++) {
    const row = conditions[i];
    const img = await findImageInZip(zip, "conditions", row.id);
    if (img) {
      const path = `${row.key || row.id}-${Date.now()}.${img.ext}`;
      const up = await supabase.storage.from("condition-icons").upload(path, img.blob, {
        upsert: true, contentType: mimeForExt(img.ext), cacheControl: "31536000",
      });
      if (!up.error) {
        const signed = await supabase.storage.from("condition-icons").createSignedUrl(path, 60 * 60 * 24 * 365 * 10);
        if (signed.data?.signedUrl) {
          await (supabase as any).from("food_conditions").update({ icon_url: signed.data.signedUrl }).eq("id", row.id);
          imagesUploaded.conditions++;
        }
      } else {
        warnings.push(`Condition icon ${row.id}: ${up.error.message}`);
      }
    }
    report("Restoring conditions", i + 1, conditions.length);
  }

  // 7) Condition rules
  report("Restoring rules", 0, rules.length);
  await upsertAll("food_condition_rules", rules);
  report("Restoring rules", rules.length, rules.length);

  return {
    tables: {
      food_categories: { upserted: categories.length },
      food_filters: { upserted: filters.length },
      food_items: { upserted: items.length },
      food_item_tags: { upserted: tags.length },
      food_item_tag_links: { upserted: tagLinks.length },
      food_conditions: { upserted: conditions.length },
      food_condition_rules: { upserted: rules.length },
    },
    images: imagesUploaded,
    warnings,
  };
}
