import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const LANG_NAMES: Record<string, string> = {
  en: "English", hi: "Hindi", ta: "Tamil", te: "Telugu", kn: "Kannada",
  ml: "Malayalam", mr: "Marathi", bn: "Bengali", gu: "Gujarati",
  pa: "Punjabi", or: "Odia", as: "Assamese",
};

async function sha1(text: string): Promise<string> {
  const buf = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-1", buf);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const lang: string = body?.lang;
    const texts: string[] | undefined = body?.texts;
    const prime: boolean = !!body?.prime;

    // "prime" mode: return the full cache for a language so the client can
    // hydrate its local map in one call and apply translations instantly.
    if (prime && lang) {
      const { data, error } = await admin
        .from("translation_cache")
        .select("source_text, translated")
        .eq("lang", lang)
        .limit(20000);
      if (error) throw error;
      const map: Record<string, string> = {};
      (data ?? []).forEach((r: any) => { map[r.source_text] = r.translated; });
      return new Response(JSON.stringify({ cache: map }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!lang || !Array.isArray(texts) || texts.length === 0) {
      return new Response(JSON.stringify({ translations: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (lang === "en") {
      return new Response(JSON.stringify({ translations: texts }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Deduplicate inputs (many DOM nodes share the same source text)
    const uniq: string[] = [];
    const seen = new Set<string>();
    for (const t of texts) {
      const k = String(t);
      if (!seen.has(k)) { seen.add(k); uniq.push(k); }
    }

    // Hash all inputs and look them up in the persistent cache
    const hashes = await Promise.all(uniq.map((t) => sha1(t)));
    const { data: cached } = await admin
      .from("translation_cache")
      .select("source_hash, translated")
      .eq("lang", lang)
      .in("source_hash", hashes);

    const byHash: Record<string, string> = {};
    (cached ?? []).forEach((r: any) => { byHash[r.source_hash] = r.translated; });

    const missIdx: number[] = [];
    uniq.forEach((_, i) => { if (!byHash[hashes[i]]) missIdx.push(i); });

    // Translate only the misses via Lovable AI
    if (missIdx.length > 0) {
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY missing");

      const target = LANG_NAMES[lang] || lang;
      const missTexts = missIdx.map((i) => uniq[i]);
      const numbered = missTexts.map((t, i) => `${i}: ${t}`).join("\n");
      const sys = `You are a professional translator for a health & wellness mobile app.
Translate each numbered line from English to ${target}.
Rules:
- Preserve numbers, digits, units (kg, cm, kcal, %), emojis, punctuation, and casing style.
- Do NOT translate brand names, proper nouns, medical acronyms (BP, HbA1c, BMI, XP), or code-like tokens.
- Keep translations natural and short — this is UI text.
- Return ONLY a JSON array of strings with exactly ${missTexts.length} items in the same order. No keys, no commentary.`;

      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash-lite",
          messages: [
            { role: "system", content: sys },
            { role: "user", content: numbered },
          ],
          response_format: { type: "json_object" },
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const content = data?.choices?.[0]?.message?.content ?? "";
        let translations: string[] = [];
        try {
          const parsed = JSON.parse(content);
          if (Array.isArray(parsed)) translations = parsed;
          else if (Array.isArray(parsed?.translations)) translations = parsed.translations;
          else {
            const firstArr = Object.values(parsed).find((v) => Array.isArray(v));
            if (Array.isArray(firstArr)) translations = firstArr as string[];
          }
        } catch {
          const m = content.match(/\[[\s\S]*\]/);
          if (m) { try { translations = JSON.parse(m[0]); } catch { /* noop */ } }
        }

        // Persist good translations
        const rows: any[] = [];
        missIdx.forEach((idxInUniq, j) => {
          const v = translations[j];
          if (typeof v === "string" && v.trim()) {
            byHash[hashes[idxInUniq]] = v;
            rows.push({
              lang,
              source_hash: hashes[idxInUniq],
              source_text: uniq[idxInUniq],
              translated: v,
            });
          }
        });
        if (rows.length > 0) {
          await admin.from("translation_cache")
            .upsert(rows, { onConflict: "lang,source_hash", ignoreDuplicates: true });
        }
      } else {
        const errText = await response.text();
        console.error("AI gateway error", response.status, errText);
      }
    }

    // Build response aligned with input order (using de-duped map)
    const byText: Record<string, string> = {};
    uniq.forEach((t, i) => {
      const v = byHash[hashes[i]];
      if (v) byText[t] = v;
    });
    const out = texts.map((t) => byText[String(t)] ?? t);

    return new Response(JSON.stringify({ translations: out }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("translate error", e);
    return new Response(JSON.stringify({ error: String(e), translations: [] }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
