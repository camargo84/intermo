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

UPDATE storage.buckets SET public = false WHERE id = 'contract-pdfs';
UPDATE storage.buckets SET public = false WHERE id = 'tenant-logos';
