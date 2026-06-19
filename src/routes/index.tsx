import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  BadgeCheck,
  CheckCircle2,
  FileSignature,
  FileSpreadsheet,
  PenLine,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Logo } from "@/components/brand/Logo";
import { Wordmark } from "@/components/brand/Wordmark";
import { ThemeToggle } from "@/components/theme-toggle";
import { brl } from "@/lib/format";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Intermo — Cliente empolgado não espera burocracia." },
      {
        name: "description",
        content:
          "Transforme a conversa em contrato assinado em minutos, com validade jurídica. Feche antes da venda esfriar — sem improviso.",
      },
      { property: "og:title", content: "Intermo — Cliente empolgado não espera burocracia." },
      {
        property: "og:description",
        content:
          "Contrato pronto, assinatura com validade jurídica e margem calculada. A Intermo formaliza suas vendas sob encomenda em minutos.",
      },
      { property: "og:url", content: "/" },
    ],
    links: [{ rel: "canonical", href: "/" }],
  }),
  component: Landing,
});

const steps = [
  {
    icon: FileSignature,
    title: "Crie o contrato em minutos",
    desc: "Assistente guiado coleta os dados — ou o próprio cliente preenche pelo link — e monta o contrato pra você.",
  },
  {
    icon: ShieldCheck,
    title: "Contrato pronto e seguro",
    desc: "Modelo testado no mercado, atualizado com a legislação, com cláusulas de prazo, reembolso, multa e garantia.",
  },
  {
    icon: PenLine,
    title: "Assinatura com validade jurídica",
    desc: "O cliente assina pelo link com validade jurídica garantida pela Lei 14.063/2020.",
  },
  {
    icon: FileSpreadsheet,
    title: "Tudo pronto pro seu contador",
    desc: "As informações de cada transação ficam organizadas e prontas pra você enviar ao seu contador. Sem planilha, sem garimpo.",
  },
];

const planFeatures = [
  "Contratos ilimitados",
  "Assinatura digital com validade jurídica inclusa",
  "Modelo de contrato sempre atualizado",
  "Cálculo automático de margem",
  "Transações organizadas pro seu contador",
  "Sem fidelidade",
];

