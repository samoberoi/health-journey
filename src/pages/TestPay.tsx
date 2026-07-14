import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";

declare global {
  interface Window { Razorpay: any }
}

function loadScript(src: string) {
  return new Promise<boolean>((resolve) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve(true);
    const s = document.createElement("script");
    s.src = src;
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

export default function TestPay() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState<string>("");

  useEffect(() => { loadScript("https://checkout.razorpay.com/v1/checkout.js"); }, []);

  const startPayment = async () => {
    setStatus("loading");
    setMessage("");
    try {
      if (!user) throw new Error("Please sign in first.");
      const ok = await loadScript("https://checkout.razorpay.com/v1/checkout.js");
      if (!ok) throw new Error("Failed to load Razorpay checkout.");

      const { data, error } = await supabase.functions.invoke("razorpay-create-order", {
        body: { plan_key: "onboarding_test" },
      });
      if (error) throw error;
      if (!data?.order_id) throw new Error("Could not create order.");

      const rzp = new window.Razorpay({
        key: data.key_id,
        amount: data.amount,
        currency: data.currency,
        order_id: data.order_id,
        name: "Bye Bye Diabetes",
        description: data.plan_name || "Onboarding Test",
        image: "https://bbdo.hyperrevamp.com/favicon.ico",
        prefill: { email: user.email ?? undefined },
        theme: { color: "#248CCB" },
        handler: async (resp: any) => {
          const { data: v, error: vErr } = await supabase.functions.invoke("razorpay-verify-payment", {
            body: resp,
          });
          if (vErr || !v?.verified) {
            setStatus("error");
            setMessage("Payment received but signature verification failed. Contact support.");
            return;
          }
          setStatus("success");
          setMessage(`Payment successful! Payment ID: ${resp.razorpay_payment_id}`);
        },
        modal: {
          ondismiss: () => { setStatus("idle"); setMessage("Payment cancelled."); },
        },
      });
      rzp.on("payment.failed", (resp: any) => {
        setStatus("error");
        setMessage(resp?.error?.description || "Payment failed.");
      });
      rzp.open();
    } catch (e: any) {
      setStatus("error");
      setMessage(e?.message || "Something went wrong.");
    }
  };

  return (
    <div className="min-h-dvh bg-background flex flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-md liquid-glass rounded-3xl p-8 text-center">
        <p className="text-xs uppercase tracking-widest text-primary font-semibold mb-2">Razorpay Live Test</p>
        <h1 className="text-3xl font-black text-foreground mb-2">Onboarding Test ₹1</h1>
        <p className="text-sm text-muted-foreground mb-6">
          Validates the live Razorpay integration end-to-end. Use any real card, UPI, or scan the QR at checkout.
        </p>

        <button
          onClick={startPayment}
          disabled={status === "loading"}
          className="gradient-blue text-primary-foreground font-bold py-4 px-6 rounded-2xl w-full glow-blue disabled:opacity-60"
        >
          {status === "loading" ? "Opening checkout..." : "Pay ₹1 with Razorpay"}
        </button>

        {message && (
          <p className={`mt-4 text-sm ${status === "success" ? "text-success" : status === "error" ? "text-destructive" : "text-muted-foreground"}`}>
            {message}
          </p>
        )}

        <button onClick={() => navigate("/")} className="mt-6 text-xs text-muted-foreground underline">
          Back home
        </button>

        {!user && (
          <p className="mt-4 text-xs text-amber-500">You must be signed in to test payments.</p>
        )}
      </div>
    </div>
  );
}
