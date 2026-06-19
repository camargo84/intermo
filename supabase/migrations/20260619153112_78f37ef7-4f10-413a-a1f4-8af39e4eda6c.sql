
-- A. profiles: novos campos do tenant
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS logo_path text,
  ADD COLUMN IF NOT EXISTS company_address text,
  ADD COLUMN IF NOT EXISTS company_city text,
  ADD COLUMN IF NOT EXISTS company_uf text,
  ADD COLUMN IF NOT EXISTS company_cep text,
  ADD COLUMN IF NOT EXISTS representative_name text,
  ADD COLUMN IF NOT EXISTS representative_cpf text,
  ADD COLUMN IF NOT EXISTS representative_qualification text,
  ADD COLUMN IF NOT EXISTS comarca text;

-- B. clients
CREATE TABLE IF NOT EXISTS public.clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  cpf text,
  cnpj text,
  rg text,
  nacionalidade text,
  estado_civil text,
  data_nascimento date,
  cep text,
  endereco text,
  complemento text,
  bairro text,
  cidade text,
  uf text,
  email text,
  phone text,
  is_pj boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT clients_doc_present CHECK (cpf IS NOT NULL OR cnpj IS NOT NULL)
);

CREATE UNIQUE INDEX IF NOT EXISTS clients_user_cpf_uidx
  ON public.clients (user_id, cpf) WHERE cpf IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS clients_user_cnpj_uidx
  ON public.clients (user_id, cnpj) WHERE cnpj IS NOT NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.clients TO authenticated;
GRANT ALL ON public.clients TO service_role;

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "clients_owner_select" ON public.clients
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "clients_owner_insert" ON public.clients
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "clients_owner_update" ON public.clients
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "clients_owner_delete" ON public.clients
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER clients_set_updated_at
  BEFORE UPDATE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- C. contracts: novos campos + constraint misto
ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS produtos jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS forma_pagamento text,
  ADD COLUMN IF NOT EXISTS entrada_cents integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pdf_path text,
  ADD COLUMN IF NOT EXISTS tenant_snapshot jsonb;

DO $$ BEGIN
  ALTER TABLE public.contracts
    ADD CONSTRAINT contracts_forma_pagamento_chk
    CHECK (forma_pagamento IS NULL OR forma_pagamento IN ('avista','parcelado','misto'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.contracts
    ADD CONSTRAINT contracts_entrada_nonneg CHECK (entrada_cents >= 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.contracts
    ADD CONSTRAINT contracts_misto_coerente
    CHECK (
      forma_pagamento IS DISTINCT FROM 'misto'
      OR (entrada_cents > 0 AND value_cents IS NOT NULL AND entrada_cents < value_cents)
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- D. chat_threads
CREATE TABLE IF NOT EXISTS public.chat_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL UNIQUE REFERENCES public.contracts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  messages jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_threads TO authenticated;
GRANT ALL ON public.chat_threads TO service_role;

ALTER TABLE public.chat_threads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "chat_threads_owner_select" ON public.chat_threads
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "chat_threads_owner_insert" ON public.chat_threads
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "chat_threads_owner_update" ON public.chat_threads
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "chat_threads_owner_delete" ON public.chat_threads
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER chat_threads_set_updated_at
  BEFORE UPDATE ON public.chat_threads
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- E. anti-abuso (quota interna)
UPDATE public.subscriptions SET monthly_contract_quota = 2000 WHERE monthly_contract_quota = 200;
ALTER TABLE public.subscriptions ALTER COLUMN monthly_contract_quota SET DEFAULT 2000;
