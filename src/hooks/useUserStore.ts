import { useState, useEffect, useCallback } from "react";
import { getUser, type StoredUser } from "@/lib/userStore";

/**
 * Reactive hook for the localStorage-backed user store.
 * Re-renders whenever saveUser() is called anywhere in the same tab.
 */
export function useUserStore(): StoredUser {
  const [user, setUser] = useState<StoredUser>(getUser);

  const refresh = useCallback(() => setUser(getUser()), []);

  useEffect(() => {
    // Same-tab updates (dispatched by saveUser)
    window.addEventListener("bb_user_updated", refresh);
    // Cross-tab updates (native storage event)
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("bb_user_updated", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, [refresh]);

  return user;
}
