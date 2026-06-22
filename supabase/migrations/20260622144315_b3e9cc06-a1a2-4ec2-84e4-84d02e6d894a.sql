-- No schema changes; this migration exists to trigger type regeneration after the
-- event_fingerprint column was added to contract_events in a previous migration.
SELECT 1;
