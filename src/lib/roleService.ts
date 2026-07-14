import { supabase } from "@/integrations/supabase/client";

/** Check if a user has the 'coach' role */
export async function isCoachUser(userId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc("has_role" as any, {
    _user_id: userId,
    _role: "coach",
  });
  if (error) {
    console.error("Failed to check coach role:", error);
    return false;
  }
  return !!data;
}

/** Check if a user has the 'admin' role */
export async function isAdminUser(userId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc("has_role" as any, {
    _user_id: userId,
    _role: "admin",
  });
  if (error) {
    console.error("Failed to check admin role:", error);
    return false;
  }
  return !!data;
}
