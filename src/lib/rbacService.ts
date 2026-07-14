import { supabase } from "@/integrations/supabase/client";
import type { RbacAction, RbacRole, RbacSubject } from "./rbacModules";

export interface PermissionRow {
  id?: string;
  role: RbacRole;
  package_key: string | null;
  module: string;
  sub_module: string | null;
  can_view: boolean;
  can_edit: boolean;
  can_delete: boolean;
}

export type PermissionKey = string; // `${module}::${sub_module ?? ""}`

export const permKey = (module: string, sub_module: string | null): PermissionKey =>
  `${module}::${sub_module ?? ""}`;

export async function fetchPermissionsForSubject(
  subject: RbacSubject
): Promise<Record<PermissionKey, PermissionRow>> {
  let q: any = (supabase as any)
    .from("rbac_permissions")
    .select("*")
    .eq("role", subject.role);
  if (subject.packageKey === null) {
    q = q.is("package_key", null);
  } else {
    q = q.eq("package_key", subject.packageKey);
  }
  const { data, error } = await q;
  if (error) throw error;
  const map: Record<PermissionKey, PermissionRow> = {};
  for (const row of (data ?? []) as PermissionRow[]) {
    map[permKey(row.module, row.sub_module)] = row;
  }
  return map;
}

export async function upsertPermissionsForSubject(
  subject: RbacSubject,
  rows: Omit<PermissionRow, "role" | "package_key">[]
) {
  if (!rows.length) return;

  // Fetch existing rows for this subject in one query.
  let existingQ: any = (supabase as any)
    .from("rbac_permissions")
    .select("id, module, sub_module")
    .eq("role", subject.role);
  existingQ =
    subject.packageKey === null
      ? existingQ.is("package_key", null)
      : existingQ.eq("package_key", subject.packageKey);
  const { data: existing, error: fetchErr } = await existingQ;
  if (fetchErr) throw fetchErr;

  const keyOf = (m: string, s: string | null) => `${m}::${s ?? ""}`;
  const idMap = new Map<string, string>();
  for (const r of (existing ?? []) as any[]) {
    idMap.set(keyOf(r.module, r.sub_module ?? null), r.id);
  }

  const toInsert: any[] = [];
  const updates: Promise<any>[] = [];

  for (const row of rows) {
    const id = idMap.get(keyOf(row.module, row.sub_module));
    if (id) {
      updates.push(
        (supabase as any)
          .from("rbac_permissions")
          .update({
            can_view: row.can_view,
            can_edit: row.can_edit,
            can_delete: row.can_delete,
          })
          .eq("id", id)
      );
    } else {
      toInsert.push({
        role: subject.role,
        package_key: subject.packageKey,
        module: row.module,
        sub_module: row.sub_module,
        can_view: row.can_view,
        can_edit: row.can_edit,
        can_delete: row.can_delete,
      });
    }
  }

  const results = await Promise.all(updates);
  for (const res of results) {
    if (res?.error) throw res.error;
  }
  if (toInsert.length) {
    const { error: insErr } = await (supabase as any)
      .from("rbac_permissions")
      .insert(toInsert);
    if (insErr) throw insErr;
  }
}

export async function rbacCan(
  userId: string,
  module: string,
  subModule: string | null,
  action: RbacAction
): Promise<boolean> {
  const { data, error } = await (supabase as any).rpc("rbac_can", {
    _user_id: userId,
    _module: module,
    _sub_module: subModule,
    _action: action,
  });
  if (error) return false;
  return !!data;
}
