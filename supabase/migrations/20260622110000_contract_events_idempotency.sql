-- Idempotência da trilha de auditoria de contract_events.
--
-- A Autentique reentrega webhooks (retries e entregas fora de ordem). Sem
-- deduplicação, cada reentrega do mesmo evento inseria uma linha duplicada,
-- corrompendo o histórico de auditoria do contrato. Adicionamos um fingerprint
-- determinístico do evento (calculado na aplicação por computeEventFingerprint)
-- e um índice único para que a 2a entrega do MESMO evento seja descartada.

ALTER TABLE public.contract_events
  ADD COLUMN IF NOT EXISTS event_fingerprint text;

-- Índice único PARCIAL: vale só quando event_fingerprint não é nulo.
-- Eventos sintéticos internos (signed_pdf_stored, signed_pdf_fetch_failed) são
-- gravados sem fingerprint e seguem podendo repetir — eles não vêm da
-- Autentique e não fazem parte do contrato de idempotência do webhook.
CREATE UNIQUE INDEX IF NOT EXISTS contract_events_fingerprint_uniq
  ON public.contract_events (event_fingerprint)
  WHERE event_fingerprint IS NOT NULL;
