
CREATE TABLE IF NOT EXISTS public.razorpay_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  plan_key TEXT,
  order_id TEXT UNIQUE NOT NULL,
  payment_id TEXT,
  signature TEXT,
  amount_paise INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'INR',
  status TEXT NOT NULL DEFAULT 'created',
  signature_verified BOOLEAN NOT NULL DEFAULT false,
  notes JSONB DEFAULT '{}'::jsonb,
  raw_event JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.razorpay_payments TO authenticated;
GRANT ALL ON public.razorpay_payments TO service_role;

ALTER TABLE public.razorpay_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own payments" ON public.razorpay_payments
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Admins view all payments" ON public.razorpay_payments
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER razorpay_payments_updated_at
  BEFORE UPDATE ON public.razorpay_payments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
