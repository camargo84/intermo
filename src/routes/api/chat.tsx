import { createFileRoute } from "@tanstack/react-router";
import { createLovableAiGatewayProvider, getLovableAiGatewayRunId } from "@/lib/ai-gateway.server";
import { convertToModelMessages, streamText, tool, stepCountIs, type UIMessage } from "ai";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { onlyDigits, validateCPF, validateCNPJ, lookupCEP } from "@/lib/validators";
import { profileMissingFields, clientMissingFields } from "@/lib/contract-requirements";
import {
  normalizeDateBR,
  normalizeCEP,
  normalizePhoneBR,
  InputFormatError,
} from "@/lib/normalize-input";

const BASE_SYSTEM_PROMPT = `Você é o assistente do Intermo, ajudando o vendedor a registrar uma venda, gerar contrato de validade jurídica e enviar para assinatura.

MEMÓRIA E CONTEXTO (LEIA PRIMEIRO):
- O bloco "CONTEXTO DA CONVERSA" abaixo é a fonte da verdade sobre o estado atual da transação (cliente vinculado, documento, telefone, endereço, produtos, valores). Ele é atualizado a cada turno a partir do banco de dados.
- NUNCA volte a pedir uma informação que já está no CONTEXTO ou que o vendedor acabou de informar nas mensagens anteriores. Reaproveite dados (CPF, CNPJ, telefone, endereço, valores, produtos, forma de pagamento) sem perguntar de novo.
- Se um cliente já está vinculado (active_client_id presente), você JÁ tem CPF/CNPJ — use upsert_cliente com client_id para atualizar campos faltantes (ex: CEP, endereço) SEM pedir o documento novamente. NUNCA peça CPF/CNPJ se active_client_id está no CONTEXTO.

Fluxo padrão:
1. Identifique o cliente: peça nome + CPF (ou CNPJ se PJ). SEMPRE peça CPF/CNPJ antes de chamar buscar_cliente — a busca é só por documento (dois clientes podem ter o mesmo nome). Se já houver active_client_id no CONTEXTO, pule esta etapa.
2. Se faltam dados (RG, nacionalidade, estado civil, data de nascimento — aceita DD/MM/AAAA, CEP — use consultar_cep, número, complemento, e-mail, telefone), peça e chame upsert_cliente. Se já houver active_client_id, passe-o em upsert_cliente para atualizar sem repedir documento.
3. Peça produtos (descrição, quantidade, preço unitário em centavos), valor total em centavos e forma de pagamento ("avista", "parcelado" ou "misto"). Para "misto", entrada > 0 e < total. Para "parcelado" e "misto", quantidade de parcelas.
4. ANTES de propor gerar contrato, chame preflight_contrato com o client_id. Se vier "missing_profile", oriente o vendedor a abrir Configurações. Se vier "missing_client", complete via upsert_cliente. NUNCA chame criar_contrato sem preflight ok=true.
5. Confirme o resumo e só chame criar_contrato com confirmado=true depois do vendedor confirmar.
6. Em seguida chame gerar_pdf_contrato passando o contract_id e parcelas (quando aplicável). Devolva a URL temporária do PDF como link clicável em markdown: [Baixar PDF](URL).
7. Após o PDF gerado, NÃO encerre. Pergunte: "Posso enviar o contrato para assinatura via Autentique agora?". Se sim, chame enviar_para_assinatura e mostre o link do signatário em markdown clicável.
8. Em seguida ofereça o link para WhatsApp. Se cliente_phone_e164 estiver no CONTEXTO, pergunte: "Envio o link de assinatura para o número cadastrado (terminado em <últimos 4>) ou para outro número?". Com a resposta, chame gerar_link_whatsapp passando o telefone (ou nada, para usar o cadastrado). Devolva a URL wa.me como link clicável em markdown: [Enviar pelo WhatsApp](URL). Se o vendedor preferir só o link em si (sem WhatsApp), chame gerar_link_assinatura e devolva-o em markdown.

Tratamento de erros:
- Toda ferramenta devolve { ok: true, ... } ou { ok: false, error_code, message_pt, ... }.
- Em { ok: false }: NÃO tente novamente automaticamente. Traduza message_pt para o vendedor em UMA mensagem clara, e pare. PROFILE_INCOMPLETE → abrir Configurações. CLIENT_INCOMPLETE/INVALID_INPUT → peça apenas o(s) campo(s) que faltam. MISSING_PHONE → peça o número de WhatsApp. ALREADY_SENT → informe que já foi enviado e ofereça reenvio só pela tela de Transações.

Após o contrato (etapas financeiras):
- cliente pagou → registrar_pagamento_cliente; pago ao fornecedor → registrar_pagamento_fornecedor; frete → registrar_frete. Sempre converta reais para centavos (R$ 1.500,00 → 150000).

Regras:
- Não invente CPF, CNPJ, CEP, telefone ou e-mail. Pergunte ao vendedor — exceto quando já estiverem no CONTEXTO.
- Reais → centavos (R$ 9.000,00 → 900000).
- Nunca exiba CPF/CNPJ por extenso — use só os últimos dígitos ("***.***.123-45").
- Para telefone exiba só os últimos 4 dígitos ("(**) ****-1234").
- TODA URL (PDF, link de assinatura, wa.me) deve ser entregue como link markdown clicável: [Texto](https://...).
- Linguagem objetiva, português do Brasil.`;

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authHeader = request.headers.get("authorization");
        if (!authHeader?.startsWith("Bearer ")) {
          return new Response("Unauthorized", { status: 401 });
        }
        const token = authHeader.slice(7);

        const SUPABASE_URL = process.env.SUPABASE_URL!;
        const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY!;
        const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
        if (!LOVABLE_API_KEY) return new Response("Missing LOVABLE_API_KEY", { status: 500 });

        // Cliente Supabase autenticado pelo bearer (RLS aplica como usuário)
        const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
          global: { headers: { Authorization: `Bearer ${token}` } },
          auth: { persistSession: false, autoRefreshToken: false },
        });
        const { data: userRes } = await supabase.auth.getUser();
        if (!userRes?.user) return new Response("Unauthorized", { status: 401 });
        const userId = userRes.user.id;

        const body = (await request.json()) as { messages?: UIMessage[]; contractId?: string };
        if (!Array.isArray(body.messages)) return new Response("Bad request", { status: 400 });

        // Garante ownership do contrato (thread)
        if (body.contractId) {
          const { data: c } = await supabase
            .from("transactions")
            .select("id")
            .eq("id", body.contractId)
            .maybeSingle();
          if (!c) return new Response("Contrato não encontrado", { status: 404 });
        }

        const initialRunId = getLovableAiGatewayRunId(request);
        const gateway = createLovableAiGatewayProvider(LOVABLE_API_KEY, initialRunId);
        const model = gateway("google/gemini-3-flash-preview");

        // -------- Tools --------
        const buscar_cliente = tool({
          description:
            "Busca cliente do vendedor APENAS por documento (CPF ou CNPJ). Nunca aceita busca por nome — dois clientes podem ter o mesmo nome. Sempre peça CPF/CNPJ ao vendedor antes de chamar.",
          inputSchema: z.object({
            documento: z
              .string()
              .min(11)
              .describe("CPF (11 dígitos) ou CNPJ (14 dígitos). Pontuação é ignorada."),
          }),
          execute: async ({ documento }) => {
            const digits = onlyDigits(documento);
            const isCpf = digits.length === 11;
            const isCnpj = digits.length === 14;
            if (!isCpf && !isCnpj) {
              return { error: "Informe CPF (11 dígitos) ou CNPJ (14 dígitos). Busca por nome não é permitida." };
            }
            if (isCpf && !validateCPF(digits)) return { error: "CPF inválido." };
            if (isCnpj && !validateCNPJ(digits)) return { error: "CNPJ inválido." };
            const column = isCpf ? "cpf" : "cnpj";
            const { data, error } = await supabase
              .from("clients")
              .select("id,name,cpf,cnpj,email,phone,cidade,uf")
              .eq("user_id", userId)
              .eq(column, digits)
              .limit(1);
            if (error) return { error: error.message };
            return { clientes: data ?? [] };
          },
        });

        const consultar_cep = tool({
          description:
            "Consulta endereço pelo CEP via ViaCEP. Use sempre que o vendedor informar um CEP novo.",
          inputSchema: z.object({ cep: z.string() }),
          execute: async ({ cep }) => {
            const r = await lookupCEP(cep);
            if (!r) return { error: "CEP não encontrado." };
            return {
              cep: r.cep,
              logradouro: r.logradouro,
              bairro: r.bairro,
              cidade: r.localidade,
              uf: r.uf,
            };
          },
        });

        const preflight_contrato = tool({
          description:
            "Checa se o perfil do vendedor e o cliente têm todos os campos obrigatórios para gerar o contrato. Chame ANTES de propor gerar o contrato. Retorna { ok, missing_profile, missing_client }.",
          inputSchema: z.object({ client_id: z.string().uuid() }),
          execute: async ({ client_id }) => {
            const { data: prof } = await supabase
              .from("profiles")
              .select(
                "company_legal_name,company_cnpj,company_address,company_city,company_uf,representative_name,comarca",
              )
              .eq("id", userId)
              .maybeSingle();
            const { data: cli } = await supabase
              .from("clients")
              .select("name,cpf,cnpj,email,endereco,cidade,uf,cep")
              .eq("id", client_id)
              .maybeSingle();
            const missing_profile = profileMissingFields(prof);
            const missing_client = clientMissingFields(cli);
            return {
              ok: missing_profile.length === 0 && missing_client.length === 0,
              missing_profile,
              missing_client,
            };
          },
        });



        const upsert_cliente = tool({
          description:
            "Cria ou atualiza um cliente do vendedor. Retorna o client_id. Se já existir um cliente vinculado à transação (active_client_id no CONTEXTO), passe client_id para atualizar campos sem precisar reenviar CPF/CNPJ.",
          inputSchema: z.object({
            client_id: z
              .string()
              .uuid()
              .nullable()
              .optional()
              .describe(
                "ID de um cliente já existente para atualizar. Use o active_client_id do CONTEXTO quando estiver completando dados (CEP, endereço, etc.) sem repedir documento.",
              ),
            name: z.string().min(2).nullable().optional(),
            cpf: z.string().nullable().optional(),
            cnpj: z.string().nullable().optional(),
            rg: z.string().nullable().optional(),
            nacionalidade: z.string().nullable().optional(),
            estado_civil: z.string().nullable().optional(),
            data_nascimento: z.string().nullable().optional(),
            cep: z.string().nullable().optional(),
            endereco: z.string().nullable().optional(),
            complemento: z.string().nullable().optional(),
            bairro: z.string().nullable().optional(),
            cidade: z.string().nullable().optional(),
            uf: z.string().nullable().optional(),
            email: z.string().nullable().optional(),
            phone: z.string().nullable().optional(),
            is_pj: z.boolean().optional(),
          }),
          execute: async (input) => {
            // Se vier client_id, carrega o cliente existente para herdar campos faltantes
            // (especialmente documento) e evitar exigir CPF/CNPJ novamente.
            let existingClient: {
              id: string;
              name: string | null;
              cpf: string | null;
              cnpj: string | null;
            } | null = null;
            if (input.client_id) {
              const { data: r } = await supabase
                .from("clients")
                .select("id,name,cpf,cnpj")
                .eq("id", input.client_id)
                .eq("user_id", userId)
                .maybeSingle();
              if (!r) {
                return {
                  ok: false,
                  error_code: "CLIENT_NOT_FOUND",
                  message_pt: "Cliente não encontrado para atualização.",
                };
              }
              existingClient = r;
            }

            const cpf = input.cpf ? onlyDigits(input.cpf) : existingClient?.cpf ?? null;
            const cnpj = input.cnpj ? onlyDigits(input.cnpj) : existingClient?.cnpj ?? null;
            if (!cpf && !cnpj) {
              return {
                ok: false,
                error_code: "INVALID_INPUT",
                field: "documento",
                message_pt: "Informe CPF ou CNPJ.",
              };
            }
            if (cpf && !validateCPF(cpf)) {
              return { ok: false, error_code: "INVALID_INPUT", field: "cpf", message_pt: "CPF inválido." };
            }
            if (cnpj && !validateCNPJ(cnpj)) {
              return { ok: false, error_code: "INVALID_INPUT", field: "cnpj", message_pt: "CNPJ inválido." };
            }

            // Normalização tolerante (DD/MM/AAAA, CEP/telefone com pontuação, etc.)
            let dataNascimento: string | null = null;
            let cep: string | null = null;
            let phone: string | null = null;
            try {
              dataNascimento = normalizeDateBR(input.data_nascimento ?? null);
              cep = normalizeCEP(input.cep ?? null);
              phone = normalizePhoneBR(input.phone ?? null);
            } catch (e) {
              if (e instanceof InputFormatError) {
                return {
                  ok: false,
                  error_code: "INVALID_INPUT",
                  field: e.field,
                  message_pt: e.message,
                };
              }
              throw e;
            }

            let existingId: string | null = existingClient?.id ?? null;
            if (!existingId && cpf) {
              const { data: r } = await supabase
                .from("clients")
                .select("id")
                .eq("user_id", userId)
                .eq("cpf", cpf)
                .maybeSingle();
              if (r) existingId = r.id;
            }
            if (!existingId && cnpj) {
              const { data: r } = await supabase
                .from("clients")
                .select("id")
                .eq("user_id", userId)
                .eq("cnpj", cnpj)
                .maybeSingle();
              if (r) existingId = r.id;
            }
            const resolvedName = input.name ?? existingClient?.name ?? null;
            if (!existingId && !resolvedName) {
              return {
                ok: false,
                error_code: "INVALID_INPUT",
                field: "name",
                message_pt: "Informe o nome do cliente.",
              };
            }
            const payload = {
              user_id: userId,
              name: resolvedName ?? "",
              cpf,
              cnpj,
              rg: input.rg ?? null,
              nacionalidade: input.nacionalidade ?? null,
              estado_civil: input.estado_civil ?? null,
              data_nascimento: dataNascimento,
              cep,
              endereco: input.endereco ?? null,
              complemento: input.complemento ?? null,
              bairro: input.bairro ?? null,
              cidade: input.cidade ?? null,
              uf: input.uf ? input.uf.toUpperCase().slice(0, 2) : null,
              email: input.email ?? null,
              phone,
              is_pj: input.is_pj ?? Boolean(cnpj && !cpf),
            };
            let resultClientId: string;
            let created: boolean;
            if (existingId) {
              // Em updates, não sobrescreve campos que não vieram no input (mantém o que existe).
              const updatePayload: Record<string, unknown> = { user_id: userId };
              if (input.name !== undefined && input.name !== null) updatePayload.name = input.name;
              if (input.cpf !== undefined) updatePayload.cpf = cpf;
              if (input.cnpj !== undefined) updatePayload.cnpj = cnpj;
              if (input.rg !== undefined) updatePayload.rg = input.rg;
              if (input.nacionalidade !== undefined) updatePayload.nacionalidade = input.nacionalidade;
              if (input.estado_civil !== undefined) updatePayload.estado_civil = input.estado_civil;
              if (input.data_nascimento !== undefined) updatePayload.data_nascimento = dataNascimento;
              if (input.cep !== undefined) updatePayload.cep = cep;
              if (input.endereco !== undefined) updatePayload.endereco = input.endereco;
              if (input.complemento !== undefined) updatePayload.complemento = input.complemento;
              if (input.bairro !== undefined) updatePayload.bairro = input.bairro;
              if (input.cidade !== undefined) updatePayload.cidade = input.cidade;
              if (input.uf !== undefined) updatePayload.uf = input.uf ? input.uf.toUpperCase().slice(0, 2) : null;
              if (input.email !== undefined) updatePayload.email = input.email;
              if (input.phone !== undefined) updatePayload.phone = phone;
              if (input.is_pj !== undefined) updatePayload.is_pj = input.is_pj;
              const { error } = await supabase.from("clients").update(updatePayload as never).eq("id", existingId);
              if (error) {
                console.error("[chat] upsert_cliente update error", error);
                return { ok: false, error_code: "DB_ERROR", message_pt: "Não consegui salvar o cliente. Tente novamente." };
              }
              resultClientId = existingId;
              created = false;
            } else {
              const { data, error } = await supabase
                .from("clients")
                .insert(payload as never)
                .select("id")
                .single();
              if (error) {
                console.error("[chat] upsert_cliente insert error", error);
                return { ok: false, error_code: "DB_ERROR", message_pt: "Não consegui cadastrar o cliente. Tente novamente." };
              }
              resultClientId = data.id;
              created = true;
            }

            // Vincula o cliente à transação corrente se ainda for um rascunho sem cliente,
            // para que a sidebar (e o resumo) reflitam o nome do cliente imediatamente.
            if (body.contractId) {
              const { data: tx } = await supabase
                .from("transactions")
                .select("id,status,client_id")
                .eq("id", body.contractId)
                .maybeSingle();
              if (tx && tx.status === "draft" && !tx.client_id) {
                await supabase
                  .from("transactions")
                  .update({ client_id: resultClientId, client_name: resolvedName ?? "" } as never)
                  .eq("id", body.contractId);
              }
            }
            return { client_id: resultClientId, created };
          },
        });

        const criar_contrato = tool({
          description:
            "Cria o contrato e monta o snapshot do vendedor. Use depois de confirmar o resumo com o usuário.",
          inputSchema: z.object({
            client_id: z.string().uuid(),
            produtos: z
              .array(
                z.object({
                  descricao: z.string(),
                  quantidade: z.number().int().positive(),
                  preco_unit_cents: z.number().int().positive(),
                }),
              )
              .min(1),
            valor_cents: z.number().int().positive(),
            forma_pagamento: z.enum(["avista", "parcelado", "misto"]),
            entrada_cents: z.number().int().nonnegative().default(0),
            parcelas: z.number().int().positive().max(36).nullable().optional(),
            confirmado: z
              .boolean()
              .describe(
                "Defina true SOMENTE após o vendedor confirmar explicitamente o resumo (cliente, produtos, valores, forma de pagamento) em mensagem. Se o vendedor ainda não confirmou, envie false.",
              ),
          }),
          execute: async (input) => {
            if (!input.confirmado) {
              return {
                ok: false,
                error_code: "CONFIRMATION_PENDING",
                message_pt:
                  'Confirmação pendente: apresente o resumo completo (cliente, produtos, valores, forma de pagamento) e peça ao vendedor que confirme com "sim" antes de criar o contrato.',
              };
            }
            try {
              return await contractInsertCore(input);
            } catch (e) {
              console.error("[chat] criar_contrato fatal", e);
              return {
                ok: false,
                error_code: "INTERNAL_ERROR",
                message_pt: "Não consegui criar o contrato. Tente novamente.",
              };
            }
          },
        });

        const gerar_pdf_contrato = tool({
          description:
            "Gera o PDF do contrato e retorna uma URL temporária (10 min) para download. Devolve ok:false em caso de erro — não tente novamente sem orientar o usuário.",
          inputSchema: z.object({
            contract_id: z.string().uuid(),
            parcelas: z.number().int().positive().max(36).nullable().optional(),
          }),
          execute: async ({ contract_id, parcelas }) => {
            try {
              return await pdfCore(contract_id, parcelas ?? null);
            } catch (e) {
              console.error("[chat] gerar_pdf_contrato fatal", e);
              return {
                ok: false,
                error_code: "PDF_RENDER_FAILED",
                message_pt: "Não foi possível gerar o PDF. Tente novamente em instantes.",
              };
            }
          },
        });


        // -------- Ferramentas de etapas financeiras (pós-contrato) --------
        const registrar_pagamento_cliente = tool({
          description:
            "Registra o pagamento recebido do cliente para uma transação já existente. Use quando o vendedor informar que o cliente pagou.",
          inputSchema: z.object({
            contract_id: z.string().uuid(),
            valor_cents: z.number().int().positive(),
            metodo: z.string().nullable().optional(),
            data: z.string().nullable().optional(),
          }),
          execute: async ({ contract_id, valor_cents, metodo, data }) => {
            const { error } = await supabase
              .from("transactions")
              .update({
                client_paid_amount_cents: valor_cents,
                client_payment_method: metodo ?? null,
                client_paid_at: data ?? new Date().toISOString(),
              })
              .eq("id", contract_id);
            if (error) return { error: error.message };
            return { ok: true, client_paid_amount_cents: valor_cents };
          },
        });

        const registrar_pagamento_fornecedor = tool({
          description:
            "Registra o pagamento feito ao fornecedor (custo do produto) de uma transação. Use quando o vendedor informar quanto pagou ao fornecedor.",
          inputSchema: z.object({
            contract_id: z.string().uuid(),
            valor_cents: z.number().int().positive(),
            fornecedor: z.string().nullable().optional(),
            documento: z.string().nullable().optional(),
            data: z.string().nullable().optional(),
          }),
          execute: async ({ contract_id, valor_cents, fornecedor, documento, data }) => {
            const { error } = await supabase
              .from("transactions")
              .update({
                supplier_paid_amount_cents: valor_cents,
                supplier_name: fornecedor ?? null,
                supplier_doc: documento ?? null,
                supplier_paid_at: data ?? new Date().toISOString(),
              })
              .eq("id", contract_id);
            if (error) return { error: error.message };
            return { ok: true, supplier_paid_amount_cents: valor_cents };
          },
        });

        const registrar_frete = tool({
          description:
            "Registra o custo de frete de uma transação. Use quando o vendedor informar o valor do frete e/ou a transportadora.",
          inputSchema: z.object({
            contract_id: z.string().uuid(),
            valor_cents: z.number().int().positive(),
            transportadora: z.string().nullable().optional(),
            data: z.string().nullable().optional(),
          }),
          execute: async ({ contract_id, valor_cents, transportadora, data }) => {
            const { error } = await supabase
              .from("transactions")
              .update({
                freight_paid_amount_cents: valor_cents,
                freight_carrier: transportadora ?? null,
                freight_paid_at: data ?? new Date().toISOString(),
              })
              .eq("id", contract_id);
            if (error) return { error: error.message };
            return { ok: true, freight_paid_amount_cents: valor_cents };
          },
        });

        // --- core helpers que usam o supabase já autenticado deste handler ---
        async function contractInsertCore(input: {
          client_id: string;
          produtos: Array<{ descricao: string; quantidade: number; preco_unit_cents: number }>;
          valor_cents: number;
          forma_pagamento: "avista" | "parcelado" | "misto";
          entrada_cents: number;
          parcelas?: number | null;
        }) {
          // termos + assinatura
          const { TERMS_VERSION } = await import("@/lib/terms");
          const { data: profile } = await supabase
            .from("profiles")
            .select(
              "accepted_terms_version,company_legal_name,company_fantasy_name,company_cnpj,company_address,company_city,company_uf,company_cep,representative_name,representative_qualification,comarca",
            )
            .eq("id", userId)
            .maybeSingle();
          if (profile?.accepted_terms_version !== TERMS_VERSION) {
            return {
              ok: false,
              error_code: "TERMS_OUTDATED",
              message_pt: "Aceite os novos termos em Configurações para continuar.",
            };
          }
          const { data: hasSub } = await supabase.rpc("has_active_subscription", {
            _user_id: userId,
          });
          if (!hasSub) {
            return {
              ok: false,
              error_code: "NO_SUBSCRIPTION",
              message_pt: "Sua assinatura não está ativa.",
            };
          }
          // anti-abuso
          const { data: count } = await supabase.rpc("current_month_transaction_count");
          const { data: sub } = await supabase
            .from("subscriptions")
            .select("monthly_contract_quota")
            .eq("user_id", userId)
            .maybeSingle();
          const ceil = sub?.monthly_contract_quota ?? 2000;
          if ((count ?? 0) >= ceil) {
            return {
              ok: false,
              error_code: "RATE_LIMITED",
              message_pt: "Limite mensal atingido. Tente novamente mais tarde.",
            };
          }
          if (input.forma_pagamento === "misto") {
            if (!(input.entrada_cents > 0 && input.entrada_cents < input.valor_cents)) {
              return {
                ok: false,
                error_code: "INVALID_INPUT",
                field: "entrada_cents",
                message_pt: "Entrada inválida: deve ser maior que zero e menor que o valor total.",
              };
            }
          }
          // Preflight de perfil — bloqueia a criação se faltar dado obrigatório.
          const missingProfile = profileMissingFields(profile);
          if (missingProfile.length) {
            return {
              ok: false,
              error_code: "PROFILE_INCOMPLETE",
              missing_fields: missingProfile,
              message_pt: `Faltam dados do seu perfil: ${missingProfile.join(", ")}. Abra Configurações para completar.`,
            };
          }

          const { data: cli } = await supabase
            .from("clients")
            .select("id,name,email,cpf,cnpj,endereco,cidade,uf,cep")
            .eq("id", input.client_id)
            .maybeSingle();
          if (!cli) {
            return {
              ok: false,
              error_code: "CLIENT_NOT_FOUND",
              message_pt: "Cliente não encontrado.",
            };
          }
          const missingClient = clientMissingFields(cli);
          if (missingClient.length) {
            return {
              ok: false,
              error_code: "CLIENT_INCOMPLETE",
              missing_fields: missingClient,
              message_pt: `Faltam dados do cliente: ${missingClient.join(", ")}.`,
            };
          }


          const tenant_snapshot = {
            company_legal_name: profile.company_legal_name,
            company_fantasy_name: profile.company_fantasy_name,
            company_cnpj: profile.company_cnpj,
            company_address: profile.company_address,
            company_city: profile.company_city,
            company_uf: profile.company_uf,
            company_cep: profile.company_cep,
            representative_name: profile.representative_name,
            representative_qualification: profile.representative_qualification,
            comarca: profile.comarca,
          };

          const title = `Contrato — ${cli.name}`;
          const content = input.produtos.map((p) => `${p.quantidade}x ${p.descricao}`).join("; ");
          const clientDoc = (cli.cpf ?? cli.cnpj ?? null) as string | null;
          const clientEmail = (cli.email ?? "") as string;

          const basePayload = {
            client_id: input.client_id,
            title,
            content,
            client_name: cli.name,
            client_email: clientEmail,
            client_doc: clientDoc,
            produtos: input.produtos,
            value_cents: input.valor_cents,
            forma_pagamento: input.forma_pagamento,
            entrada_cents: input.entrada_cents,
            tenant_snapshot,
          };

          // Promover o rascunho da própria thread, se existir e ainda for draft sem client.
          if (body.contractId) {
            const { data: thread } = await supabase
              .from("transactions")
              .select("id,user_id,status,client_id")
              .eq("id", body.contractId)
              .maybeSingle();
            if (
              thread &&
              thread.user_id === userId &&
              thread.status === "draft" &&
              !thread.client_id
            ) {
              const { error: upErr } = await supabase
                .from("transactions")
                .update(basePayload as never)
                .eq("id", thread.id);
              if (upErr) {
                console.error("[chat] criar_contrato promote error", upErr);
                return {
                  ok: false,
                  error_code: "DB_ERROR",
                  message_pt: "Não consegui salvar o contrato. Tente novamente.",
                };
              }
              return {
                ok: true,
                contract_id: thread.id as string,
                parcelas: input.parcelas ?? null,
                promoted: true,
              };
            }
          }

          // Idempotência: se já houver um draft recente (< 2 min) para o mesmo
          // cliente deste usuário, devolve o contrato existente em vez de duplicar.
          const dedupeSince = new Date(Date.now() - 2 * 60 * 1000).toISOString();
          const { data: recent } = await supabase
            .from("transactions")
            .select("id")
            .eq("user_id", userId)
            .eq("client_id", input.client_id)
            .eq("status", "draft")
            .gte("created_at", dedupeSince)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          if (recent) {
            return {
              ok: true,
              contract_id: recent.id as string,
              parcelas: input.parcelas ?? null,
              deduped: true,
            };
          }

          const { data: row, error } = await supabase
            .from("transactions")
            .insert({ user_id: userId, ...basePayload } as never)
            .select("id")
            .single();
          if (error) {
            console.error("[chat] criar_contrato insert error", error);
            return {
              ok: false,
              error_code: "DB_ERROR",
              message_pt: "Não consegui salvar o contrato. Tente novamente.",
            };
          }
          return { ok: true, contract_id: row.id as string, parcelas: input.parcelas ?? null };
        }

        async function pdfCore(contract_id: string, parcelas: number | null) {
          const { data: contract } = await supabase
            .from("transactions")
            .select("*")
            .eq("id", contract_id)
            .maybeSingle();
          if (!contract) {
            return { ok: false, error_code: "CONTRACT_NOT_FOUND", message_pt: "Contrato não encontrado." };
          }
          if (!contract.client_id) {
            return { ok: false, error_code: "CONTRACT_INCOMPLETE", message_pt: "Contrato sem cliente." };
          }
          // Preflight: validar snapshot do vendedor antes de renderizar.
          const tenantSnap = (contract.tenant_snapshot ?? null) as
            | Parameters<typeof profileMissingFields>[0]
            | null;
          const missingProfile = profileMissingFields(tenantSnap);
          if (missingProfile.length) {
            return {
              ok: false,
              error_code: "PROFILE_INCOMPLETE",
              missing_fields: missingProfile,
              message_pt: `Faltam dados do seu perfil: ${missingProfile.join(", ")}. Abra Configurações para completar e tente novamente.`,
            };
          }
          const { data: cliente } = await supabase
            .from("clients")
            .select("*")
            .eq("id", contract.client_id)
            .maybeSingle();
          if (!cliente) {
            return { ok: false, error_code: "CLIENT_NOT_FOUND", message_pt: "Cliente não encontrado." };
          }
          const missingClient = clientMissingFields(cliente);
          if (missingClient.length) {
            return {
              ok: false,
              error_code: "CLIENT_INCOMPLETE",
              missing_fields: missingClient,
              message_pt: `Faltam dados do cliente: ${missingClient.join(", ")}.`,
            };
          }
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { data: prof } = await supabase
            .from("profiles")
            .select("logo_path")
            .eq("id", userId)
            .maybeSingle();
          let logoBytes: Uint8Array | null = null;
          let logoMime: "image/png" | "image/jpeg" | null = null;
          if (prof?.logo_path) {
            const { data: blob } = await supabaseAdmin.storage
              .from("tenant-logos")
              .download(prof.logo_path);
            if (blob) {
              logoBytes = new Uint8Array(await blob.arrayBuffer());
              logoMime =
                prof.logo_path.endsWith(".jpg") || prof.logo_path.endsWith(".jpeg")
                  ? "image/jpeg"
                  : "image/png";
            }
          }
          const { renderContractPdf } = await import("@/lib/contracts.pdf.server");
          const tenant = contract.tenant_snapshot as never;
          let pdfBytes: Uint8Array;
          try {
            pdfBytes = await renderContractPdf({
              tenant,
              cliente: cliente as never,
              produtos: (contract.produtos as never) ?? [],
              valor_cents: contract.value_cents ?? 0,
              forma_pagamento: (contract.forma_pagamento ?? "avista") as
                | "avista"
                | "parcelado"
                | "misto",
              entrada_cents: contract.entrada_cents ?? 0,
              parcelas,
              logoBytes,
              logoMime,
            });
          } catch (e) {
            console.error("[chat] renderContractPdf failed", e);
            return {
              ok: false,
              error_code: "PDF_RENDER_FAILED",
              message_pt: "Não foi possível gerar o PDF. Tente novamente em instantes.",
            };
          }
          const path = `${userId}/${contract.id}.pdf`;
          const { error: upErr } = await supabaseAdmin.storage
            .from("contract-pdfs")
            .upload(path, pdfBytes, {
              upsert: true,
              contentType: "application/pdf",
            });
          if (upErr) {
            console.error("[chat] pdf upload failed", upErr);
            return {
              ok: false,
              error_code: "PDF_UPLOAD_FAILED",
              message_pt: "Não consegui salvar o PDF. Tente novamente.",
            };
          }
          await supabase.from("transactions").update({ pdf_path: path }).eq("id", contract.id);
          const { data: s } = await supabaseAdmin.storage
            .from("contract-pdfs")
            .createSignedUrl(path, 600);
          return { ok: true, pdf_path: path, signed_url: s?.signedUrl ?? null };
        }


        // Monta um bloco de CONTEXTO com o estado atual da transação para que o
        // modelo nunca peça novamente algo que já foi informado/persistido.
        let contextBlock = "\n\nCONTEXTO DA CONVERSA:\n- (sem transação ativa)";
        if (body.contractId) {
          const { data: tx } = await supabase
            .from("transactions")
            .select(
              "id,status,client_id,client_name,client_doc,produtos,value_cents,forma_pagamento,entrada_cents",
            )
            .eq("id", body.contractId)
            .maybeSingle();
          const lines: string[] = [`- transaction_id: ${body.contractId}`];
          if (tx?.status) lines.push(`- status: ${tx.status}`);
          if (tx?.client_id) {
            lines.push(`- active_client_id: ${tx.client_id}`);
            const { data: cli } = await supabase
              .from("clients")
              .select(
                "name,cpf,cnpj,rg,nacionalidade,estado_civil,data_nascimento,cep,endereco,complemento,bairro,cidade,uf,email,phone",
              )
              .eq("id", tx.client_id)
              .maybeSingle();
            if (cli) {
              const mask = (d: string | null) =>
                d ? `***.***.${d.slice(-5, -2)}-${d.slice(-2)}` : "(não informado)";
              lines.push(`- cliente: ${cli.name ?? "(sem nome)"}`);
              lines.push(`- documento: ${mask(cli.cpf ?? cli.cnpj ?? null)} (já cadastrado — NÃO peça de novo)`);
              const camposPresentes: string[] = [];
              const camposFaltando: string[] = [];
              const checkField = (label: string, val: unknown) => {
                if (val != null && String(val).trim() !== "") camposPresentes.push(label);
                else camposFaltando.push(label);
              };
              checkField("rg", cli.rg);
              checkField("nacionalidade", cli.nacionalidade);
              checkField("estado_civil", cli.estado_civil);
              checkField("data_nascimento", cli.data_nascimento);
              checkField("cep", cli.cep);
              checkField("endereco", cli.endereco);
              checkField("bairro", cli.bairro);
              checkField("cidade", cli.cidade);
              checkField("uf", cli.uf);
              checkField("email", cli.email);
              checkField("phone", cli.phone);
              if (camposPresentes.length)
                lines.push(`- cliente_campos_preenchidos: ${camposPresentes.join(", ")}`);
              if (camposFaltando.length)
                lines.push(`- cliente_campos_faltando: ${camposFaltando.join(", ")}`);
            }
          }
          if (tx?.produtos) {
            try {
              const arr = Array.isArray(tx.produtos) ? tx.produtos : JSON.parse(String(tx.produtos));
              if (Array.isArray(arr) && arr.length) {
                lines.push(`- produtos: ${arr.map((p) => `${p.quantidade ?? "?"}x ${p.descricao ?? "?"}`).join("; ")}`);
              }
            } catch {
              // ignora parse
            }
          }
          if (tx?.value_cents) lines.push(`- valor_cents: ${tx.value_cents}`);
          if (tx?.forma_pagamento) lines.push(`- forma_pagamento: ${tx.forma_pagamento}`);
          if (tx?.entrada_cents) lines.push(`- entrada_cents: ${tx.entrada_cents}`);
          contextBlock = `\n\nCONTEXTO DA CONVERSA:\n${lines.join("\n")}`;
        }

        const result = streamText({
          model,
          system: BASE_SYSTEM_PROMPT + contextBlock,
          messages: await convertToModelMessages(body.messages),
          tools: {
            buscar_cliente,
            consultar_cep,
            upsert_cliente,
            preflight_contrato,
            criar_contrato,
            gerar_pdf_contrato,
            registrar_pagamento_cliente,
            registrar_pagamento_fornecedor,
            registrar_frete,
          },
          stopWhen: stepCountIs(50),
        });

        // Persistir thread ao final
        return result.toUIMessageStreamResponse({
          originalMessages: body.messages,
          onFinish: async ({ messages }) => {
            if (!body.contractId) return;
            const { data: existing } = await supabase
              .from("chat_threads")
              .select("id")
              .eq("contract_id", body.contractId)
              .maybeSingle();
            const payload = { messages: messages as never };
            if (existing) {
              await supabase.from("chat_threads").update(payload).eq("id", existing.id);
            } else {
              await supabase.from("chat_threads").insert({
                contract_id: body.contractId,
                user_id: userId,
                ...payload,
              } as never);
            }
          },
        });
      },
    },
  },
});
