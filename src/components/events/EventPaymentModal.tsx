import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Lock, Check, X, Rocket } from "lucide-react";

interface Props {
  open: boolean;
  amountInr: number;
  title: string;
  subtitle?: string;
  onCancel: () => void;
  onSuccess: () => Promise<void> | void;
}

/**
 * Dummy payment modal that mirrors the Payment.tsx checkout card visually.
 * Used by paid events; validates a card number then resolves after a short delay.
 */
export default function EventPaymentModal({ open, amountInr, title, subtitle, onCancel, onSuccess }: Props) {
  const [card, setCard] = useState("4242 4242 4242 4242");
  const [exp, setExp] = useState("12/29");
  const [cvv, setCvv] = useState("123");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pay = async () => {
    setError(null);
    if (card.replace(/\s/g, "").length < 12) {
      setError("Enter a valid card number.");
      return;
    }
    setLoading(true);
    try {
      await new Promise((r) => setTimeout(r, 1400));
      await onSuccess();
      setDone(true);
      setTimeout(() => {
        setDone(false);
        setLoading(false);
      }, 1400);
    } catch (e: any) {
      setError(e?.message ?? "Payment failed. Please try again.");
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[70] bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            className="w-full sm:max-w-md bg-background rounded-t-3xl sm:rounded-3xl p-6 space-y-4"
          >
            {done ? (
              <div className="py-10 text-center space-y-3">
                <div className="w-16 h-16 rounded-full bg-emerald-100 mx-auto flex items-center justify-center">
                  <Check className="w-8 h-8 text-emerald-600" strokeWidth={2.4} />
                </div>
                <h3 className="text-xl font-black">Payment received!</h3>
                <p className="text-sm text-muted-foreground">You're all set for {title}.</p>
              </div>
            ) : (
              <>
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-xs font-medium text-primary uppercase tracking-widest">Complete payment</span>
                    <h3 className="text-2xl font-black text-foreground leading-tight">{title}</h3>
                    {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
                  </div>
                  <button onClick={onCancel} aria-label="Close" className="p-2 -m-2 text-muted-foreground">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="liquid-glass rounded-2xl p-4 flex items-center justify-between">
                  <div className="text-xs text-muted-foreground">Amount to pay</div>
                  <div className="text-primary font-black text-2xl">₹{amountInr.toLocaleString("en-IN")}</div>
                </div>

                <div className="flex flex-col gap-2">
                  <div className="liquid-glass rounded-2xl px-4 py-3">
                    <p className="text-[10px] uppercase text-muted-foreground font-semibold mb-0.5">Card number</p>
                    <input
                      value={card}
                      onChange={(e) => setCard(e.target.value)}
                      className="bg-transparent text-foreground font-medium text-base outline-none w-full"
                    />
                  </div>
                  <div className="flex gap-2">
                    <div className="flex-1 liquid-glass rounded-2xl px-4 py-3">
                      <p className="text-[10px] uppercase text-muted-foreground font-semibold mb-0.5">Expiry</p>
                      <input
                        value={exp}
                        onChange={(e) => setExp(e.target.value)}
                        className="bg-transparent text-foreground font-medium text-base outline-none w-full"
                      />
                    </div>
                    <div className="flex-1 liquid-glass rounded-2xl px-4 py-3">
                      <p className="text-[10px] uppercase text-muted-foreground font-semibold mb-0.5">CVV</p>
                      <input
                        value={cvv}
                        onChange={(e) => setCvv(e.target.value)}
                        className="bg-transparent text-foreground font-medium text-base outline-none w-full"
                      />
                    </div>
                  </div>
                </div>

                <p className="text-muted-foreground text-[11px] text-center flex items-center justify-center gap-1.5">
                  <Lock className="w-3 h-3" /> Secured checkout · test payment
                </p>

                {error && (
                  <div className="px-3 py-2 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive text-xs text-center">
                    {error}
                  </div>
                )}

                <button
                  onClick={pay}
                  disabled={loading}
                  className="gradient-blue text-primary-foreground font-bold py-3.5 rounded-2xl glow-blue w-full flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {loading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Processing…
                    </>
                  ) : (
                    <>
                      <Rocket className="w-4 h-4" /> Pay ₹{amountInr.toLocaleString("en-IN")}
                    </>
                  )}
                </button>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
