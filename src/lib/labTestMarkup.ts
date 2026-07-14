import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const DEFAULT_MARKUP = 25;
let cached: number | null = null;
const listeners = new Set<(pct: number) => void>();

async function fetchMarkup(): Promise<number> {
  const { data } = await supabase.rpc("get_lab_test_markup_pct" as any);
  const num = typeof data === "number" ? data : Number(data);
  return Number.isFinite(num) && num >= 0 ? num : DEFAULT_MARKUP;
}

/** Apply markup to a base rate. Returns rounded integer rupees. */
export function applyMarkup(base: number | null | undefined, pct: number): number | null {
  if (base == null) return null;
  return Math.round(Number(base) * (1 + pct / 100));
}

/** Returns the effective markup pct for a test: per-test override, else global. */
export function effectiveMarkup(perTest: number | null | undefined, globalPct: number): number {
  if (perTest == null) return globalPct;
  const n = Number(perTest);
  return Number.isFinite(n) && n >= 0 ? n : globalPct;
}

/** Convenience: compute final patient price for a test row. */
export function patientPriceFor(
  base: number | null | undefined,
  perTestPct: number | null | undefined,
  globalPct: number,
): number | null {
  return applyMarkup(base, effectiveMarkup(perTestPct, globalPct));
}

/** React hook — returns the current markup percentage. */
export function useLabTestMarkup(): number {
  const [pct, setPct] = useState<number>(cached ?? DEFAULT_MARKUP);

  useEffect(() => {
    let mounted = true;
    if (cached === null) {
      fetchMarkup().then((v) => {
        cached = v;
        if (mounted) setPct(v);
        listeners.forEach((l) => l(v));
      });
    }
    const listener = (v: number) => mounted && setPct(v);
    listeners.add(listener);
    return () => {
      mounted = false;
      listeners.delete(listener);
    };
  }, []);

  return pct;
}

/** Admin-only: persist a new markup percentage and notify all subscribers. */
export async function setLabTestMarkup(pct: number): Promise<void> {
  const clean = Math.max(0, Math.round(pct));
  const { error } = await supabase
    .from("app_settings" as any)
    .upsert({ key: "lab_test_markup_pct", value: clean, updated_at: new Date().toISOString() } as any, {
      onConflict: "key",
    });
  if (error) throw error;
  cached = clean;
  listeners.forEach((l) => l(clean));
}

export function invalidateMarkupCache() {
  cached = null;
}
