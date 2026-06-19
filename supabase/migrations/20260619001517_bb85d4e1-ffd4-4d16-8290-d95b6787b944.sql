CREATE TABLE public.contract_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  status text,
  signer_email text,
  message text,
  payload jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT ON public.contract_events TO authenticated;
GRANT ALL ON public.contract_events TO service_role;

ALTER TABLE public.contract_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read events of their contracts"
  ON public.contract_events
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.contracts c
      WHERE c.id = contract_events.contract_id
        AND c.user_id = auth.uid()
    )
  );

CREATE INDEX contract_events_contract_id_created_at_idx
  ON public.contract_events (contract_id, created_at DESC);