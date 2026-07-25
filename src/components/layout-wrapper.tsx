"use client";

import Footer from "@/components/footer";
import Navbar from "@/components/elevated-design/navbar";
import { usePathname } from "next/navigation";

const DASHBOARD_ROUTES = ["/dashboard"];

export function LayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const isDashboardRoute = DASHBOARD_ROUTES.some((route) => {
    if (!pathname) return false;

    return (
      pathname === route ||
      pathname.startsWith(`${route}/`) ||
      /^\/[a-z]{2}\/dashboard(\/|$)/.test(pathname)
    );
  });

  return (
    <>
      {!isDashboardRoute && <Navbar />}
      {children}
      {!isDashboardRoute && <Footer />}
    </>
  );
}
