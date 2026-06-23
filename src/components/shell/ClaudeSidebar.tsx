import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import {
  LayoutDashboard,
  FileText,
  Wallet,
  CreditCard,
  Settings,
  Plus,
  MessageSquare,
  Loader2,
  Search,
  X,
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
import { Input } from "@/components/ui/input";
import { Logo } from "@/components/brand/Logo";
import { IntermoMark } from "@/components/brand/IntermoMark";
import {
  listMyChatThreads,
  searchMyChatThreads,
  type SidebarThreadRow,
} from "@/lib/chat.functions";
import { cn } from "@/lib/utils";
import { abbreviateName, formatThreadTimestamp } from "@/lib/format";
import { ThreadLabel } from "./ThreadLabel";
import { useEffect, useMemo, useRef, useState } from "react";

const SECONDARY = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Transações", url: "/contratos", icon: FileText },
  { title: "Financeiro", url: "/financeiro", icon: Wallet },
] as const;

const FOOTER_ITEMS = [
  { title: "Plano/Cobrança", url: "/assinatura", icon: CreditCard },
  { title: "Configurações", url: "/configuracoes", icon: Settings },
] as const;

const SIDEBAR_WIDTH_KEY = "intermo.sidebar.width";
const SIDEBAR_WIDTH_MIN = 220;
const SIDEBAR_WIDTH_MAX = 440;
const SIDEBAR_WIDTH_DEFAULT = 280;

function clampWidth(v: number) {
  return Math.round(Math.max(SIDEBAR_WIDTH_MIN, Math.min(SIDEBAR_WIDTH_MAX, v)));
}

function readSavedWidth(): number {
  if (typeof window === "undefined") return SIDEBAR_WIDTH_DEFAULT;
  const raw = window.localStorage.getItem(SIDEBAR_WIDTH_KEY);
  const n = raw ? Number(raw) : NaN;
  return Number.isFinite(n) ? clampWidth(n) : SIDEBAR_WIDTH_DEFAULT;
}

/** Deriva o label da sidebar a partir do registro da transação. */
function buildThreadLabel(t: SidebarThreadRow["transactions"], updated_at: string) {
  if (!t) return { primary: "Rascunho", time: formatThreadTimestamp(updated_at) };
  const cliente =
    t.client_name && t.client_name !== "—" ? abbreviateName(t.client_name) : null;
  const produto =
    Array.isArray(t.produtos) && t.produtos.length > 0 && t.produtos[0]?.descricao
      ? String(t.produtos[0].descricao)
      : null;
  const left = cliente ?? "Rascunho";
  const primary = produto ? `${left} | ${produto}` : left;
  const time = formatThreadTimestamp(t.created_at ?? updated_at);
  return { primary, time };
}

