// Fetch a food photo and cache in storage.
// Strategy: Wikipedia (accurate, on-subject) → Pexels → AI (last resort).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24 * 365;

type Item = { id: string; name: string; alt_name: string | null; filter_id: string | null };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const LOVABLE_KEY = Deno.env.get("LOVABLE_API_KEY") || "";
    const PEXELS_KEY = Deno.env.get("PEXELS_API_KEY") || "";

    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "unauthorized" }, 401);
    const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const { food_item_id, force, bulk, limit } = body as {
      food_item_id?: string; force?: boolean; bulk?: boolean; limit?: number;
    };

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    if (bulk) {
      const { data: isAdmin } = await admin.rpc("has_role", { _user_id: user.id, _role: "admin" });
      if (!isAdmin) return json({ error: "admin required" }, 403);
      const max = Math.min(Math.max(1, limit ?? 15), 30);
      let q = admin.from("food_items").select("id,name,alt_name,filter_id,image_url").order("name").limit(max);
      if (!force) q = q.is("image_url", null);
      const { data: items } = await q;
      const results: Array<{ id: string; name: string; ok: boolean; source?: string; error?: string }> = [];
      for (const it of items ?? []) {
        const r = await generateFor(it as Item, admin, LOVABLE_KEY, PEXELS_KEY);
        results.push({ id: it.id, name: it.name, ok: r.ok, source: r.source, error: r.error });
      }
      const { count } = await admin.from("food_items").select("id", { count: "exact", head: true }).is("image_url", null);
      return json({ processed: results.length, remaining: count ?? 0, results });
    }

    if (!food_item_id || typeof food_item_id !== "string") return json({ error: "food_item_id required" }, 400);

    const { data: item, error: itemErr } = await admin
      .from("food_items")
      .select("id,name,alt_name,filter_id,image_url")
      .eq("id", food_item_id)
      .maybeSingle();
    if (itemErr || !item) return json({ error: "food item not found" }, 404);

    if (item.image_url && !force) {
      const signed = await admin.storage.from("food-images").createSignedUrl(item.image_url, SIGNED_URL_TTL_SECONDS);
      if (signed.data?.signedUrl) return json({ url: signed.data.signedUrl, cached: true });
    }

    const r = await generateFor(item as Item, admin, LOVABLE_KEY, PEXELS_KEY);
    if (!r.ok) return json({ error: r.error || "generation failed" }, r.status || 502);
    const signed = await admin.storage.from("food-images").createSignedUrl(r.path!, SIGNED_URL_TTL_SECONDS);
    return json({ url: signed.data?.signedUrl, cached: false, source: r.source });
  } catch (e) {
    console.error(e);
    return json({ error: (e as Error).message }, 500);
  }
});

