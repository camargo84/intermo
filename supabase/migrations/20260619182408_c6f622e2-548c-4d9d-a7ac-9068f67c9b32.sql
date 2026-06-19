ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS signed_pdf_path text,
  ADD COLUMN IF NOT EXISTS signed_pdf_downloaded_at timestamptz;