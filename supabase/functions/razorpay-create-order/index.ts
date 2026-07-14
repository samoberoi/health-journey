import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const KEY_ID = Deno.env.get("RAZORPAY_KEY_ID");
    const KEY_SECRET = Deno.env.get("RAZORPAY_KEY_SECRET");
    if (!KEY_ID || !KEY_SECRET) throw new Error("Razorpay keys not configured");

    const authHeader = req.headers.get("Authorization") ?? "";
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Identify user via JWT
    const jwt = authHeader.replace("Bearer ", "");
    const { data: userData } = await supabase.auth.getUser(jwt);
    const user = userData?.user;
    if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const body = await req.json().catch(() => ({}));
    const planKey: string = body.plan_key || "onboarding_test";

    // Look up plan price
    const { data: pkg, error: pkgErr } = await supabase
      .from("packages")
      .select("plan_key, name, base_monthly_price")
      .eq("plan_key", planKey)
      .eq("enabled", true)
      .maybeSingle();
    if (pkgErr || !pkg) throw new Error("Package not found");

    const amountPaise = Math.max(100, Math.round(Number(pkg.base_monthly_price) * 100));
    const receipt = `bbdo_${user.id.slice(0, 8)}_${Date.now()}`;

    // Create Razorpay order
    const auth = btoa(`${KEY_ID}:${KEY_SECRET}`);
    const rzpRes = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Basic ${auth}` },
      body: JSON.stringify({
        amount: amountPaise,
        currency: "INR",
        receipt,
        notes: { user_id: user.id, plan_key: planKey, source: "bbdo" },
      }),
    });
    const order = await rzpRes.json();
    if (!rzpRes.ok) {
      console.error("Razorpay order create failed", order);
      return new Response(JSON.stringify({ error: order?.error?.description || "Razorpay error" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    await supabase.from("razorpay_payments").insert({
      user_id: user.id,
      plan_key: planKey,
      order_id: order.id,
      amount_paise: amountPaise,
      currency: "INR",
      status: "created",
      notes: { receipt, name: pkg.name },
    });

    return new Response(
      JSON.stringify({ order_id: order.id, key_id: KEY_ID, amount: amountPaise, currency: "INR", plan_name: pkg.name }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
