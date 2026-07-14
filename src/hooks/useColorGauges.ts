import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface GaugeBand {
  id: string;
  module_id: string;
  label: string;
  min_value: number | null;
  max_value: number | null;
  color_hex: string;
  sort_order: number;
}

export interface GaugeModule {
  id: string;
  module_key: string;
  module_name: string;
  description: string | null;
  unit: string | null;
  higher_is_better: boolean;
  comparison_mode: string;
  sort_order: number;
  is_active: boolean;
  bands: GaugeBand[];
}

const FALLBACK = "hsl(var(--primary))";

let cache: GaugeModule[] | null = null;
const listeners = new Set<(m: GaugeModule[]) => void>();

async function fetchAll(): Promise<GaugeModule[]> {
  const [{ data: mods }, { data: bands }] = await Promise.all([
    (supabase as any).from("color_gauge_modules").select("*").order("sort_order"),
    (supabase as any).from("color_gauge_bands").select("*").order("sort_order"),
  ]);
  const bandsBy: Record<string, GaugeBand[]> = {};
  (bands || []).forEach((b: GaugeBand) => {
    (bandsBy[b.module_id] ||= []).push(b);
  });
  return (mods || []).map((m: any) => ({ ...m, bands: bandsBy[m.id] || [] }));
}

export async function refreshColorGauges() {
  cache = await fetchAll();
  listeners.forEach((l) => l(cache!));
}

export function gradientStopsForModule(
  modules: GaugeModule[],
  key: string
): { offset: number; color: string }[] {
  const m = modules.find((x) => x.module_key === key);
  if (!m || !m.bands.length) return [];
  const bands = [...m.bands].sort((a, b) => {
    const aMin = a.min_value == null ? -Infinity : Number(a.min_value);
    const bMin = b.min_value == null ? -Infinity : Number(b.min_value);
    return aMin - bMin || a.sort_order - b.sort_order;
  });
  const mins = bands.map((b) => (b.min_value == null ? Infinity : Number(b.min_value)));
  const maxs = bands.map((b) => (b.max_value == null ? -Infinity : Number(b.max_value)));
  const lo = Math.min(...mins.filter((v) => Number.isFinite(v)));
  const hi = Math.max(...maxs.filter((v) => Number.isFinite(v)));
  const span = hi - lo || 1;

  // Each band occupies its true proportional range on the ring.
  // We emit two stops per band (near the band's edges) so the color stays
  // solid across the interior of the band and only blends softly across the
  // boundary with the adjacent band. This ensures red / amber / green all get
  // their share of the ring, proportional to the ranges set in the back end.
  const stops: { offset: number; color: string }[] = [];
  bands.forEach((b, i) => {
    const bMin = b.min_value == null ? lo : Number(b.min_value);
    const bMax = b.max_value == null ? hi : Number(b.max_value);
    const startOffset = (bMin - lo) / span;
    const endOffset = (bMax - lo) / span;
    const width = Math.max(0.0001, endOffset - startOffset);
    // Blend zone = 20% of band width, capped at 0.06 of the whole ring.
    const blend = Math.min(width * 0.2, 0.06);
    const inner1 = i === 0 ? startOffset : startOffset + blend;
    const inner2 = i === bands.length - 1 ? endOffset : endOffset - blend;
    stops.push({ offset: Math.max(0, Math.min(1, inner1)), color: b.color_hex });
    if (inner2 > inner1) {
      stops.push({ offset: Math.max(0, Math.min(1, inner2)), color: b.color_hex });
    }
  });
  return stops;
}


export function colorForValue(modules: GaugeModule[], key: string, value: number | null | undefined): string {
  if (value == null || Number.isNaN(value as number)) return FALLBACK;
  const m = modules.find((x) => x.module_key === key);
  if (!m) return FALLBACK;
  const v = Number(value);
  const band = m.bands.find((b) => {
    const lo = b.min_value == null ? -Infinity : Number(b.min_value);
    const hi = b.max_value == null ? Infinity : Number(b.max_value);
    return v >= lo && v <= hi;
  });
  return band?.color_hex || FALLBACK;
}

export function useColorGauges() {
  const [modules, setModules] = useState<GaugeModule[]>(cache || []);

  useEffect(() => {
    const listener = (m: GaugeModule[]) => setModules(m);
    listeners.add(listener);
    if (!cache) {
      fetchAll().then((m) => {
        cache = m;
        setModules(m);
      });
    }
    return () => { listeners.delete(listener); };
  }, []);

  const getColor = useCallback(
    (key: string, value: number | null | undefined) => colorForValue(modules, key, value),
    [modules]
  );

  return { modules, getColor, refresh: refreshColorGauges };
}
