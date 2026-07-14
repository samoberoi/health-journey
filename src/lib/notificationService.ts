import { supabase } from "@/integrations/supabase/client";

export interface AppNotification {
  id: string;
  user_id: string;
  title: string;
  body: string;
  type: string;
  icon: string;
  action_url: string | null;
  is_read: boolean;
  created_at: string;
}

/** Fetch unread count */
export async function fetchUnreadCount(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from("notifications" as any)
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("is_read", false);
  if (error) return 0;
  return count ?? 0;
}

/** Fetch recent notifications */
export async function fetchNotifications(userId: string, limit = 30): Promise<AppNotification[]> {
  const { data, error } = await supabase
    .from("notifications" as any)
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) return [];
  return (data ?? []) as unknown as AppNotification[];
}

/** Mark single notification as read */
export async function markRead(id: string): Promise<void> {
  await supabase
    .from("notifications" as any)
    .update({ is_read: true } as any)
    .eq("id", id);
}

/** Mark all notifications as read */
export async function markAllRead(): Promise<void> {
  await supabase
    .from("notifications" as any)
    .update({ is_read: true } as any)
    .eq("is_read", false);
}

/** Delete a notification */
export async function deleteNotification(id: string): Promise<void> {
  await supabase.from("notifications" as any).delete().eq("id", id);
}

/** Clear all notifications */
export async function clearAllNotifications(): Promise<void> {
  await supabase.from("notifications" as any).delete().neq("id", "00000000-0000-0000-0000-000000000000");
}

/** Create a local notification (for instant in-app use) */
export async function createNotification(opts: {
  user_id: string;
  title: string;
  body: string;
  type: string;
  icon?: string;
  action_url?: string;
}): Promise<void> {
  const { error } = await (supabase as any).rpc("create_notification", {
    _user_id: opts.user_id,
    _title: opts.title,
    _body: opts.body,
    _type: opts.type,
    _icon: opts.icon ?? "🔔",
    _action_url: opts.action_url ?? null,
  });
  if (error) throw error;
}

/** Ensure the one-time welcome notification exists for this signed-in user. */
export async function sendWelcomeNotification(userId: string): Promise<string | null> {
  const { data, error } = await (supabase as any).rpc("send_welcome_notification", {
    _user_id: userId,
  });
  if (error) throw error;
  return (data ?? null) as string | null;
}

// ─── Browser Notification Permission ─────────────────────────────────────

export function canUseBrowserNotifications(): boolean {
  return "Notification" in window;
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (!canUseBrowserNotifications()) return false;
  const result = await Notification.requestPermission();
  return result === "granted";
}

export function sendBrowserNotification(title: string, body: string, icon = "🔔") {
  if (!canUseBrowserNotifications()) return;
  if (Notification.permission !== "granted") return;
  try {
    new Notification(title, { body, icon: "/placeholder.svg", badge: "/placeholder.svg", tag: title });
  } catch {
    // SW-only environments
  }
}

// ─── Realtime subscription for live updates ──────────────────────────────

export function subscribeToNotifications(
  userId: string,
  onNew: (n: AppNotification) => void
) {
  const channelName = `notifications-${userId}-${crypto.randomUUID()}`;

  try {
    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const n = payload.new as unknown as AppNotification;
          onNew(n);
          sendBrowserNotification(n.title, n.body, n.icon);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  } catch (error) {
    console.error("Unable to subscribe to notifications", error);
    return () => undefined;
  }
}
