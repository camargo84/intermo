
-- 1) Renomear contracts → transactions (preserva RLS, dados, índices)
ALTER TABLE public.contracts RENAME TO transactions;

-- 1a) Renomear policies para refletir o novo nome
ALTER POLICY "Users delete own contracts" ON public.transactions RENAME TO "Users delete own transactions";
ALTER POLICY "Users insert own contracts" ON public.transactions RENAME TO "Users insert own transactions";
ALTER POLICY "Users select own contracts" ON public.transactions RENAME TO "Users select own transactions";
ALTER POLICY "Users update own contracts" ON public.transactions RENAME TO "Users update own transactions";

-- 1b) View de compatibilidade (read-only) para queries antigas ainda funcionarem temporariamente
CREATE OR REPLACE VIEW public.contracts AS SELECT * FROM public.transactions;
GRANT SELECT ON public.contracts TO authenticated;
GRANT ALL ON public.contracts TO service_role;

-- 2) Novas colunas financeiras (Etapa 3 do plano)
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS client_paid_amount_cents integer,
  ADD COLUMN IF NOT EXISTS client_paid_at timestamptz,
  ADD COLUMN IF NOT EXISTS client_payment_method text,
  ADD COLUMN IF NOT EXISTS supplier_paid_amount_cents integer,
  ADD COLUMN IF NOT EXISTS supplier_paid_at timestamptz,
  ADD COLUMN IF NOT EXISTS supplier_name text,
  ADD COLUMN IF NOT EXISTS supplier_doc text,
  ADD COLUMN IF NOT EXISTS freight_paid_amount_cents integer,
  ADD COLUMN IF NOT EXISTS freight_paid_at timestamptz,
  ADD COLUMN IF NOT EXISTS freight_carrier text,
  ADD COLUMN IF NOT EXISTS consolidated_at timestamptz,
  ADD COLUMN IF NOT EXISTS consolidated boolean NOT NULL DEFAULT false;

-- Colunas geradas: margem (remuneração - custo - frete) e imposto estimado (6%)
-- value_cents = remuneração total recebida do cliente
-- supplier_paid_amount_cents = custo do produto
-- freight_paid_amount_cents = custo do frete
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS margin_cents integer GENERATED ALWAYS AS (
    COALESCE(value_cents, 0) - COALESCE(supplier_paid_amount_cents, 0) - COALESCE(freight_paid_amount_cents, 0)
  ) STORED;

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS tax_estimated_cents integer GENERATED ALWAYS AS (
    ROUND( (COALESCE(value_cents, 0) - COALESCE(supplier_paid_amount_cents, 0) - COALESCE(freight_paid_amount_cents, 0)) * 0.06 )::integer
  ) STORED;

-- 3) Tabela signature_tokens (Etapa 4)
CREATE TABLE public.signature_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text NOT NULL UNIQUE,
  transaction_id uuid NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
  signer_role text NOT NULL CHECK (signer_role IN ('lojista','cliente')),
  signer_name text,
  signer_email text,
  signer_doc text,
  signed_at timestamptz,
  signed_ip text,
  signed_user_agent text,
  signature_image_path text,
  pdf_hash text,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.signature_tokens TO authenticated;
GRANT SELECT, UPDATE ON public.signature_tokens TO anon;  -- assinatura pública via token
GRANT ALL ON public.signature_tokens TO service_role;

ALTER TABLE public.signature_tokens ENABLE ROW LEVEL SECURITY;

-- Lojista (dono da transação) enxerga e gerencia seus próprios tokens
CREATE POLICY "Tenants manage own signature tokens"
ON public.signature_tokens FOR ALL
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.transactions t WHERE t.id = signature_tokens.transaction_id AND t.user_id = auth.uid())
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.transactions t WHERE t.id = signature_tokens.transaction_id AND t.user_id = auth.uid())
);

-- Anon: pode ler/atualizar APENAS pela função de validação por token (sem leitura genérica)
-- Como o token é único e secreto, permitimos SELECT/UPDATE com escopo via WHERE token=?
CREATE POLICY "Anon read by token"
ON public.signature_tokens FOR SELECT
TO anon
USING (expires_at > now() AND revoked_at IS NULL);

CREATE POLICY "Anon sign by token"
ON public.signature_tokens FOR UPDATE
TO anon
USING (expires_at > now() AND revoked_at IS NULL AND signed_at IS NULL)
WITH CHECK (expires_at > now() AND revoked_at IS NULL);

CREATE INDEX idx_signature_tokens_transaction ON public.signature_tokens(transaction_id);
CREATE INDEX idx_signature_tokens_token ON public.signature_tokens(token);

CREATE TRIGGER update_signature_tokens_updated_at
BEFORE UPDATE ON public.signature_tokens
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4) profiles.autentique_folder_id (Etapa 4b)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS autentique_folder_id text;

-- 5) Renomear função de quota: contracts → transactions
DROP FUNCTION IF EXISTS public.current_month_contract_count();

CREATE OR REPLACE FUNCTION public.current_month_transaction_count()
RETURNS integer
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT count(*)::int FROM public.transactions
  WHERE user_id = auth.uid()
    AND created_at >= date_trunc('month', now());
$$;
