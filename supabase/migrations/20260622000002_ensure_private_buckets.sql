-- Garante que os buckets sensíveis sejam PRIVADOS.
--
-- Os buckets foram criados pela UI/API do Lovable (não por migration), então o
-- flag public/private não estava versionado. Esta migration fixa o estado
-- desejado de forma idempotente.
--
-- contract-pdfs guarda os PDFs dos contratos e as imagens de assinatura — se o
-- bucket estiver público, qualquer um com a URL do objeto lê o documento,
-- tornando o RLS de SELECT irrelevante. O acesso legítimo é feito por URL
-- assinada de curta duração (createSignedUrl, 600s) gerada server-side via
-- service_role. Logo o bucket DEVE ser privado.
--
-- Não criamos policies de INSERT/UPDATE/DELETE de propósito: com RLS ativo e
-- sem policy de escrita, o deny implícito já garante que só o service_role
-- escreve. Adicionar policy de escrita abriria acesso desnecessário.

-- Idempotente e seguro para `supabase db push`:
--   * Se o bucket não existir (ambiente novo), cria já PRIVADO.
--   * Se existir, força public = false.
--   * Alguns runners de migration (ex.: a tool do Lovable) bloqueiam escrita
--     direta em storage.buckets. Nesses casos o bloco captura insufficient_
--     privilege e emite NOTICE em vez de derrubar o push inteiro — o estado
--     privado é então garantido pela storage API. Em `supabase db push` via CLI
--     (role owner) a escrita ocorre normalmente.
DO $$
BEGIN
  INSERT INTO storage.buckets (id, name, public)
  VALUES ('contract-pdfs', 'contract-pdfs', false),
         ('tenant-logos',  'tenant-logos',  false)
  ON CONFLICT (id) DO UPDATE SET public = false;
EXCEPTION
  WHEN insufficient_privilege THEN
    RAISE NOTICE 'Sem privilégio para escrever em storage.buckets neste runner; garanta os buckets privados via storage API.';
END $$;
