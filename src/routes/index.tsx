import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, CheckCircle2, FileSignature, MessageCircle, Receipt, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Logo } from "@/components/brand/Logo";
import { Wordmark } from "@/components/brand/Wordmark";
import { ThemeToggle } from "@/components/theme-toggle";
import { brl } from "@/lib/format";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Intermo — Intermediar ficou simples." },
      {
        name: "description",
        content:
          "Do WhatsApp ao contrato assinado em menos de 5 minutos. A plataforma de intermediação para empresários que vendem sob encomenda.",
      },
      { property: "og:title", content: "Intermo — Intermediar ficou simples." },
      { property: "og:url", content: "/" },
    ],
    links: [{ rel: "canonical", href: "/" }],
  }),
  component: Landing,
});

const steps = [
  {
    icon: MessageCircle,
    title: "Converse pelo chat",
    desc: "Você conversa com o cliente como já faz no WhatsApp. A Intermo entende o pedido e organiza tudo.",
  },
  {
    icon: FileSignature,
    title: "Contrato pronto em PDF",
    desc: "Em segundos, sai um contrato profissional com seus dados, valores e condições — sem juridiquês.",
  },
  {
    icon: ShieldCheck,
    title: "Assinatura digital",
    desc: "Cliente assina pelo celular. Você acompanha o status em tempo real.",
  },
  {
    icon: Receipt,
    title: "NFS + imposto calculado",
    desc: "Nota de serviço pronta e o DAS estimado já no dashboard. Você só conferir e pagar.",
  },
];

const planFeatures = [
  "Até 200 contratos por mês",
  "R$ 1,00 por contrato excedente",
  "Assinatura digital incluída",
  "NFS e cálculo do DAS automáticos",
  "Suporte por WhatsApp",
  "14 dias grátis (ou 10 contratos)",
];

function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Logo />
          <nav className="hidden items-center gap-8 text-sm text-muted-foreground md:flex">
            <a href="#como-funciona" className="transition-colors hover:text-foreground">Como funciona</a>
            <a href="#preco" className="transition-colors hover:text-foreground">Preço</a>
            <a href="#faq" className="transition-colors hover:text-foreground">Dúvidas</a>
          </nav>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button variant="ghost" asChild className="hidden sm:inline-flex">
              <Link to="/login">Entrar</Link>
            </Button>
            <Button asChild className="bg-brand hover:opacity-90">
              <Link to="/signup">Começar grátis</Link>
            </Button>
          </div>
        </div>
      </header>

      <main>
        {/* HERO */}
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 -z-10 bg-brand-soft" aria-hidden />
          <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
            <div className="mx-auto max-w-3xl text-center">
              <span className="inline-flex items-center rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
                Para quem vende sob encomenda
              </span>
              <h1 className="mt-6 text-balance text-4xl font-bold tracking-tight text-foreground sm:text-6xl">
                Intermediar ficou simples.
              </h1>
              <p className="mx-auto mt-6 max-w-2xl text-balance text-lg text-muted-foreground sm:text-xl">
                Do WhatsApp ao contrato assinado em <strong className="text-foreground">menos de 5 minutos</strong>.
                A Intermo conecta você, seu cliente e seu fornecedor com contrato, assinatura e nota fiscal — tudo em um lugar.
              </p>
              <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Button size="lg" asChild className="bg-brand hover:opacity-90">
                  <Link to="/signup">
                    Começar agora — grátis por 14 dias
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                <Button size="lg" variant="ghost" asChild>
                  <a href="#como-funciona">Ver como funciona</a>
                </Button>
              </div>
              <p className="mt-4 text-xs text-muted-foreground">Sem cartão de crédito. Cancele quando quiser.</p>
            </div>
          </div>
        </section>

        {/* COMO FUNCIONA */}
        <section id="como-funciona" className="border-t border-border/60 bg-card/40">
          <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Como funciona</h2>
              <p className="mt-4 text-muted-foreground">
                Quatro passos. Você cuida da venda, a Intermo cuida do resto.
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

        {/* PREÇO */}
        <section id="preco" className="border-t border-border/60">
          <div className="mx-auto max-w-3xl px-4 py-20 sm:px-6">
            <div className="text-center">
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Um plano. Sem pegadinha.</h2>
              <p className="mt-4 text-muted-foreground">
                Tudo o que você precisa para profissionalizar suas vendas sob encomenda.
              </p>
            </div>
            <Card className="mt-10 overflow-hidden border-border shadow-elevated">
              <div className="bg-brand p-8 text-center">
                <p className="text-sm font-medium uppercase tracking-wider text-primary-foreground/80">
                  Plano Intermo
                </p>
                <div className="mt-3 flex items-baseline justify-center gap-2 text-primary-foreground">
                  <span className="text-5xl font-bold tabular-nums">{brl(149)}</span>
                  <span className="text-base opacity-80">/mês</span>
                </div>
                <p className="mt-3 text-sm text-primary-foreground/85">14 dias grátis ou 10 contratos — o que vier primeiro.</p>
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
                <Button size="lg" asChild className="mt-8 w-full bg-brand hover:opacity-90">
                  <Link to="/signup">Começar grátis</Link>
                </Button>
              </div>
            </Card>
          </div>
        </section>

        {/* FAQ simples */}
        <section id="faq" className="border-t border-border/60 bg-card/40">
          <div className="mx-auto max-w-3xl px-4 py-20 sm:px-6">
            <h2 className="text-center text-3xl font-bold tracking-tight">Perguntas rápidas</h2>
            <div className="mt-10 grid gap-4">
              {[
                {
                  q: "Preciso de cartão para começar?",
                  a: "Não. Você usa por 14 dias ou 10 contratos sem pagar nada.",
                },
                {
                  q: "Funciona pelo celular?",
                  a: "Sim. A Intermo foi desenhada primeiro para o celular — você opera tudo de onde estiver.",
                },
                {
                  q: "E se eu passar dos 200 contratos?",
                  a: "Cada contrato adicional custa R$ 1,00. Nada de surpresa no boleto.",
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
