"use client";

import * as React from "react";

import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

export const SPINE_WIDTH_OPEN = 208;
export const SPINE_WIDTH_RAIL = 52;


const STORAGE_KEY = "sidebar-collapsed";

interface SidebarContextType {
  isCollapsed: boolean;
  toggleCollapsed: () => void;
  hasMounted: boolean;
  isMobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
}

const SidebarContext = React.createContext<SidebarContextType>({
  isCollapsed: false,
  toggleCollapsed: () => {},
  hasMounted: false,
  isMobileOpen: false,
  setMobileOpen: () => {},
});

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [isCollapsed, setIsCollapsed] = React.useState(false);
  const [hasMounted, setHasMounted] = React.useState(false);
  const [isMobileOpen, setMobileOpen] = React.useState(false);

  React.useEffect(() => {
    try {
      setIsCollapsed(localStorage.getItem(STORAGE_KEY) === "true");
    } catch {
    }
    setHasMounted(true);
  }, []);

  const toggleCollapsed = React.useCallback(() => {
    setIsCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY, String(next));
      } catch {
      }
      return next;
    });
  }, []);

  return (
    <SidebarContext.Provider
      value={{
        isCollapsed,
        toggleCollapsed,
        hasMounted,
        isMobileOpen,
        setMobileOpen,
      }}
    >
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  return React.useContext(SidebarContext);
}

export function DashboardMainContent({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const { isCollapsed } = useSidebar();
  const [isMd, setIsMd] = React.useState(false);

  React.useEffect(() => {
    const mql = window.matchMedia("(min-width: 768px)");
    setIsMd(mql.matches);
    const handler = (e: MediaQueryListEvent) => setIsMd(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);

  return (
    <motion.main
      animate={{
        marginLeft: isMd
          ? isCollapsed
            ? SPINE_WIDTH_RAIL
            : SPINE_WIDTH_OPEN
          : 0,
      }}
      transition={{ duration: 0.16, ease: [0.2, 0, 0, 1] }}
      className={cn("min-h-screen", className)}
    >
      {children}
    </motion.main>
  );
}
