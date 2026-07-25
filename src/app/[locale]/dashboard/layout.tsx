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
import { DepartmentProvider } from "@/contexts/department-context";
import PersistentDialer from "@/components/dashboard/PersistentDialer";
import type { ReactNode } from "react";
import { Suspense } from "react";
import { WorkspaceProvider } from "@/contexts/workspace-context";

function SidebarFallback() {
  return (
    <aside className="fixed left-0 top-0 z-30 hidden h-screen w-[272px] bg-card shadow-sm md:block">
      <div className="flex items-center justify-center h-full">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    </aside>
  );
}

function NavbarFallback() {
  return (
    <nav className="fixed left-0 right-0 top-0 z-40 h-16 bg-card shadow-sm">
      <div className="flex items-center justify-center h-full">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    </nav>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  // Auth is gated client-side by DashboardGate (the API is the real security
  // boundary; every request is authenticated server-side). No server session
  // read here.
  return (
    <DashboardGate>
      <WorkspaceProvider>
        <DepartmentProvider>
          <SidebarProvider>
            <div className="min-h-screen bg-background">
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

              <DashboardMainContent className="pt-20">
                <DashboardCrmWrapper>
                  <div className="p-3 sm:p-6">{children}</div>
                  <PersistentDialer />
                </DashboardCrmWrapper>
              </DashboardMainContent>
            </div>
          </SidebarProvider>
        </DepartmentProvider>
      </WorkspaceProvider>
    </DashboardGate>
  );
}