function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-[color:var(--border-hairline)] bg-background/60 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Logo />
          <nav className="hidden items-center gap-8 text-sm font-medium text-foreground/80 md:flex">
            <a href="#como-funciona" className="transition-colors hover:text-foreground">Como funciona</a>
            <a href="#preco" className="transition-colors hover:text-foreground">Preço</a>
            <a href="#faq" className="transition-colors hover:text-foreground">Dúvidas</a>
          </nav>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button variant="ghost" asChild className="hidden sm:inline-flex">
              <Link to="/login">Entrar</Link>
            </Button>
            <Button asChild>
              <Link to="/signup">Assinar agora</Link>
            </Button>
          </div>
        </div>
      </header>

      <main>
        {/* HERO */}
        <section className="relative overflow-hidden">
          <div className="mx-auto grid max-w-6xl grid-cols-1 gap-12 px-4 py-20 sm:px-6 sm:py-28 md:grid-cols-12">
            <div className="md:col-span-7">
              <span className="inline-flex items-center rounded-full border border-[color:var(--border-hairline)] bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
                Para quem vende sob encomenda
              </span>
              <h1 className="mt-6 text-balance text-left text-4xl font-bold tracking-tight text-foreground sm:text-6xl">
                Cliente empolgado não espera burocracia.
              </h1>
              <p className="mt-6 max-w-[640px] text-balance text-left text-lg text-muted-foreground sm:text-xl">
                O <strong className="text-foreground">"fechado!"</strong> tem prazo de validade. A Intermo transforma a conversa em
                contrato assinado em minutos, com validade jurídica e a segurança que o seu negócio merece.
                Sem esfriar a venda, sem improviso.
              </p>
              <div className="mt-10 flex flex-col items-start justify-start gap-3 sm:flex-row">
                <Button size="lg" asChild>
                  <Link to="/signup">
                    Fechar antes de esfriar
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                <Button size="lg" variant="ghost" asChild>
                  <a href="#como-funciona">Ver como funciona</a>
                </Button>
              </div>
              <p className="mt-4 text-left text-xs text-muted-foreground">7 dias de garantia. Não gostou? Devolvemos 100%. Cancele quando quiser.</p>
            </div>
            <div className="hidden md:col-span-5 md:block" aria-hidden />
          </div>
        </section>

        {/* COMO FUNCIONA */}
        <section id="como-funciona" className="border-t border-border/60 bg-card/40">
          <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Como funciona</h2>
              <p className="mt-4 text-muted-foreground">
                Quatro passos. Você fecha a venda, a Intermo formaliza.
              </p>
            </div>
            <ol className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              {steps.map((s, i) => (
                <li key={s.title} className="relative">
                  <Card className="h-full p-6 shadow-card transition-shadow hover:shadow-elevated">
                    <div className="flex items-center gap-3">
                      <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10 text-accent">
                        <s.icon className="h-5 w-5" />
                      </span>
                      <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        Passo {i + 1}
                      </span>
                    </div>
                    <h3 className="mt-4 text-lg font-semibold">{s.title}</h3>
                    <p className="mt-2 text-sm text-muted-foreground">{s.desc}</p>
                  </Card>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* DIFERENCIAIS */}
        <section className="border-t border-border/60">
          <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Por que Intermo</h2>
              <p className="mt-4 text-muted-foreground">
                Assinar um PDF qualquer um faz. A Intermo entrega o contrato certo, calcula sua margem e organiza as transações — não só a assinatura.
              </p>
            </div>
            <div className="mt-12 grid gap-6 md:grid-cols-3">
              <Card className="p-6 shadow-card">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10 text-accent">
                  <ShieldCheck className="h-5 w-5" />
                </span>
                <h3 className="mt-4 text-lg font-semibold">Validade jurídica de verdade</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Assinatura digital amparada pela Lei 14.063/2020. O cliente assina pelo link e o contrato vale em juízo.
                </p>
              </Card>
              <Card className="p-6 shadow-card">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10 text-accent">
                  <BadgeCheck className="h-5 w-5" />
                </span>
                <h3 className="mt-4 text-lg font-semibold">Contrato sempre atualizado</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Modelo revisado e atualizado conforme a legislação, testado em operação real — você não improvisa cláusula.
                </p>
              </Card>
              <Card className="p-6 shadow-card">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10 text-accent">
                  <Sparkles className="h-5 w-5" />
                </span>
                <h3 className="mt-4 text-lg font-semibold">Mais que assinatura</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Margem calculada automaticamente e transações organizadas pro seu contador — tudo no mesmo lugar.
                </p>
              </Card>
            </div>
          </div>
        </section>

        {/* PREÇO */}
        <section id="preco" className="border-t border-border/60 bg-card/40">
          <div className="mx-auto max-w-3xl px-4 py-20 sm:px-6">
            <div className="text-center">
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Plano mensal. Cancele quando quiser.</h2>
              <p className="mt-4 text-muted-foreground">
                Tudo o que você precisa para formalizar suas vendas sob encomenda sem esfriar o cliente.
              </p>
            </div>
            <Card className="mt-10 overflow-hidden border-border shadow-elevated">
              <div className="bg-brand p-8 text-center text-primary-foreground">
                <p className="text-sm font-medium uppercase tracking-wider text-primary-foreground/80">
                  Plano Intermo
                </p>
                <div className="mt-3 flex items-baseline justify-center gap-2">
                  <span className="text-5xl font-bold tabular-nums">{brl(119)}</span>
                  <span className="text-base opacity-80">/mês</span>
                </div>
                <p className="mt-3 text-sm text-primary-foreground/85">
                  Menos que a multa de um único contrato mal feito.
                </p>
              </div>
              <div className="p-8">
                <ul className="space-y-3">
                  {planFeatures.map((f) => (
                    <li key={f} className="flex items-start gap-3 text-sm">
                      <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <Button size="lg" asChild className="mt-8 w-full bg-brand text-primary-foreground hover:opacity-90">
                  <Link to="/signup">Experimente grátis por 7 dias</Link>
                </Button>
                <p className="mt-3 text-center text-xs text-muted-foreground">
                  Sem cartão. Até 3 contratos no teste.
                </p>
              </div>
            </Card>
          </div>
        </section>

        {/* FAQ simples */}
        <section id="faq" className="border-t border-border/60">
          <div className="mx-auto max-w-3xl px-4 py-20 sm:px-6">
            <h2 className="text-center text-3xl font-bold tracking-tight">Perguntas rápidas</h2>
            <div className="mt-10 grid gap-4">
              {[
                {
                  q: "Preciso de cartão para começar?",
                  a: "Não. Você experimenta por 7 dias (até 3 contratos) sem pagar nada.",
                },
                {
                  q: "Funciona pelo celular?",
                  a: "Sim. A Intermo foi desenhada primeiro para o celular — você opera tudo de onde estiver.",
                },
                {
                  q: "Tem limite de contratos?",
                  a: "Não. No plano Intermo os contratos e assinaturas são ilimitados.",
                },
              ].map((item) => (
                <Card key={item.q} className="p-5">
                  <p className="font-medium">{item.q}</p>
                  <p className="mt-2 text-sm text-muted-foreground">{item.a}</p>
                </Card>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border/60">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 px-4 py-10 sm:flex-row sm:px-6">
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <Wordmark className="text-base" />
            <span>© {new Date().getFullYear()} Intermo</span>
          </div>
          <nav className="flex items-center gap-6 text-sm text-muted-foreground">
            <Link to="/termos" className="transition-colors hover:text-foreground">Termos</Link>
            <Link to="/privacidade" className="transition-colors hover:text-foreground">Privacidade</Link>
            <Link to="/login" className="transition-colors hover:text-foreground">Entrar</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
