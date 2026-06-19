import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  Check,
  FileSignature,
  FileSpreadsheet,
  Fingerprint,
  Lock,
  PenLine,
  Scale,
  ShieldCheck,
  ShieldHalf,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Wordmark } from "@/components/brand/Wordmark";
import { LivePanel } from "@/components/landing/LivePanel";
import { brl } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Intermo — Da conversa ao contrato assinado em minutos." },
      {
        name: "description",
        content:
          "A Intermo formaliza vendas sob encomenda: contrato pronto, assinatura com validade jurídica e gestão das transações no mesmo lugar.",
      },
      { property: "og:title", content: "Intermo — Da conversa ao contrato assinado em minutos." },
      {
        property: "og:description",
        content:
          "Contrato pronto, assinatura com validade jurídica e gestão das transações no mesmo lugar.",
      },
      { property: "og:url", content: "/" },
    ],
    links: [{ rel: "canonical", href: "/" }],
  }),
  component: Landing,
});

const sectionIds = ["como-funciona", "preco", "faq"] as const;
type SectionId = (typeof sectionIds)[number];

const steps = [
  {
    icon: FileSignature,
    n: "01",
    title: "Crie o contrato em minutos",
    desc: "Assistente guiado coleta os dados — ou o próprio cliente preenche pelo link — e monta o contrato pra você.",
  },
  {
    icon: ShieldCheck,
    n: "02",
    title: "Contrato pronto e seguro",
    desc: "Modelo testado em operação real, com cláusulas de prazo, reembolso, multa e garantia.",
  },
  {
    icon: PenLine,
    n: "03",
    title: "Assinatura com validade jurídica",
    desc: "O cliente assina pelo link. Trilha de auditoria, IP e horário registrados.",
  },
  {
    icon: FileSpreadsheet,
    n: "04",
    title: "Tudo pronto pro contador",
    desc: "Transações organizadas e exportáveis. Sem planilha, sem garimpo no fim do mês.",
  },
];

const reasons = [
  {
    icon: ShieldHalf,
    title: "Validade jurídica de verdade",
    desc: "Assinatura digital com trilha de auditoria. O cliente assina pelo link e o contrato vale em juízo.",
  },
  {
    icon: Scale,
    title: "Contrato testado em operação",
    desc: "Modelo revisado e atualizado conforme a legislação — você não improvisa cláusula sob pressão.",
  },
  {
    icon: FileSpreadsheet,
    title: "Mais que assinatura",
    desc: "Cálculo de margem automático e transações organizadas pro contador — tudo no mesmo lugar.",
  },
];

const trustSeals = [
  { icon: Scale, label: "Validade jurídica\n(MP nº 2.200-2/01)\n" },
  { icon: Fingerprint, label: "Assinatura digital" },
  { icon: Lock, label: "Dados criptografados" },
  { icon: ShieldCheck, label: "LGPD" },
];

const planFeatures = [
  "Contratos ilimitados",
  "Assinatura digital com validade jurídica inclusa",
  "Modelo de contrato sempre atualizado",
  "Cálculo automático de margem",
  "Transações organizadas pro seu contador",
  "Sem fidelidade",
];

const faq = [
  {
    q: "Como funciona a garantia?",
    a: "Você assina e usa por 7 dias. Se não gostar, devolvemos 100% do valor. Cancele quando quiser.",
  },
  {
    q: "Funciona pelo celular?",
    a: "Sim. A Intermo foi desenhada primeiro para o celular — você opera tudo de onde estiver.",
  },
  {
    q: "Tem limite de contratos?",
    a: "Não. No plano Intermo os contratos e assinaturas são ilimitados.",
  },
];

function useScrollSpy(): SectionId | null {
  const [active, setActive] = useState<SectionId | null>(null);
  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible) setActive(visible.target.id as SectionId);
      },
      { rootMargin: "-40% 0px -50% 0px", threshold: [0, 0.25, 0.5, 1] },
    );
    sectionIds.forEach((id) => {
      const el = document.getElementById(id);
      if (el) obs.observe(el);
    });
    return () => obs.disconnect();
  }, []);
  return active;
}