async function generateFor(
  item: Item,
  admin: ReturnType<typeof createClient>,
  LOVABLE_KEY: string,
  PEXELS_KEY: string,
): Promise<{ ok: boolean; error?: string; status?: number; path?: string; source?: string }> {
  try {
    const { data: filter } = await admin.from("food_filters").select("name").eq("id", item.filter_id).maybeSingle();
    const subject = item.name;
    const altName = item.alt_name || "";
    const category = filter?.name || "food";

    let bytes: Uint8Array | null = null;
    let contentType = "image/jpeg";
    let ext = "jpg";
    let source = "";

    // 1) Wikipedia — accurate, on-subject
    const wikiCandidates = [subject, altName, `${subject} food`].filter(Boolean) as string[];
    for (const q of wikiCandidates) {
      const got = await tryWikipedia(q);
      if (got) { bytes = got.bytes; contentType = got.contentType; ext = got.ext; source = `wikipedia:${q}`; break; }
    }

    // 2) Pexels
    if (!bytes && PEXELS_KEY) {
      const queries = [`${subject} food`, altName ? `${altName} food` : "", `${subject} ${category}`].filter(Boolean);
      for (const q of queries) {
        const got = await tryPexels(q, PEXELS_KEY);
        if (got) { bytes = got.bytes; contentType = got.contentType; ext = got.ext; source = `pexels:${q}`; break; }
      }
    }

    // 3) AI fallback
    if (!bytes && LOVABLE_KEY) {
      const subjectFull = altName ? `${subject} (also known as ${altName})` : subject;
      const prompt = `A single hyper-realistic, appetizing food photograph of ${subjectFull}. Category: ${category}. The subject must be clearly identifiable and the unmistakable hero of the frame. Traditional Indian/South Asian presentation when appropriate. Top-down, soft natural daylight, vibrant authentic colors, clean off-white background, magazine-quality. No text, no watermark, no hands, single portion centered.`;
      const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/images/generations", {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: "openai/gpt-image-2", prompt, size: "1024x1024", quality: "low", n: 1 }),
      });
      if (aiRes.ok) {
        const aiData = await aiRes.json();
        const b64: string | undefined = aiData?.data?.[0]?.b64_json;
        if (b64) {
          bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
          contentType = "image/png";
          ext = "png";
          source = "ai";
        }
      } else {
        console.warn("ai failed", item.name, aiRes.status);
      }
    }

    if (!bytes) return { ok: false, error: "no image found from any source" };

    const path = `${item.id}.${ext}`;
    const up = await admin.storage.from("food-images").upload(path, bytes, { contentType, upsert: true });
    if (up.error) return { ok: false, error: `upload: ${up.error.message}` };
    await admin.from("food_items").update({ image_url: path }).eq("id", item.id);
    return { ok: true, path, source };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

async function tryWikipedia(q: string): Promise<{ bytes: Uint8Array; contentType: string; ext: string } | null> {
  try {
    // Search for best matching page title
    const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(q)}&format=json&srlimit=1&origin=*`;
    const sRes = await fetch(searchUrl, { headers: { "User-Agent": "bbdo-food-images/1.0" } });
    if (!sRes.ok) return null;
    const sJson = await sRes.json();
    const title: string | undefined = sJson?.query?.search?.[0]?.title;
    if (!title) return null;

    const sumUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, "_"))}`;
    const pRes = await fetch(sumUrl, { headers: { "User-Agent": "bbdo-food-images/1.0" } });
    if (!pRes.ok) return null;
    const pJson = await pRes.json();
    const imgUrl: string | undefined = pJson?.originalimage?.source || pJson?.thumbnail?.source;
    if (!imgUrl) return null;

    const imgRes = await fetch(imgUrl, { headers: { "User-Agent": "bbdo-food-images/1.0" } });
    if (!imgRes.ok) return null;
    const buf = new Uint8Array(await imgRes.arrayBuffer());
    if (buf.byteLength < 1000) return null;
    const ct = imgRes.headers.get("content-type") || "image/jpeg";
    const ext = ct.includes("png") ? "png" : ct.includes("webp") ? "webp" : "jpg";
    return { bytes: buf, contentType: ct, ext };
  } catch (e) {
    console.warn("wiki err", q, (e as Error).message);
    return null;
  }
}

async function tryPexels(q: string, key: string): Promise<{ bytes: Uint8Array; contentType: string; ext: string } | null> {
  try {
    const url = `https://api.pexels.com/v1/search?per_page=1&orientation=square&query=${encodeURIComponent(q)}`;
    const r = await fetch(url, { headers: { Authorization: key } });
    if (!r.ok) return null;
    const data = await r.json();
    const src: string | undefined = data?.photos?.[0]?.src?.large || data?.photos?.[0]?.src?.medium;
    if (!src) return null;
    const imgRes = await fetch(src);
    if (!imgRes.ok) return null;
    const buf = new Uint8Array(await imgRes.arrayBuffer());
    if (buf.byteLength < 1000) return null;
    const ct = imgRes.headers.get("content-type") || "image/jpeg";
    const ext = ct.includes("png") ? "png" : "jpg";
    return { bytes: buf, contentType: ct, ext };
  } catch { return null; }
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
