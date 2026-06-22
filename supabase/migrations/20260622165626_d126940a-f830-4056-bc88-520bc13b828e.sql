-- Apply contract_events idempotency (column + partial unique index).
-- Previous migration file exists but the column is missing in the live database,
-- causing TS2322 in the webhook. Re-apply idempotently.

ALTER TABLE public.contract_events
  ADD COLUMN IF NOT EXISTS event_fingerprint text;

CREATE UNIQUE INDEX IF NOT EXISTS contract_events_fingerprint_uniq
  ON public.contract_events (event_fingerprint)
  WHERE event_fingerprint IS NOT NULL;