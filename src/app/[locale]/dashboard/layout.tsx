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
import WhatsAppCallHost from "@/components/dashboard/WhatsAppCallHost";
import type { ReactNode } from "react";
import { Suspense } from "react";
import { WorkspaceProvider } from "@/contexts/workspace-context";

// Both fallbacks must match the real chrome's geometry exactly, or the content
// jumps when the real one resolves. Azure topology: the bar is full-width and
// owns the corner; the rail starts below it.
function SidebarFallback() {
  return (
    <aside className="fixed bottom-0 left-0 top-12 z-30 hidden w-[208px] border-r border-border bg-card md:block" />
  );
}

function NavbarFallback() {
  return (
    <div className="fixed inset-x-0 top-0 z-40 h-12 border-b border-border bg-card" />
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

              <DashboardMainContent className="pt-12">
                <DashboardCrmWrapper>
                  {/* Full-bleed views (CRM, workflows) escape this with -m-6.
                      The 6 must stay 6 or those views misalign. */}
                  <div className="p-3 sm:p-6">{children}</div>
                  <WhatsAppCallHost />
                </DashboardCrmWrapper>
              </DashboardMainContent>
            </div>
          </SidebarProvider>
        </DepartmentProvider>
      </WorkspaceProvider>
    </DashboardGate>
  );
}
