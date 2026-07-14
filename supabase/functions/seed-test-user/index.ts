import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { phone, name, plan_id, plan_name, plan_price, duration_months, coach_id } = await req.json();
    if (!phone || !plan_id || !coach_id) {
      return new Response(JSON.stringify({ error: "phone, plan_id, coach_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const email = `${phone}@bbd.app`;
    const password = `bbd_${phone}_secure`;

    // Create or fetch auth user
    const { data: existing } = await admin.auth.admin.listUsers();
    let userId = existing?.users?.find((u: any) => u.email === email)?.id ?? "";
    if (!userId) {
      const { data: created, error: cErr } = await admin.auth.admin.createUser({
        email, password, email_confirm: true,
      });
      if (cErr) throw cErr;
      userId = created.user.id;
    }

    // Profile
    const { data: prof } = await admin.from("profiles").select("id").eq("user_id", userId).maybeSingle();
    if (!prof) {
      await admin.from("profiles").insert({
        user_id: userId, phone, name: name ?? "Test User",
        onboarding_completed: true,
      });
    } else {
      await admin.from("profiles").update({ name: name ?? "Test User", onboarding_completed: true }).eq("user_id", userId);
    }

    // User role
    await admin.from("user_roles").upsert({ user_id: userId, role: "user" }, { onConflict: "user_id,role" });

    // Cancel prior active subs
    await admin.from("subscriptions").update({ status: "cancelled" }).eq("user_id", userId).eq("status", "active");

    const now = new Date();
    const expires = new Date(now.getTime()); expires.setMonth(expires.getMonth() + (duration_months ?? 3));
    const { data: sub, error: sErr } = await admin.from("subscriptions").insert({
      user_id: userId,
      plan_id,
      plan_name: plan_name ?? plan_id,
      plan_price: plan_price ?? 0,
      duration_months: duration_months ?? 3,
      started_at: now.toISOString(),
      expires_at: expires.toISOString(),
      status: "active",
    }).select().single();
    if (sErr) throw sErr;

    // Deactivate prior assignments then assign requested coach
    await admin.from("coach_assignments").update({ is_active: false }).eq("user_id", userId).eq("is_active", true);
    await admin.from("coach_assignments").upsert(
      { user_id: userId, coach_id, is_active: true, assigned_at: now.toISOString() },
      { onConflict: "user_id,coach_id" },
    );

    // Persist coach name on profile
    const { data: coach } = await admin.from("coaches").select("name").eq("id", coach_id).single();
    if (coach?.name) {
      await admin.from("profiles").update({ coach_name: coach.name }).eq("user_id", userId);
    }

    return new Response(JSON.stringify({
      success: true, user_id: userId, email, password,
      phone, plan_id, coach: coach?.name, subscription_id: sub.id,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: String(err?.message ?? err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