function NavLink({ id, label, active }: { id: SectionId; label: string; active: boolean }) {
  return (
    <a
      href={`#${id}`}
      className={cn(
        "relative inline-flex h-10 items-center text-[15px] transition-colors",
        active ? "text-[color:var(--color-chalk)]" : "text-[color:var(--color-ash)] hover:text-[color:var(--color-chalk)]",
      )}
    >
      {label}
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute -bottom-px left-0 right-0 h-[3px] bg-[color:var(--color-signal-mint)] transition-opacity",
          active ? "opacity-100" : "opacity-0",
        )}
      />
    </a>
  );
}

function Landing() {
  const active = useScrollSpy();

  return (
    <div className="min-h-dvh bg-[color:var(--color-abyss)] text-[color:var(--color-chalk)]">
      {/* TOP BAR */}
      <header className="sticky top-0 z-40 border-b border-[color:var(--color-graphite)] bg-[color:var(--color-abyss)]/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-[1200px] items-center justify-between px-6">
          <Wordmark className="text-[18px]" />
          <nav className="hidden items-center gap-8 md:flex" aria-label="Principal">
            <NavLink id="como-funciona" label="Como funciona" active={active === "como-funciona"} />
            <NavLink id="preco" label="Preço" active={active === "preco"} />
            <NavLink id="faq" label="Dúvidas" active={active === "faq"} />
          </nav>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" asChild className="hidden sm:inline-flex">
              <Link to="/login">Entrar</Link>
            </Button>
            <Button variant="pill" size="sm" asChild>
              <Link to="/signup">Assinar agora</Link>
            </Button>
          </div>
        </div>
      </header>

      <main>
        {/* HERO */}
        <section className="border-b border-[color:var(--color-graphite)]">
          <div className="mx-auto grid max-w-[1200px] grid-cols-1 gap-12 px-6 py-24 md:grid-cols-12 md:py-32">
            <div className="md:col-span-7">
              <span className="eyebrow">Para quem vende sob encomenda</span>
              <h1 className="font-display mt-6 text-[44px] leading-[1.02] text-[color:var(--color-chalk)] sm:text-[64px] md:text-[72px]">
                Do "fechado" ao contrato assinado em minutos.
              </h1>
            </div>
            <div className="flex flex-col justify-end md:col-span-5">
              <p className="text-[16px] leading-[1.6] text-[color:var(--color-ash)]">
                A Intermo formaliza vendas sob encomenda: contrato pronto, assinatura com validade jurídica e gestão das transações no mesmo lugar. Sem improviso, sem esperar a venda esfriar.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Button asChild>
                  <Link to="/signup">
                    Assinar agora <ArrowRight className="ml-1 h-4 w-4" />
                  </Link>
                </Button>
                <Button variant="outline" asChild>
                  <a href="#como-funciona">Ver como funciona</a>
                </Button>
              </div>
              <p className="mt-5 text-[14px] text-[color:var(--color-ash)]">
                7 dias de garantia. Não gostou? Devolvemos 100%.
              </p>
            </div>
          </div>
        </section>

        {/* STRIP DE CONFIANÇA */}
        <section aria-label="Confiança" className="border-b border-[color:var(--color-graphite)]">
          <div className="mx-auto grid max-w-[1200px] grid-cols-2 gap-x-6 gap-y-6 px-6 py-10 sm:grid-cols-4">
            {trustSeals.map((s) => (
              <div key={s.label} className="flex items-center gap-3 text-[color:var(--color-chalk)]">
                <s.icon className="h-4 w-4 stroke-[1.5]" />
                <span className="text-[14px] whitespace-pre-line">{s.label}</span>
              </div>
            ))}
          </div>
        </section>

        {/* PAINEL DE STATS */}
        <section className="border-b border-[color:var(--color-graphite)]">
          <div className="mx-auto max-w-[1200px] px-6 py-20">
            <LivePanel />
          </div>
        </section>

        {/* COMO FUNCIONA */}
        <section id="como-funciona" className="border-b border-[color:var(--color-graphite)] scroll-mt-20">
          <div className="mx-auto max-w-[1200px] px-6 py-24">
            <div className="max-w-2xl">
              <span className="eyebrow">Como funciona</span>
              <h2 className="mt-4 text-[36px] leading-[1.1] font-medium">Quatro passos. Você fecha; a Intermo formaliza.</h2>
            </div>
            <div className="mt-12 grid grid-cols-1 gap-4 md:grid-cols-2">
              {steps.map((s) => (
                <Card key={s.title} className="p-6">
                  <div className="flex items-start justify-between">
                    <s.icon className="h-5 w-5 stroke-[1.5] text-[color:var(--color-chalk)]" />
                    <span className="text-[12px] tracking-[0.12em] text-[color:var(--color-ash)]">§{s.n}</span>
                  </div>
                  <h3 className="mt-6 text-[20px] font-medium leading-tight">{s.title}</h3>
                  <p className="mt-2 text-[14px] leading-[1.55] text-[color:var(--color-ash)]">{s.desc}</p>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* POR QUE INTERMO */}
        <section className="border-b border-[color:var(--color-graphite)]">
          <div className="mx-auto max-w-[1200px] px-6 py-24">
            <div className="max-w-2xl">
              <span className="eyebrow">Por que Intermo</span>
              <h2 className="mt-4 text-[36px] leading-[1.1] font-medium">Contrato certo, margem calculada, transações no lugar.</h2>
            </div>
            <div className="mt-12 grid grid-cols-1 gap-4 md:grid-cols-3">
              {reasons.map((r) => (
                <Card key={r.title} className="p-6">
                  <r.icon className="h-5 w-5 stroke-[1.5] text-[color:var(--color-chalk)]" />
                  <h3 className="mt-6 text-[20px] font-medium leading-tight">{r.title}</h3>
                  <p className="mt-2 text-[14px] leading-[1.55] text-[color:var(--color-ash)]">{r.desc}</p>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* PREÇO */}
        <section id="preco" className="border-b border-[color:var(--color-graphite)] scroll-mt-20">
          <div className="mx-auto max-w-[720px] px-6 py-24">
            <div className="text-center">
              <span className="eyebrow">Plano Intermo</span>
              <h2 className="mt-4 text-[36px] leading-[1.1] font-medium">Plano mensal. Cancele quando quiser.</h2>
              <p className="mt-3 text-[14px] text-[color:var(--color-ash)]">
                Tudo o que você precisa para formalizar vendas sob encomenda.
              </p>
            </div>
            <Card className="mt-10 p-10">
              <div className="flex items-baseline justify-center gap-3">
                <span className="font-display text-[64px] leading-none sm:text-[72px]">{brl(119)}</span>
                <span className="text-[20px] text-[color:var(--color-ash)]">/mês</span>
              </div>
              <ul className="mx-auto mt-10 max-w-md space-y-3">
                {planFeatures.map((f) => (
                  <li key={f} className="flex items-start gap-3 text-[15px]">
                    <Check className="mt-[3px] h-4 w-4 shrink-0 text-[color:var(--color-signal-mint)]" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <Button asChild className="mt-10 w-full">
                <Link to="/signup">Assinar agora</Link>
              </Button>
              <p className="mt-4 text-center text-[14px] text-[color:var(--color-ash)]">
                Cobrança imediata. 7 dias de garantia. Devolvemos 100% se não gostar. Cancele quando quiser.
              </p>
            </Card>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="border-b border-[color:var(--color-graphite)] scroll-mt-20">
          <div className="mx-auto max-w-[800px] px-6 py-24">
            <div className="text-center">
              <span className="eyebrow">Dúvidas</span>
              <h2 className="mt-4 text-[36px] leading-[1.1] font-medium">Perguntas rápidas</h2>
            </div>
            <div className="mt-10 grid gap-3">
              {faq.map((item) => (
                <Card key={item.q} className="p-6">
                  <p className="text-[16px] font-medium">{item.q}</p>
                  <p className="mt-2 text-[14px] leading-[1.55] text-[color:var(--color-ash)]">{item.a}</p>
                </Card>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer>
        <div className="mx-auto flex max-w-[1200px] flex-col items-center justify-between gap-6 px-6 py-10 sm:flex-row">
          <div className="flex items-center gap-3 text-[14px] text-[color:var(--color-ash)]">
            <Wordmark className="text-[16px]" />
            <span>© {new Date().getFullYear()} Intermo</span>
          </div>
          <nav className="flex items-center gap-6 text-[14px] text-[color:var(--color-ash)]" aria-label="Rodapé">
            <Link to="/termos" className="transition-colors hover:text-[color:var(--color-chalk)]">Termos</Link>
            <Link to="/privacidade" className="transition-colors hover:text-[color:var(--color-chalk)]">Privacidade</Link>
            <Link to="/login" className="transition-colors hover:text-[color:var(--color-chalk)]">Entrar</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
