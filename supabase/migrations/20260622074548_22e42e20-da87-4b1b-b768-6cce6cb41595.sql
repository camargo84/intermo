ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS plan text NOT NULL DEFAULT 'promo',
  ADD COLUMN IF NOT EXISTS promo_cycles_remaining int,
  ADD COLUMN IF NOT EXISTS plan_change_scheduled_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_amount_cents int;

ALTER TABLE public.subscriptions
  ADD CONSTRAINT subscriptions_plan_check CHECK (plan IN ('promo','full'));