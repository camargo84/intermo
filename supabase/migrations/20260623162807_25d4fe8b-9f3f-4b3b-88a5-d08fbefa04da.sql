
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS chat_threads_messages_fts_idx
  ON public.chat_threads
  USING GIN (to_tsvector('portuguese', messages::text));

CREATE INDEX IF NOT EXISTS transactions_client_name_trgm_idx
  ON public.transactions
  USING GIN (client_name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS transactions_title_trgm_idx
  ON public.transactions
  USING GIN (title gin_trgm_ops);
