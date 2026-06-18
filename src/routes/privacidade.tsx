import { createFileRoute, Link } from "@tanstack/react-router";
import { Logo } from "@/components/brand/Logo";

export const Route = createFileRoute("/privacidade")({
  head: () => ({
    meta: [
      { title: "Política de privacidade — Intermo" },
      { name: "description", content: "Política de privacidade da plataforma Intermo." },
    ],
    links: [{ rel: "canonical", href: "/privacidade" }],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/60">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-6">
          <Link to="/"><Logo /></Link>
          <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">Voltar</Link>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-3xl font-bold tracking-tight">Política de privacidade</h1>
        <p className="mt-2 text-sm text-muted-foreground">Última atualização: {new Date().toLocaleDateString("pt-BR")}</p>
        <div className="prose prose-sm dark:prose-invert mt-8 max-w-none space-y-4 text-foreground/90">
          <p>
            Sua privacidade é prioridade na Intermo. Este documento descreve, em linhas gerais,
            quais dados coletamos e como são tratados, em conformidade com a LGPD.
          </p>
          <h2 className="text-lg font-semibold">Dados coletados</h2>
          <p>Coletamos dados de cadastro (empresa, contato, CNPJ), dados operacionais (contratos, clientes) e dados de uso da plataforma.</p>
          <h2 className="text-lg font-semibold">Como usamos</h2>
          <p>Os dados são usados para operar o serviço, gerar contratos e notas fiscais, prestar suporte e melhorar a plataforma.</p>
          <h2 className="text-lg font-semibold">Seus direitos</h2>
          <p>Você pode solicitar acesso, correção ou exclusão dos seus dados a qualquer momento pelo e-mail de suporte.</p>
        </div>
      </main>
    </div>
  );
}
