import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Logo } from "@/components/brand/Logo";
import { ThemeToggle } from "@/components/theme-toggle";

type AuthLayoutProps = {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
};

/**
 * Tela de auth no estilo Claude: split-screen.
 * Esquerda: marca + headline editorial serif + formulário.
 * Direita: preview escuro de uma conversa do produto (mock estático).
 */
export function AuthLayout({ title, subtitle, children, footer }: AuthLayoutProps) {
  return (
    <div className="relative min-h-screen bg-background">
      <header className="absolute inset-x-0 top-0 z-10 flex items-center justify-between px-6 py-5">
        <Link to="/" aria-label="inTermo">
          <Logo />
        </Link>
        <ThemeToggle />
      </header>

      <div className="grid min-h-screen grid-cols-1 lg:grid-cols-2">
        {/* Coluna esquerda — formulário */}
        <section className="flex items-center justify-center px-6 py-24">
          <div className="w-full max-w-md">
            <h1 className="font-serif-display text-4xl leading-[1.05] text-foreground sm:text-5xl">
              {title}
            </h1>
            {subtitle ? (
              <p className="mt-3 text-sm text-muted-foreground sm:text-base">{subtitle}</p>
            ) : null}

            <div className="mt-8">{children}</div>

            {footer ? <div className="mt-6 text-sm text-muted-foreground">{footer}</div> : null}
          </div>
        </section>

        {/* Coluna direita — preview do produto */}
        <aside className="relative hidden items-center justify-center overflow-hidden bg-[oklch(0.16_0.005_60)] px-10 py-24 lg:flex">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-50"
            style={{
              background:
                "radial-gradient(60% 50% at 30% 20%, rgba(63,226,128,0.10), transparent 60%), radial-gradient(50% 40% at 80% 80%, rgba(204,120,92,0.12), transparent 60%)",
            }}
          />
          <ChatPreviewMock />
        </aside>
      </div>
    </div>
  );
}

function ChatPreviewMock() {
  return (
    <div className="relative w-full max-w-md rounded-2xl border border-white/8 bg-[oklch(0.20_0.005_60)] p-5 shadow-2xl">
      <div className="mb-4 flex items-center gap-2">
        <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
        <span className="ml-2 text-[11px] uppercase tracking-[0.14em] text-white/40">
          conversa · inTermo
        </span>
      </div>

      <div className="space-y-4 text-[13px] leading-relaxed">
        <div className="text-white/90">
          <span className="font-serif-display text-base italic text-[color:var(--color-coral)]">
            Olá.
          </span>{" "}
          Me conta o nome ou CPF do cliente para eu buscar no cadastro.
        </div>

        <div className="flex justify-end">
          <div className="max-w-[80%] rounded-2xl bg-[color:var(--color-signal-mint)] px-3 py-2 text-[13px] text-[color:var(--color-abyss)]">
            Maria Oliveira, CPF 123.456.789-09
          </div>
        </div>

        <div className="text-white/85">
          Cliente não encontrado. Vou cadastrar. Preciso do RG, nacionalidade, estado civil, data de nascimento, CEP, número, e-mail e telefone.
        </div>

        <div className="flex justify-end">
          <div className="max-w-[80%] rounded-2xl bg-[color:var(--color-signal-mint)] px-3 py-2 text-[13px] text-[color:var(--color-abyss)]">
            RG 12.345.678-9, brasileira, casada, 15/03/1990, CEP 01415-001
          </div>
        </div>

        <div className="text-white/60 text-[11px] flex items-center gap-1.5">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-[color:var(--color-signal-mint)]" />
          Consultando CEP… Rua Oscar Freire, Jardins, São Paulo/SP
        </div>

        <div className="text-white/85">
          Endereço autocompletado. Cadastro salvo. Agora os produtos: descrição, quantidade e preço unitário.
        </div>

        <div className="flex justify-end">
          <div className="max-w-[80%] rounded-2xl bg-[color:var(--color-signal-mint)] px-3 py-2 text-[13px] text-[color:var(--color-abyss)]">
            iPhone 15 Pro 256GB preto, 1 unidade, R$ 9.000 à vista
          </div>
        </div>

        <div className="text-white/85">
          Resumo: Maria Oliveira, iPhone 15 Pro 256GB preto, R$ 9.000,00 à vista. Confirma para gerar o contrato?
        </div>

        <div className="flex justify-end">
          <div className="max-w-[80%] rounded-2xl bg-[color:var(--color-signal-mint)] px-3 py-2 text-[13px] text-[color:var(--color-abyss)]">
            Sim, gera o contrato
          </div>
        </div>

        <div className="text-white/60 text-[11px] flex items-center gap-1.5">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-[color:var(--color-signal-mint)]" />
          Contrato gerado · PDF pronto
        </div>

        <div className="text-white/90">
          Contrato gerado com validade jurídica. PDF pronto para download. Quer enviar o link de assinatura digital para o cliente via WhatsApp?
        </div>
      </div>
    </div>
  );
}
