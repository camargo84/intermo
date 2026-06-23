import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/shell/AppShell";
import { profileMissingFields } from "@/lib/contract-requirements";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });

    // Onboarding obrigatório (somente uma vez). Não trava a própria rota /onboarding.
    if (!location.pathname.startsWith("/onboarding")) {
      const { data: prof } = await supabase
        .from("profiles")
        .select(
          "company_legal_name,company_cnpj,company_address,company_city,company_uf,representative_name,comarca",
        )
        .eq("id", data.user.id)
        .maybeSingle();
      if (profileMissingFields(prof).length > 0) {
        throw redirect({ to: "/onboarding" });
      }
    }
    return { user: data.user };
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}
