import { createFileRoute, Outlet, Link, redirect } from "@tanstack/react-router";
import { getMyRoles } from "@/lib/roles.functions";

export const Route = createFileRoute("/_authenticated/_admin")({
  beforeLoad: async () => {
    try {
      const { isAdmin } = await getMyRoles();
      if (!isAdmin) throw redirect({ to: "/dashboard" });
    } catch {
      throw redirect({ to: "/dashboard" });
    }
  },
  component: AdminLayout,
});

function AdminLayout() {
  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center gap-3 border-b border-border pb-3">
        <h1 className="text-lg font-semibold">Admin</h1>
        <nav className="flex gap-2 text-sm">
          <Link
            to="/_admin/contratos-falha"
            className="rounded-md px-3 py-1 text-muted-foreground hover:bg-accent/10 hover:text-foreground [&.active]:bg-accent/10 [&.active]:text-foreground"
            activeProps={{ className: "active" }}
          >
            Contratos com falha
          </Link>
          <Link
            to="/_admin/assinaturas"
            className="rounded-md px-3 py-1 text-muted-foreground hover:bg-accent/10 hover:text-foreground [&.active]:bg-accent/10 [&.active]:text-foreground"
            activeProps={{ className: "active" }}
          >
            Assinaturas
          </Link>
        </nav>
      </header>
      <Outlet />
    </div>
  );
}
