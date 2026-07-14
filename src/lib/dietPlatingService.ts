import { supabase } from "@/integrations/supabase/client";

export interface DietPlating {
  id: string;
  user_id: string;
  plan_start_date: string;
  day_index: number;
  meal_slot: "breakfast" | "lunch" | "snack" | "dinner";
  plate_data: { title?: string; items?: string[] } | any;
  calories: number | null;
}

export async function fetchPlatingForUser(userId: string) {
  const { data, error } = await supabase
    .from("diet_platings")
    .select("*")
    .eq("user_id", userId)
    .order("plan_start_date", { ascending: false })
    .order("day_index", { ascending: true })
    .order("meal_slot", { ascending: true });
  if (error) return [] as DietPlating[];
  return (data ?? []) as any[] as DietPlating[];
}

export async function regeneratePlating(userId: string, diet?: string) {
  const args: any = { _user_id: userId };
  if (diet) args._diet = diet;
  const { data, error } = await supabase.rpc("generate_diet_plating" as any, args);
  if (error) throw error;
  return data as number;
}

export async function updatePlate(plateId: string, plateData: any) {
  const { error } = await supabase
    .from("diet_platings")
    .update({ plate_data: plateData })
    .eq("id", plateId);
  if (error) throw error;
}

export async function swapPlate(plateId: string) {
  const { data, error } = await supabase.rpc("swap_diet_plate" as any, {
    _plate_id: plateId,
    _seed: Math.floor(Math.random() * 1_000_000),
  });
  if (error) throw error;
  return data as any;
}

export interface ApprovedFood {
  id: string;
  name: string;
  filter_id: string;
  filter_name: string;
  category_name: string;
  diet_type: string;
}

export async function fetchApprovedFoods(diet: string): Promise<ApprovedFood[]> {
  const dietTypes = diet.includes("vegan")
    ? ["vegan"]
    : diet.includes("veg") && !diet.includes("non")
    ? ["vegan", "veg"]
    : ["vegan", "veg", "non_veg"];
  const { data, error } = await (supabase as any)
    .from("food_items")
    .select("id, name, filter_id, diet_type, recommendation, is_active, food_filters(name, food_categories(name))")
    .eq("is_active", true)
    .in("recommendation", ["encourage", "moderate"])
    .in("diet_type", dietTypes)
    .order("name");
  if (error || !data) return [];
  return (data as any[]).map((r) => ({
    id: r.id,
    name: r.name,
    filter_id: r.filter_id,
    filter_name: r.food_filters?.name ?? "Other",
    category_name: r.food_filters?.food_categories?.name ?? "Other",
    diet_type: r.diet_type,
  }));
}

export async function fetchCurrentDietPreference(userId: string): Promise<string> {
  const { data } = await supabase
    .from("user_diet_profiles")
    .select("diet_preference")
    .eq("user_id", userId)
    .maybeSingle();
  return ((data as any)?.diet_preference ?? "mixed") as string;
}

export function dayIndexForToday(planStartDate: string) {
  const start = new Date(planStartDate + "T00:00:00");
  const now = new Date();
  const diff = Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  return Math.max(0, Math.min(29, diff));
}
