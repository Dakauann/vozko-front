import {
  DashboardMainContent,
  SidebarProvider,
} from "@/contexts/sidebar-context";
import {
  DashboardSidebar,
  adminNavItems,
  defaultProducts,
} from "@/components/elevated-design/dashboard/sidebar";

import DashboardCrmWrapper from "@/components/dashboard/DashboardCrmWrapper";
import DashboardGate from "@/components/dashboard/DashboardGate";
import { DashboardNavbar } from "@/components/elevated-design/dashboard/dashboard-navbar";
import { CampaignStrip } from "@/components/elevated-design/dashboard/campaign-strip/campaign-strip";
import { DepartmentProvider } from "@/contexts/department-context";
import { ActiveCallHost } from "@/components/calls/active-call-host";
import { IncomingCallHost } from "@/components/calls/incoming-call-host";
import { CallSoundsHost } from "@/components/calls/call-sounds-host";
import { CallSessionProvider } from "@/contexts/call-session-context";
import { DialerDock } from "@/components/dialer/dialer-dock";
import { AssistantDock } from "@/components/ai-chat/assistant-dock";
import { RouteGate } from "@/components/access/route-gate";
import type { ReactNode } from "react";
import { Suspense } from "react";
import { WorkspaceProvider } from "@/contexts/workspace-context";

function SidebarFallback() {
  return (
    <aside className="fixed bottom-0 left-0 top-[var(--dashboard-header-h)] z-30 hidden w-[208px] border-r border-border bg-card md:block" />
  );
}

function NavbarFallback() {
  return (
    <div className="fixed inset-x-0 top-[var(--campaign-strip-h,0px)] z-40 h-12 border-b border-border bg-card" />
  );
}

export default function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <DashboardGate>
      <WorkspaceProvider>
        <DepartmentProvider>
          <SidebarProvider>
            <div className="min-h-screen bg-background">
              <CampaignStrip />

              <Suspense fallback={<NavbarFallback />}>
                <DashboardNavbar
                  translationsNamespace="dashboardNavbar"
                  logoLink="/dashboard"
                  settingsLink="/dashboard/profile"
                  profileLink="/perfil"
                  homeLink="/"
                />
              </Suspense>

              <Suspense fallback={<SidebarFallback />}>
                <DashboardSidebar
                  products={defaultProducts}
                  adminNavItems={adminNavItems}
                  translationsNamespace="sidebar"
                />
              </Suspense>

              <DashboardMainContent className="pt-[var(--dashboard-header-h)]">
                <DashboardCrmWrapper>
                  {
}
                  <CallSessionProvider>
                    <div className="p-3 sm:p-6">
                      <RouteGate>{children}</RouteGate>
                    </div>
                    <ActiveCallHost />
                    <IncomingCallHost />
                    <CallSoundsHost />
                    <AssistantDock />
                    <DialerDock />
                  </CallSessionProvider>
                </DashboardCrmWrapper>
              </DashboardMainContent>
            </div>
          </SidebarProvider>
        </DepartmentProvider>
      </WorkspaceProvider>
    </DashboardGate>
  );
}