export function ClaudeSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();

  // ---------------- largura redimensionável + persistência ----------------
  const [width, setWidth] = useState<number>(() => readSavedWidth());
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    window.localStorage.setItem(SIDEBAR_WIDTH_KEY, String(width));
    document.documentElement.style.setProperty("--sidebar-width", `${width}px`);
  }, [width]);
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!(e.metaKey || e.ctrlKey)) return;
      if (e.key === "[") {
        e.preventDefault();
        setWidth((w) => clampWidth(w - Math.round(w * 0.1)));
      } else if (e.key === "]") {
        e.preventDefault();
        setWidth((w) => clampWidth(w + Math.round(w * 0.1)));
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  function startResize(e: React.PointerEvent<HTMLDivElement>) {
    e.preventDefault();
    const startX = e.clientX;
    const startW = width;
    function onMove(ev: PointerEvent) {
      setWidth(clampWidth(startW + (ev.clientX - startX)));
    }
    function onUp() {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      document.body.style.cursor = "";
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    document.body.style.cursor = "col-resize";
  }

  // ---------------- threads (paginadas) ----------------
  const fetchThreads = useServerFn(listMyChatThreads);
  const threadsQuery = useInfiniteQuery({
    queryKey: ["my-chat-threads"],
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) =>
      fetchThreads({ data: { limit: 30, cursor: pageParam ?? null } }),
    getNextPageParam: (last) => last.nextCursor,
    staleTime: 15_000,
  });
  const threads = useMemo<SidebarThreadRow[]>(
    () => threadsQuery.data?.pages.flatMap((p) => p.threads) ?? [],
    [threadsQuery.data],
  );

  // sentinela para carregar mais
  const sentinelRef = useRef<HTMLLIElement>(null);
  useEffect(() => {
    const node = sentinelRef.current;
    if (!node) return;
    const obs = new IntersectionObserver(
      (entries) => {
        const e = entries[0];
        if (
          e?.isIntersecting &&
          threadsQuery.hasNextPage &&
          !threadsQuery.isFetchingNextPage
        ) {
          threadsQuery.fetchNextPage();
        }
      },
      { rootMargin: "120px" },
    );
    obs.observe(node);
    return () => obs.disconnect();
  }, [threadsQuery]);

  // ---------------- busca server-side ----------------
  const runSearch = useServerFn(searchMyChatThreads);
  const [rawQ, setRawQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQ(rawQ.trim()), 250);
    return () => window.clearTimeout(t);
  }, [rawQ]);
  const searchQuery = useQuery({
    queryKey: ["search-chat-threads", debouncedQ],
    queryFn: () => runSearch({ data: { q: debouncedQ, limit: 30 } }),
    enabled: debouncedQ.length > 0,
    staleTime: 10_000,
  });
  const searchOpen = debouncedQ.length > 0;
  const searchResults = (searchQuery.data?.results ?? []) as SidebarThreadRow[];

  function handleNewChat() {
    navigate({ to: "/chat" });
  }

  return (
    <div ref={rootRef} className="contents">
      <Sidebar collapsible="icon">
        <SidebarHeader className="h-16 px-3 py-3">
          {collapsed ? (
            <Link
              to="/chat"
              aria-label="inTermo"
              className="flex h-full items-center justify-center"
            >
              <IntermoMark variant="tile" className="h-8 w-8" />
            </Link>
          ) : (
            <Link to="/chat" aria-label="inTermo" className="flex h-full items-center px-1">
              <Logo />
            </Link>
          )}
        </SidebarHeader>

        <SidebarContent className="gap-1">
          {/* Nova transação */}
          <SidebarGroup className="pb-0">
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    onClick={handleNewChat}
                    tooltip="Nova transação"
                    className="bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary"
                  >
                    <Plus className="h-4 w-4" />
                    <span className="font-medium">Nova transação</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          {/* Busca */}
          {!collapsed && (
            <SidebarGroup className="py-1">
              <SidebarGroupContent>
                <div className="relative px-2">
                  <Search className="pointer-events-none absolute left-4 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={rawQ}
                    onChange={(e) => setRawQ(e.target.value)}
                    placeholder="Buscar conversas…"
                    className="h-8 pl-7 pr-7 text-[13px]"
                  />
                  {rawQ && (
                    <button
                      type="button"
                      aria-label="Limpar"
                      onClick={() => setRawQ("")}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </SidebarGroupContent>
            </SidebarGroup>
          )}

          {/* Conversas (lista normal OU resultados de busca) */}
          {!collapsed && (
            <SidebarGroup>
              <SidebarGroupLabel className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground/70">
                {searchOpen ? "Resultados" : "Conversas"}
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {searchOpen ? (
                    <SearchList
                      loading={searchQuery.isLoading}
                      results={searchResults}
                      pathname={pathname}
                    />
                  ) : (
                    <ThreadList
                      loading={threadsQuery.isLoading}
                      threads={threads}
                      pathname={pathname}
                      sentinelRef={sentinelRef}
                      fetchingMore={threadsQuery.isFetchingNextPage}
                      hasMore={Boolean(threadsQuery.hasNextPage)}
                    />
                  )}
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

      {/* Handle de redimensionar — só desktop, oculto quando colapsado */}
      {!collapsed && (
        <div
          aria-label="Redimensionar sidebar"
          role="separator"
          aria-orientation="vertical"
          title="Arraste para redimensionar. Ctrl/⌘ + [ ou ] para ±10%."
          onPointerDown={startResize}
          onDoubleClick={() => setWidth(SIDEBAR_WIDTH_DEFAULT)}
          className="fixed left-[var(--sidebar-width)] top-0 z-20 hidden h-svh w-1 -translate-x-1/2 cursor-col-resize bg-transparent transition-colors hover:bg-primary/40 md:block"
        />
      )}
    </div>
  );
}

function ThreadRow({
  row,
  pathname,
}: {
  row: SidebarThreadRow;
  pathname: string;
}) {
  const contract = row.transactions;
  const id = contract?.id ?? row.contract_id;
  const { primary, time } = buildThreadLabel(contract, row.updated_at);
  const active = pathname === `/chat/${id}`;
  const consolidated = Boolean(contract?.consolidated);
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        asChild
        isActive={active}
        className={cn(
          "h-auto items-start py-1.5 text-[13px]",
          active && "bg-primary/10 text-foreground",
        )}
      >
        <Link to="/chat/$contractId" params={{ contractId: id }}>
          <span className="relative mt-0.5">
            <MessageSquare className="h-3.5 w-3.5 opacity-70" />
            {consolidated && (
              <span className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-success" />
            )}
          </span>
          <span className="flex min-w-0 flex-1 flex-col">
            <ThreadLabel text={primary} className="w-full" />
            <span className="text-[10px] text-muted-foreground/70">{time}</span>
          </span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

function ThreadList({
  loading,
  threads,
  pathname,
  sentinelRef,
  fetchingMore,
  hasMore,
}: {
  loading: boolean;
  threads: SidebarThreadRow[];
  pathname: string;
  sentinelRef: React.RefObject<HTMLLIElement | null>;
  fetchingMore: boolean;
  hasMore: boolean;
}) {
  if (loading && threads.length === 0) {
    return (
      <li className="px-2 py-2 text-xs text-muted-foreground">
        <Loader2 className="mr-1 inline h-3 w-3 animate-spin" /> Carregando…
      </li>
    );
  }
  if (threads.length === 0) {
    return <li className="px-2 py-2 text-xs text-muted-foreground">Nenhuma conversa ainda.</li>;
  }
  return (
    <>
      {threads.map((row) => (
        <ThreadRow key={row.contract_id} row={row} pathname={pathname} />
      ))}
      <li
        ref={sentinelRef}
        className="px-2 py-2 text-center text-[10px] text-muted-foreground"
      >
        {fetchingMore ? (
          <>
            <Loader2 className="mr-1 inline h-3 w-3 animate-spin" /> Carregando…
          </>
        ) : hasMore ? (
          ""
        ) : threads.length > 6 ? (
          "Fim."
        ) : null}
      </li>
    </>
  );
}

function SearchList({
  loading,
  results,
  pathname,
}: {
  loading: boolean;
  results: SidebarThreadRow[];
  pathname: string;
}) {
  if (loading) {
    return (
      <li className="px-2 py-2 text-xs text-muted-foreground">
        <Loader2 className="mr-1 inline h-3 w-3 animate-spin" /> Buscando…
      </li>
    );
  }
  if (results.length === 0) {
    return (
      <li className="px-2 py-2 text-xs text-muted-foreground">Nenhum resultado.</li>
    );
  }
  return (
    <>
      {results.map((row) => (
        <ThreadRow key={row.contract_id} row={row} pathname={pathname} />
      ))}
    </>
  );
}
