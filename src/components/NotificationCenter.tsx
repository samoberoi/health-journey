import { useState, useEffect } from "react";
import { Bell } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { fetchUnreadCount, subscribeToNotifications } from "@/lib/notificationService";
import AttentionBadge from "@/components/attention/AttentionBadge";

/**
 * Bell button in the header. Dispatches an event the Dashboard listens to,
 * opening the notifications panel inside the center frame (keeping the sidebar).
 */
export default function NotificationCenter({ unreadCount: controlledCount }: { unreadCount?: number } = {}) {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const count = controlledCount ?? unreadCount;

  useEffect(() => {
    if (controlledCount != null) return;
    if (!user) return;
    fetchUnreadCount(user.id).then(setUnreadCount);
    const unsub = subscribeToNotifications(user.id, () => {
      fetchUnreadCount(user.id).then(setUnreadCount);
    });
    return unsub;
  }, [controlledCount, user]);

  return (
    <button
      onClick={() => window.dispatchEvent(new CustomEvent("nav:open-notifications"))}
      className="relative w-9 h-9 rounded-full liquid-glass flex items-center justify-center"
      aria-label="Notifications"
    >
      <Bell className="w-[18px] h-[18px] text-foreground" strokeWidth={1.8} />
      <AttentionBadge count={count} className="absolute -top-1 -right-1" />
    </button>
  );
}
