import { createFileRoute, Link } from "@tanstack/react-router";
import { Logo } from "@/components/brand/Logo";

export const Route = createFileRoute("/termos")({
  head: () => ({
    meta: [
      { title: "Termos de uso — inTermo" },
      {
        name: "description",
        content:
          "Termos de uso da inTermo: condições do serviço, plano de R$ 119/mês com contratos ilimitados e regras anti-abuso.",
      },
      { property: "og:title", content: "Termos de uso — inTermo" },
      {
        property: "og:description",
        content:
          "Termos de uso da inTermo: condições do serviço, plano de R$ 119/mês com contratos ilimitados e regras anti-abuso.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: "https://intermo.com.br/termos" }],
  }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/60">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-6">
          <Link to="/">
            <Logo />
          </Link>
          <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">
            Voltar
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-3xl font-bold tracking-tight">Termos de uso</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Última atualização: {new Date().toLocaleDateString("pt-BR")}
        </p>
        <div className="prose prose-sm dark:prose-invert mt-8 max-w-none space-y-4 text-foreground/90">
          <p>Bem-vindo à inTermo. Ao usar a plataforma, você concorda com as condições abaixo.</p>

          <h2 className="text-lg font-semibold">1. Sobre o serviço</h2>
          <p>
            A inTermo oferece ferramentas para vendedores intermediários formalizarem vendas:
            cadastro de clientes, geração de contratos com validade jurídica (nos termos da MP nº
            2.200-2/2001), assinatura eletrônica e acompanhamento.
          </p>

          <h2 className="text-lg font-semibold">2. Conta</h2>
          <p>
            Você é responsável pela confidencialidade das credenciais de acesso e por todas as ações
            realizadas em sua conta. Cada assinatura é pessoal e intransferível.
          </p>

          <h2 className="text-lg font-semibold">3. Plano e cobrança</h2>
          <p>
            O plano vigente é de <strong>R$ 119,00/mês</strong>, com uso <strong>ilimitado</strong>{" "}
            de contratos para a operação normal do vendedor.
          </p>

          <h2 className="text-lg font-semibold">4. Uso aceitável e medidas anti-abuso</h2>
          <p>
            Embora o plano seja ilimitado para uso comercial legítimo, ficam expressamente vedados:
          </p>
          <ul className="list-disc pl-5">
            <li>
              compartilhamento de credenciais com terceiros ou uso simultâneo em múltiplas sessões;
            </li>
            <li>
              uso de robôs, scripts, automações ou qualquer mecanismo que gere requisições em volume
              incompatível com a operação humana de um vendedor;
            </li>
            <li>
              revenda, sublicenciamento ou exposição da plataforma a terceiros como SaaS próprio;
            </li>
            <li>
              tentativas de contornar limites técnicos, mecanismos de segurança ou rate-limits da
              plataforma.
            </li>
          </ul>
          <p>
            A inTermo aplica limites técnicos de proteção (rate-limit por minuto e teto mensal
            interno bem acima do uso esperado). Esses limites{" "}
            <strong>não são limites comerciais</strong> — servem apenas para preservar a
            estabilidade do serviço e impedir abuso ou sobrecarga. Detectada conduta abusiva, a
            inTermo poderá suspender ou encerrar o acesso, sem prejuízo das medidas legais cabíveis.
          </p>

          <h2 className="text-lg font-semibold">5. Dados e LGPD</h2>
          <p>
            Os dados pessoais coletados (do vendedor e de seus clientes) são tratados conforme a Lei
            nº 13.709/2018 (LGPD). Cada vendedor é responsável pelos dados que insere no sistema e
            pela base legal de tratamento perante seus próprios clientes.
          </p>

          <h2 className="text-lg font-semibold">6. Cancelamento</h2>
          <p>
            Você pode cancelar a assinatura a qualquer momento. O acesso permanece ativo até o fim
            do ciclo já pago.
          </p>

          <h2 className="text-lg font-semibold">7. Limitação de responsabilidade</h2>
          <p>
            A inTermo é uma ferramenta para apoiar a formalização de vendas; a responsabilidade
            civil, fiscal e contratual perante o consumidor final é do vendedor que utiliza a
            plataforma.
          </p>
        </div>
      </main>
    </div>
  );
}
