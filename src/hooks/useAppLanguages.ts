import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface AppLanguage {
  code: string;
  name: string;
  native_name: string;
  is_enabled: boolean;
  sort_order: number;
}

export function useAppLanguages(opts: { onlyEnabled?: boolean } = {}) {
  const [languages, setLanguages] = useState<AppLanguage[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    let q = supabase
      .from("app_languages")
      .select("code, name, native_name, is_enabled, sort_order")
      .order("sort_order", { ascending: true });
    if (opts.onlyEnabled) q = q.eq("is_enabled", true);
    const { data } = await q;
    setLanguages((data ?? []) as AppLanguage[]);
    setLoading(false);
  }, [opts.onlyEnabled]);

  useEffect(() => { load(); }, [load]);

  return { languages, loading, reload: load };
}
