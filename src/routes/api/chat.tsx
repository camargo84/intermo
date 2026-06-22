import { createFileRoute } from "@tanstack/react-router";
import { createLovableAiGatewayProvider, getLovableAiGatewayRunId } from "@/lib/ai-gateway.server";
import { convertToModelMessages, streamText, tool, stepCountIs, type UIMessage } from "ai";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { onlyDigits, validateCPF, validateCNPJ, lookupCEP } from "@/lib/validators";

const SYSTEM_PROMPT = `Você é o assistente do Intermo, ajudando o vendedor a registrar uma venda e gerar um contrato de validade jurídica.

Fluxo padrão:
1. Identifique o cliente: peça nome + CPF (ou CNPJ se for pessoa jurídica). Use a ferramenta buscar_cliente para checar se já existe.
2. Se não existir, peça os dados que faltam: RG, nacionalidade (default: brasileiro/a), estado civil, data de nascimento, CEP (use consultar_cep para autocompletar endereço), número, complemento, e-mail e telefone. Chame upsert_cliente.
3. Peça produtos (descrição, quantidade, preço unitário em centavos), valor total em centavos e forma de pagamento ("avista", "parcelado" ou "misto"). Para "misto", peça entrada (> 0 e < valor total). Para "parcelado" e "misto", peça quantidade de parcelas.
4. Confirme o resumo e só chame criar_contrato com confirmado=true depois que o vendedor responder afirmativamente.
5. Em seguida chame gerar_pdf_contrato passando o contract_id retornado e o número de parcelas (quando aplicável). Avise que o PDF está pronto para download.

Após o contrato assinado (etapas financeiras da transação):
- Quando o vendedor informar que o cliente pagou, chame registrar_pagamento_cliente (contract_id, valor_cents, método e data opcionais).
- Quando informar quanto pagou ao fornecedor pelo produto, chame registrar_pagamento_fornecedor (contract_id, valor_cents, nome e documento do fornecedor opcionais).
- Quando informar o frete, chame registrar_frete (contract_id, valor_cents, transportadora opcional).
- Sempre converta valores em reais para centavos antes de chamar a ferramenta (R$ 1.500,00 → 150000). Use o contract_id da transação corrente. Confirme cada registro de forma objetiva.

Regras:
- Não invente CPF, CNPJ, CEP ou e-mail. Pergunte ao vendedor.
- Sempre converta valores em reais para centavos (R$ 9.000,00 → 900000).
- Nunca exiba CPF ou CNPJ por extenso nos resumos — use apenas os últimos dígitos (ex: "***.***.123-45").
- Linguagem objetiva e em português do Brasil.`;

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

        const upsert_cliente = tool({
          description: "Cria ou atualiza um cliente do vendedor. Retorna o client_id.",
          inputSchema: z.object({
            name: z.string().min(2),
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
            const cpf = input.cpf ? onlyDigits(input.cpf) : null;
            const cnpj = input.cnpj ? onlyDigits(input.cnpj) : null;
            if (!cpf && !cnpj) return { error: "Informe CPF ou CNPJ." };
            if (cpf && !validateCPF(cpf)) return { error: "CPF inválido." };
            if (cnpj && !validateCNPJ(cnpj)) return { error: "CNPJ inválido." };

            let existingId: string | null = null;
            if (cpf) {
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
            const payload = {
              user_id: userId,
              name: input.name,
              cpf,
              cnpj,
              rg: input.rg ?? null,
              nacionalidade: input.nacionalidade ?? null,
              estado_civil: input.estado_civil ?? null,
              data_nascimento: input.data_nascimento ?? null,
              cep: input.cep ? onlyDigits(input.cep) : null,
              endereco: input.endereco ?? null,
              complemento: input.complemento ?? null,
              bairro: input.bairro ?? null,
              cidade: input.cidade ?? null,
              uf: input.uf ? input.uf.toUpperCase().slice(0, 2) : null,
              email: input.email ?? null,
              phone: input.phone ? onlyDigits(input.phone) : null,
              is_pj: input.is_pj ?? Boolean(cnpj && !cpf),
            };
            if (existingId) {
              const { error } = await supabase.from("clients").update(payload).eq("id", existingId);
              if (error) return { error: error.message };
              return { client_id: existingId, created: false };
            }
            const { data, error } = await supabase
              .from("clients")
              .insert(payload)
              .select("id")
              .single();
            if (error) return { error: error.message };
            return { client_id: data.id, created: true };
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
                error:
                  'Confirmação pendente: apresente o resumo completo (cliente, produtos, valores, forma de pagamento) e peça ao vendedor que confirme com "sim" antes de criar o contrato.',
              };
            }
            const { criarContrato } = await import("@/lib/agent.functions");
            try {
              // Chamamos a serverFn diretamente — ela usa o bearer pelo middleware.
              // Como estamos dentro de uma route handler com a request original,
              // a serverFn via useServerFn não está disponível; replicamos a lógica core:
              const r = await contractInsertCore(input);
              return r;
            } catch (e) {
              return { error: e instanceof Error ? e.message : String(e) };
            }
          },
        });

        const gerar_pdf_contrato = tool({
          description:
            "Gera o PDF do contrato e retorna uma URL temporária (10 min) para download.",
          inputSchema: z.object({
            contract_id: z.string().uuid(),
            parcelas: z.number().int().positive().max(36).nullable().optional(),
          }),
          execute: async ({ contract_id, parcelas }) => {
            try {
              return await pdfCore(contract_id, parcelas ?? null);
            } catch (e) {
              return { error: e instanceof Error ? e.message : String(e) };
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
          if (profile?.accepted_terms_version !== TERMS_VERSION)
            return { error: "Aceite os novos termos para continuar." };
          const { data: hasSub } = await supabase.rpc("has_active_subscription", {
            _user_id: userId,
          });
          if (!hasSub) return { error: "Sua assinatura não está ativa." };
          // anti-abuso
          const { data: count } = await supabase.rpc("current_month_transaction_count");
          const { data: sub } = await supabase
            .from("subscriptions")
            .select("monthly_contract_quota")
            .eq("user_id", userId)
            .maybeSingle();
          const ceil = sub?.monthly_contract_quota ?? 2000;
          if ((count ?? 0) >= ceil) return { error: "Uso anormal detectado." };
          if (input.forma_pagamento === "misto") {
            if (!(input.entrada_cents > 0 && input.entrada_cents < input.valor_cents)) {
              return { error: "Entrada inválida (deve ser > 0 e < valor total)." };
            }
          }
          const missing: string[] = [];
          if (!profile?.company_legal_name) missing.push("razão social");
          if (!profile?.company_cnpj) missing.push("CNPJ");
          if (!profile?.company_address) missing.push("endereço");
          if (!profile?.company_city || !profile?.company_uf) missing.push("cidade/UF");
          if (!profile?.representative_name) missing.push("representante");
          if (!profile?.comarca) missing.push("comarca");
          if (missing.length) return { error: `Complete em Configurações: ${missing.join(", ")}.` };

          const { data: cli } = await supabase
            .from("clients")
            .select("id,name,email,cpf,cnpj")
            .eq("id", input.client_id)
            .maybeSingle();
          if (!cli) return { error: "Cliente não encontrado." };

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
              if (upErr) return { error: upErr.message };
              return {
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
          if (error) return { error: error.message };
          return { contract_id: row.id as string, parcelas: input.parcelas ?? null };
        }

        async function pdfCore(contract_id: string, parcelas: number | null) {
          const { data: contract } = await supabase
            .from("transactions")
            .select("*")
            .eq("id", contract_id)
            .maybeSingle();
          if (!contract) return { error: "Contrato não encontrado." };
          if (!contract.client_id) return { error: "Contrato sem cliente." };
          const { data: cliente } = await supabase
            .from("clients")
            .select("*")
            .eq("id", contract.client_id)
            .maybeSingle();
          if (!cliente) return { error: "Cliente não encontrado." };
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
          const pdfBytes = await renderContractPdf({
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
          const path = `${userId}/${contract.id}.pdf`;
          const { error: upErr } = await supabaseAdmin.storage
            .from("contract-pdfs")
            .upload(path, pdfBytes, {
              upsert: true,
              contentType: "application/pdf",
            });
          if (upErr) return { error: upErr.message };
          await supabase.from("transactions").update({ pdf_path: path }).eq("id", contract.id);
          const { data: s } = await supabaseAdmin.storage
            .from("contract-pdfs")
            .createSignedUrl(path, 600);
          return { pdf_path: path, signed_url: s?.signedUrl ?? null };
        }

        const result = streamText({
          model,
          system: SYSTEM_PROMPT,
          messages: await convertToModelMessages(body.messages),
          tools: {
            buscar_cliente,
            consultar_cep,
            upsert_cliente,
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
