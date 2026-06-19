import type { ReactNode } from "react";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { Topbar } from "./Topbar";
import { BottomNav } from "./BottomNav";
import { SubscriptionBanner } from "@/components/billing/SubscriptionBanner";
import { TermsBanner } from "@/components/legal/TermsBanner";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <div className="hidden md:block">
          <AppSidebar />
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
