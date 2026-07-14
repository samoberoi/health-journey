import { supabase } from "@/integrations/supabase/client";

export type AuditModule =
  | "Overview"
  | "Users"
  | "Coaches"
  | "Super Admins"
  | "Access Control"
  | "Packages"
  | "Subscriptions"
  | "Assignments"
  | "Diet"
  | "Supplements"
  | "Conditions"
  | "Fasting"
  | "Movement"
  | "Lab Tests"
  | "Videos"
  | "Exercises"
  | "Control Center"
  | "Languages"
  | "Auth";

export type AuditAction =
  | "create"
  | "update"
  | "delete"
  | "enable"
  | "disable"
  | "assign"
  | "unassign"
  | "login"
  | "logout"
  | "import"
  | "export"
  | "regenerate"
  | "upload"
  | "rebalance"
  | string;

export interface AuditEntry {
  module: AuditModule;
  action: AuditAction;
  target_type?: string;
  target_id?: string | null;
  target_label?: string | null;
  metadata?: Record<string, unknown>;
}

/**
 * Record an admin/coach action to the audit log.
 * Fire-and-forget — never blocks the calling UI.
 */
export function logAudit(entry: AuditEntry): void {
  (async () => {
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) return;
      const url = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/log-audit`;
      await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(entry),
        keepalive: true,
      });
    } catch {
      /* swallow — logs must never break user flows */
    }
  })();
}
