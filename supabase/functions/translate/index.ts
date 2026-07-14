import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { lang, texts } = await req.json();
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

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY missing");

    const target = LANG_NAMES[lang] || lang;

    // Batch into a single request; strict JSON array output preserving order + count.
    const numbered = texts.map((t: string, i: number) => `${i}: ${t}`).join("\n");
    const sys = `You are a professional translator for a health & wellness mobile app.
Translate each numbered line from English to ${target}.
Rules:
- Preserve numbers, digits, units (kg, cm, kcal, %), emojis, punctuation, and casing style.
- Do NOT translate brand names, proper nouns, medical acronyms (BP, HbA1c, BMI, XP), or code-like tokens.
- Keep translations natural and short — this is UI text.
- Return ONLY a JSON array of strings with exactly ${texts.length} items in the same order. No keys, no commentary.`;

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

    if (!response.ok) {
      const errText = await response.text();
      console.error("AI gateway error", response.status, errText);
      return new Response(JSON.stringify({ translations: texts }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content ?? "";

    let translations: string[] = [];
    try {
      // Model may return {"translations":[...]} or a bare array wrapped
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) translations = parsed;
      else if (Array.isArray(parsed?.translations)) translations = parsed.translations;
      else {
        const firstArr = Object.values(parsed).find((v) => Array.isArray(v));
        if (Array.isArray(firstArr)) translations = firstArr as string[];
      }
    } catch {
      const m = content.match(/\[[\s\S]*\]/);
      if (m) {
        try { translations = JSON.parse(m[0]); } catch { /* ignore */ }
      }
    }

    // Pad / trim to match input length, fall back to original text on gaps
    const out = texts.map((t: string, i: number) =>
      typeof translations[i] === "string" && translations[i].trim() ? translations[i] : t
    );

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
