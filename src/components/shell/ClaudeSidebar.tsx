import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import {
  LayoutDashboard,
  FileText,
  Wallet,
  CreditCard,
  Settings,
  Plus,
  MessageSquare,
  Loader2,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { Logo } from "@/components/brand/Logo";
import { IntermoMark } from "@/components/brand/IntermoMark";
import { createDraftContractForChat, listMyChatThreads } from "@/lib/chat.functions";
import { cn } from "@/lib/utils";

const SECONDARY = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Contratos", url: "/contratos", icon: FileText },
  { title: "Financeiro", url: "/financeiro", icon: Wallet },
] as const;

const FOOTER_ITEMS = [
  { title: "Assinatura", url: "/assinatura", icon: CreditCard },
  { title: "Configurações", url: "/configuracoes", icon: Settings },
] as const;

export function ClaudeSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();

  const fetchThreads = useServerFn(listMyChatThreads);
  const createDraft = useServerFn(createDraftContractForChat);
  const { data, isLoading } = useQuery({
    queryKey: ["my-chat-threads"],
    queryFn: () => fetchThreads(),
    staleTime: 15_000,
  });

  async function handleNewChat() {
    try {
      const { contractId } = await createDraft();
      navigate({ to: "/chat/$contractId", params: { contractId } });
    } catch {
      navigate({ to: "/chat" });
    }
  }

  const threads = data?.threads ?? [];

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="h-16 px-3 py-3">
        {collapsed ? (
          <Link to="/chat" aria-label="inTermo" className="flex h-full items-center justify-center">
            <IntermoMark variant="tile" className="h-8 w-8" />
          </Link>
        ) : (
          <Link to="/chat" aria-label="inTermo" className="flex h-full items-center px-1">
            <Logo />
          </Link>
        )}
      </SidebarHeader>

      <SidebarContent className="gap-1">
        {/* Novo contrato */}
        <SidebarGroup className="pb-0">
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={handleNewChat}
                  tooltip="Novo contrato"
                  className="bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary"
                >
                  <Plus className="h-4 w-4" />
                  <span className="font-medium">Novo contrato</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Conversas */}
        {!collapsed && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground/70">
              Conversas
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {isLoading && (
                  <li className="px-2 py-2 text-xs text-muted-foreground">
                    <Loader2 className="mr-1 inline h-3 w-3 animate-spin" /> Carregando…
                  </li>
                )}
                {!isLoading && threads.length === 0 && (
                  <li className="px-2 py-2 text-xs text-muted-foreground">
                    Nenhuma conversa ainda.
                  </li>
                )}
                {threads.map((t) => {
                  const contract = (t as { contracts?: { id: string; title?: string | null; client_name?: string | null } }).contracts;
                  const id = contract?.id ?? (t as { contract_id: string }).contract_id;
                  const label =
                    (contract?.client_name && contract.client_name !== "—" ? contract.client_name : null) ??
                    contract?.title ??
                    "Novo contrato";
                  const active = pathname === `/chat/${id}`;
                  return (
                    <SidebarMenuItem key={id}>
                      <SidebarMenuButton
                        asChild
                        isActive={active}
                        className={cn("h-8 text-[13px]", active && "bg-primary/10 text-foreground")}
                      >
                        <Link to="/chat/$contractId" params={{ contractId: id }}>
                          <MessageSquare className="h-3.5 w-3.5 opacity-70" />
                          <span className="truncate">{label}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {/* Painel */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground/70">
            Painel
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {SECONDARY.map((item) => {
                const active =
                  pathname === item.url ||
                  (item.url !== "/dashboard" && pathname.startsWith(item.url));
                return (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton asChild isActive={active} tooltip={item.title}>
                      <Link to={item.url} className="flex items-center gap-2">
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        <SidebarMenu>
          {FOOTER_ITEMS.map((item) => {
            const active = pathname.startsWith(item.url);
            return (
              <SidebarMenuItem key={item.url}>
                <SidebarMenuButton asChild isActive={active} tooltip={item.title}>
                  <Link to={item.url} className="flex items-center gap-2">
                    <item.icon className="h-4 w-4" />
                    <span>{item.title}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
