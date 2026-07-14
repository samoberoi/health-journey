import { supabase } from "@/integrations/supabase/client";

export interface Compliment {
  id: string;
  user_id: string;
  compliment_type: string;
  message: string;
  emoji: string;
  metric_value: string | null;
  is_seen: boolean;
  created_at: string;
}

/** Fetch all compliments for the current user (newest first) */
export async function fetchCompliments(limit = 50): Promise<Compliment[]> {
  const { data, error } = await supabase
    .from("compliments" as any)
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) return [];
  return (data ?? []) as unknown as Compliment[];
}

/** Fetch unseen count */
export async function fetchUnseenCount(): Promise<number> {
  const { count, error } = await supabase
    .from("compliments" as any)
    .select("id", { count: "exact", head: true })
    .eq("is_seen", false);
  if (error) return 0;
  return count ?? 0;
}

/** Mark all as seen */
export async function markAllSeen(): Promise<void> {
  await supabase
    .from("compliments" as any)
    .update({ is_seen: true } as any)
    .eq("is_seen", false);
}

/** Subscribe to new compliments in realtime */
export function subscribeToCompliments(
  userId: string,
  onNew: (c: Compliment) => void
) {
  const channel = supabase
    .channel(`compliments-${userId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "compliments",
        filter: `user_id=eq.${userId}`,
      },
      (payload) => onNew(payload.new as unknown as Compliment)
    )
    .subscribe();

  return () => { supabase.removeChannel(channel); };
}
