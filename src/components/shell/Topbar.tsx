import { useNavigate } from "@tanstack/react-router";
import { LogOut, Shield, User } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { getMyRoles } from "@/lib/roles.functions";
import { IntermoMark } from "@/components/brand/IntermoMark";
import { useEffect, useState } from "react";

type Profile = { companyName: string; ownerName: string; ownerEmail: string };

function initialsOf(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? "")
      .join("") || "IN"
  );
}

export function Topbar() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fetchRoles = useServerFn(getMyRoles);
  const { data: rolesData } = useQuery({
    queryKey: ["my-roles"],
    queryFn: () => fetchRoles(),
    staleTime: 5 * 60_000,
  });
  const isAdmin = rolesData?.isAdmin ?? false;
  const [profile, setProfile] = useState<Profile>({
    companyName: "Sua empresa",
    ownerName: "Você",
    ownerEmail: "",
  });

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const meta = (data.user?.user_metadata ?? {}) as Record<string, string>;
      setProfile({
        companyName: meta.company_fantasy_name || meta.company_legal_name || "Sua empresa",
        ownerName: meta.owner_name || data.user?.email?.split("@")[0] || "Você",
        ownerEmail: data.user?.email ?? "",
      });
    });
  }, []);

  async function handleLogout() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/login", replace: true });
  }

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-background/85 px-4 backdrop-blur sm:px-6">
      <SidebarTrigger className="hidden md:inline-flex" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold leading-none text-foreground">
          {profile.companyName}
        </p>
        <p className="mt-1 hidden items-center gap-1 text-xs text-muted-foreground sm:flex">
          <IntermoMark variant="plain" className="h-3.5 w-3.5 text-muted-foreground" /> Painel inTermo
        </p>
      </div>
      <div className="flex items-center gap-1">
        <ThemeToggle />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full"
              aria-label="Menu do usuário"
            >
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-accent/10 text-xs font-medium text-accent">
                  {initialsOf(profile.ownerName)}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <p className="text-sm font-medium">{profile.ownerName}</p>
              {profile.ownerEmail ? (
                <p className="truncate text-xs font-normal text-muted-foreground">
                  {profile.ownerEmail}
                </p>
              ) : null}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => navigate({ to: "/configuracoes" })}>
              <User className="mr-2 h-4 w-4" />
              Minha conta
            </DropdownMenuItem>
            {isAdmin && (
              <DropdownMenuItem onSelect={() => navigate({ to: "/contratos-falha" })}>
                <Shield className="mr-2 h-4 w-4" />
                Admin
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              onSelect={handleLogout}
              className="text-destructive focus:text-destructive"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
