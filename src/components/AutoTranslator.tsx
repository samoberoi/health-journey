import { useEffect, useRef } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";

/**
 * Real-time frontend translator.
 * Walks visible text nodes, translates uncached strings via the `translate`
 * edge function (Lovable AI), and swaps their textContent in-place. Original
 * English text is preserved so switching back to `en` restores instantly.
 * A MutationObserver keeps newly-mounted content translated as the user navigates.
 */

const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "CODE", "PRE", "TEXTAREA"]);
const ORIGINAL = new WeakMap<Text, string>();
const CACHE_PREFIX = "bb_tr_cache_v1::";

function loadCache(lang: string): Record<string, string> {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + lang);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}
function saveCache(lang: string, cache: Record<string, string>) {
  try { localStorage.setItem(CACHE_PREFIX + lang, JSON.stringify(cache)); } catch { /* ignore */ }
}

function shouldTranslate(node: Text): boolean {
  const parent = node.parentElement;
  if (!parent) return false;
  if (SKIP_TAGS.has(parent.tagName)) return false;
  if (parent.closest("[data-no-translate]")) return false;
  const text = node.nodeValue ?? "";
  if (!text.trim()) return false;
  // Skip pure numbers / symbols
  if (!/[A-Za-z]/.test(text)) return false;
  return true;
}

function collectTextNodes(root: Node, out: Text[]) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (n) => shouldTranslate(n as Text)
      ? NodeFilter.FILTER_ACCEPT
      : NodeFilter.FILTER_REJECT,
  });
  let n: Node | null = walker.nextNode();
  while (n) { out.push(n as Text); n = walker.nextNode(); }
}

export default function AutoTranslator() {
  const { lang } = useLanguage();
  const pendingRef = useRef<Set<Text>>(new Set());
  const flushTimerRef = useRef<number | null>(null);
  const langRef = useRef(lang);

  useEffect(() => {
    langRef.current = lang;

    // Restore originals first when switching away from a translated state
    document.querySelectorAll("*").forEach(() => { /* noop, walker below */ });
    const nodes: Text[] = [];
    collectTextNodes(document.body, nodes);

    // Also include nodes whose current text is a translation (they'll be in the WeakMap)
    if (lang === "en") {
      // Restore
      const all: Text[] = [];
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      let n: Node | null = walker.nextNode();
      while (n) { all.push(n as Text); n = walker.nextNode(); }
      all.forEach((t) => {
        const orig = ORIGINAL.get(t);
        if (orig != null && t.nodeValue !== orig) t.nodeValue = orig;
      });
      return;
    }

    const cache = loadCache(lang);

    const applyFromCache = (targets: Text[]) => {
      const missing: Text[] = [];
      targets.forEach((t) => {
        const original = ORIGINAL.get(t) ?? t.nodeValue ?? "";
        if (!ORIGINAL.has(t)) ORIGINAL.set(t, original);
        const key = original.trim();
        if (!key) return;
        const hit = cache[key];
        if (hit) {
          if (t.nodeValue !== hit) t.nodeValue = original.replace(key, hit);
        } else {
          missing.push(t);
        }
      });
      return missing;
    };

    const flush = async () => {
      const pending = Array.from(pendingRef.current);
      pendingRef.current.clear();
      if (pending.length === 0) return;
      const activeLang = langRef.current;
      if (activeLang === "en") return;

      // Unique keys
      const keys: string[] = [];
      const seen = new Set<string>();
      pending.forEach((t) => {
        const original = ORIGINAL.get(t) ?? t.nodeValue ?? "";
        const key = original.trim();
        if (key && !seen.has(key)) { seen.add(key); keys.push(key); }
      });

      // Batch in chunks of 40 to stay well within model limits
      const CHUNK = 40;
      const merged: Record<string, string> = {};
      for (let i = 0; i < keys.length; i += CHUNK) {
        const slice = keys.slice(i, i + CHUNK);
        try {
          const { data, error } = await supabase.functions.invoke("translate", {
            body: { lang: activeLang, texts: slice },
          });
          if (error) throw error;
          const translations: string[] = data?.translations ?? [];
          slice.forEach((k, idx) => {
            const v = translations[idx];
            if (typeof v === "string" && v.trim()) merged[k] = v;
          });
        } catch (e) {
          console.warn("translate batch failed", e);
        }
      }

      if (langRef.current !== activeLang) return; // user switched mid-flight
      const currentCache = loadCache(activeLang);
      const nextCache = { ...currentCache, ...merged };
      saveCache(activeLang, nextCache);

      pending.forEach((t) => {
        const original = ORIGINAL.get(t) ?? t.nodeValue ?? "";
        const key = original.trim();
        const hit = nextCache[key];
        if (hit && t.isConnected) t.nodeValue = original.replace(key, hit);
      });
    };

    const scheduleFlush = () => {
      if (flushTimerRef.current) window.clearTimeout(flushTimerRef.current);
      flushTimerRef.current = window.setTimeout(flush, 150);
    };

    const queue = (targets: Text[]) => {
      const missing = applyFromCache(targets);
      missing.forEach((t) => pendingRef.current.add(t));
      if (missing.length) scheduleFlush();
    };

    // Initial pass
    queue(nodes);

    // Observe further DOM changes
    const observer = new MutationObserver((mutations) => {
      const targets: Text[] = [];
      mutations.forEach((m) => {
        m.addedNodes.forEach((added) => {
          if (added.nodeType === Node.TEXT_NODE) {
            if (shouldTranslate(added as Text)) targets.push(added as Text);
          } else if (added.nodeType === Node.ELEMENT_NODE) {
            collectTextNodes(added, targets);
          }
        });
        if (m.type === "characterData" && m.target.nodeType === Node.TEXT_NODE) {
          const t = m.target as Text;
          if (shouldTranslate(t)) {
            // Text changed by app — treat new value as new original
            ORIGINAL.set(t, t.nodeValue ?? "");
            targets.push(t);
          }
        }
      });
      if (targets.length) queue(targets);
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    return () => {
      observer.disconnect();
      if (flushTimerRef.current) window.clearTimeout(flushTimerRef.current);
    };
  }, [lang]);

  return null;
}
