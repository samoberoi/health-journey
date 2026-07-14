import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { MIGRATIONS } from "./migrations_data.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const from = Number(url.searchParams.get("from") ?? 0);
  const limit = Number(url.searchParams.get("limit") ?? 999);

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { persistSession: false },
  });

  const slice = MIGRATIONS.slice(from, from + limit);
  const results: Array<{ file: string; ok: boolean; error?: string }> = [];

  for (const { name, sql } of slice) {
    try {
      const { error } = await supabase.rpc("_bootstrap_exec_sql", { sql });
      if (error) throw error;
      results.push({ file: name, ok: true });
    } catch (e) {
      let msg: string;
      try { msg = JSON.stringify(e, Object.getOwnPropertyNames(e as object)); }
      catch { msg = String(e); }
      results.push({ file: name, ok: false, error: msg });
      // Continue on error so we can see all failures
    }
  }

  return new Response(
    JSON.stringify({ total: MIGRATIONS.length, from, ran: results.length, results }, null, 2),
    { headers: { "Content-Type": "application/json" } },
  );
});
