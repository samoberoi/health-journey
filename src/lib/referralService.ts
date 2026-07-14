import { supabase } from "@/integrations/supabase/client";

export interface ReferralCode {
  id: string;
  user_id: string;
  code: string;
  created_at: string;
}

export interface Referral {
  id: string;
  referrer_id: string;
  referred_user_id: string;
  referral_code: string;
  status: string;
  reward_granted: boolean;
  created_at: string;
}

/** Get or create the current user's referral code */
export async function getOrCreateReferralCode(userId: string): Promise<string | null> {
  // Try to fetch existing
  const { data: existing } = await supabase
    .from("referral_codes" as any)
    .select("code")
    .eq("user_id", userId)
    .maybeSingle();

  if ((existing as any)?.code) return (existing as any).code;

  // Create one — the DB trigger auto-generates the code
  const { data: created, error } = await supabase
    .from("referral_codes" as any)
    .insert({ user_id: userId, code: "" } as any)
    .select("code")
    .single();

  if (error) {
    console.error("Failed to create referral code:", error);
    return null;
  }
  return (created as any)?.code ?? null;
}

/** Fetch all referrals made by this user */
export async function fetchMyReferrals(userId: string): Promise<Referral[]> {
  const { data, error } = await supabase
    .from("referrals" as any)
    .select("*")
    .eq("referrer_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Failed to fetch referrals:", error);
    return [];
  }
  return (data as unknown as Referral[]) ?? [];
}

/** Build a shareable referral link */
export function buildShareLink(code: string): string {
  const baseUrl = window.location.origin;
  return `${baseUrl}/auth?ref=${code}`;
}

/** Share via Web Share API or copy to clipboard */
export async function shareReferralCode(code: string, userName: string): Promise<"shared" | "copied" | "failed"> {
  const link = buildShareLink(code);
  const text = `Hey! I've been using ByeByeDiabetes to manage my health and it's been amazing. Join using my referral code ${code} and we both get rewarded! 🎉`;

  if (navigator.share) {
    try {
      await navigator.share({ title: "Join ByeByeDiabetes", text, url: link });
      return "shared";
    } catch {
      // User cancelled
    }
  }

  // Fallback: copy to clipboard
  try {
    await navigator.clipboard.writeText(`${text}\n${link}`);
    return "copied";
  } catch {
    return "failed";
  }
}
