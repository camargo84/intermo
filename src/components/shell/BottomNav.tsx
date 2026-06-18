import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useState } from "react";
import {
  LayoutDashboard,
  MessageSquarePlus,
  FileText,
  Wallet,
  Menu as MenuIcon,
  Receipt,
  Settings,
  LogOut,
  Moon,
  Sun,
} from "lucide-react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTheme } from "@/hooks/use-theme";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

const mainItems = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Chat", url: "/contratos/novo", icon: MessageSquarePlus },
  { title: "Contratos", url: "/contratos", icon: FileText },
  { title: "Financeiro", url: "/financeiro", icon: Wallet },
] as const;

export function BottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  async function handleLogout() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/login", replace: true });
  }

  return (
    <nav
      aria-label="Navegação principal"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
    >
      <ul className="grid grid-cols-5">
        {mainItems.map((item) => {
          const active =
            pathname === item.url || (item.url !== "/dashboard" && pathname.startsWith(item.url));
          return (
            <li key={item.url}>
              <Link
                to={item.url}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 py-2 text-[10px] font-medium transition-colors",
                  active ? "text-accent" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <item.icon className="h-5 w-5" />
                {item.title}
              </Link>
            </li>
          );
        })}
        <li>
          <Drawer open={open} onOpenChange={setOpen}>
            <DrawerTrigger asChild>
              <button
                type="button"
                className="flex w-full flex-col items-center justify-center gap-1 py-2 text-[10px] font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                <MenuIcon className="h-5 w-5" />
                Mais
              </button>
            </DrawerTrigger>
            <DrawerContent>
              <DrawerHeader className="text-left">
                <DrawerTitle>Mais</DrawerTitle>
              </DrawerHeader>
              <div className="grid gap-1 px-4 pb-6">
                <DrawerLink to="/nfs" icon={Receipt} label="NFS" onSelect={() => setOpen(false)} />
                <DrawerLink to="/configuracoes" icon={Settings} label="Configurações" onSelect={() => setOpen(false)} />
                <Button variant="ghost" className="justify-start gap-3" onClick={toggle}>
                  {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                  {theme === "dark" ? "Modo claro" : "Modo escuro"}
                </Button>
                <Button variant="ghost" className="justify-start gap-3 text-destructive" onClick={handleLogout}>
                  <LogOut className="h-4 w-4" />
                  Sair
                </Button>
              </div>
            </DrawerContent>
          </Drawer>
        </li>
      </ul>
    </nav>
  );
}

function DrawerLink({
  to,
  icon: Icon,
  label,
  onSelect,
}: {
  to: string;
  icon: typeof Receipt;
  label: string;
  onSelect: () => void;
}) {
  return (
    <Button asChild variant="ghost" className="justify-start gap-3" onClick={onSelect}>
      <Link to={to}>
        <Icon className="h-4 w-4" />
        {label}
      </Link>
    </Button>
  );
}
