import { useEffect, useRef, useState, type ReactNode } from "react";
import { SidebarInset, SidebarProvider, useSidebar } from "@/components/ui/sidebar";
import { ClaudeSidebar } from "./ClaudeSidebar";
import { Topbar } from "./Topbar";
import { BottomNav } from "./BottomNav";
import { SubscriptionBanner } from "@/components/billing/SubscriptionBanner";
import { TermsBanner } from "@/components/legal/TermsBanner";

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

export function AppShell({ children }: { children: ReactNode }) {
  const [width, setWidth] = useState<number>(() => readSavedWidth());

  useEffect(() => {
    window.localStorage.setItem(SIDEBAR_WIDTH_KEY, String(width));
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

  return (
    <SidebarProvider style={{ "--sidebar-width": `${width}px` } as React.CSSProperties}>
      <div className="flex min-h-screen w-full bg-background">
        <div className="hidden md:block">
          <ClaudeSidebar />
          <SidebarResizer width={width} onChange={setWidth} onReset={() => setWidth(SIDEBAR_WIDTH_DEFAULT)} />
        </div>
        <SidebarInset className="flex min-w-0 flex-1 flex-col">
          <Topbar />
          <TermsBanner />
          <SubscriptionBanner />
          <main className="flex-1 px-4 pb-24 pt-6 sm:px-6 md:pb-10">{children}</main>
        </SidebarInset>
      </div>
      <BottomNav />
    </SidebarProvider>
  );
}

function SidebarResizer({
  width,
  onChange,
  onReset,
}: {
  width: number;
  onChange: (w: number) => void;
  onReset: () => void;
}) {
  const { state } = useSidebar();
  const startRef = useRef<{ x: number; w: number } | null>(null);

  if (state === "collapsed") return null;

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    e.preventDefault();
    startRef.current = { x: e.clientX, w: width };
    function move(ev: PointerEvent) {
      const s = startRef.current;
      if (!s) return;
      onChange(clampWidth(s.w + (ev.clientX - s.x)));
    }
    function up() {
      startRef.current = null;
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      document.body.style.cursor = "";
    }
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    document.body.style.cursor = "col-resize";
  }

  return (
    <div
      aria-label="Redimensionar sidebar"
      role="separator"
      aria-orientation="vertical"
      title="Arraste para redimensionar. Ctrl/⌘ + [ ou ] para ±10%. Duplo-clique para resetar."
      onPointerDown={onPointerDown}
      onDoubleClick={onReset}
      style={{ left: `var(--sidebar-width)` }}
      className="fixed top-0 z-20 hidden h-svh w-1 -translate-x-1/2 cursor-col-resize bg-transparent transition-colors hover:bg-primary/40 md:block"
    />
  );
}
