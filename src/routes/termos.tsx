import { createFileRoute, Link } from "@tanstack/react-router";
import { Logo } from "@/components/brand/Logo";

export const Route = createFileRoute("/termos")({
  head: () => ({
    meta: [
      { title: "Termos de uso — Intermo" },
      { name: "description", content: "Termos de uso da plataforma Intermo." },
    ],
    links: [{ rel: "canonical", href: "/termos" }],
  }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/60">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-6">
          <Link to="/"><Logo /></Link>
          <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">Voltar</Link>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-3xl font-bold tracking-tight">Termos de uso</h1>
        <p className="mt-2 text-sm text-muted-foreground">Última atualização: {new Date().toLocaleDateString("pt-BR")}</p>
        <div className="prose prose-sm dark:prose-invert mt-8 max-w-none space-y-4 text-foreground/90">
          <p>
            Bem-vindo à Intermo. Este é um documento provisório, com o texto final em revisão jurídica.
            Ao usar a plataforma, você concorda com as condições aqui descritas.
          </p>
          <h2 className="text-lg font-semibold">1. Sobre o serviço</h2>
          <p>A Intermo oferece ferramentas para intermediação de vendas, geração de contratos, assinatura digital e emissão de NFS.</p>
          <h2 className="text-lg font-semibold">2. Conta</h2>
          <p>Você é responsável por manter a confidencialidade das credenciais de acesso e pelas ações realizadas em sua conta.</p>
          <h2 className="text-lg font-semibold">3. Plano e cobrança</h2>
          <p>O plano vigente é de R$ 149,00/mês, com 200 contratos inclusos e R$ 1,00 por contrato adicional.</p>
          <h2 className="text-lg font-semibold">4. Cancelamento</h2>
          <p>Você pode cancelar sua assinatura a qualquer momento. O acesso permanece ativo até o fim do ciclo já pago.</p>
        </div>
      </main>
    </div>
  );
}
