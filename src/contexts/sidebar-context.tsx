"use client";

import * as React from "react";

import { useViewportWidth } from "@/hooks/use-viewport-width";
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

const SPINE_BREAKPOINT = 768;

export function useSpineWidth(): number {
  const { isCollapsed } = useSidebar();
  const viewport = useViewportWidth();
  if (viewport < SPINE_BREAKPOINT) return 0;
  return isCollapsed ? SPINE_WIDTH_RAIL : SPINE_WIDTH_OPEN;
}

export function DashboardMainContent({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const spine = useSpineWidth();

  return (
    <motion.main
      animate={{ marginLeft: spine }}
      transition={{ duration: 0.16, ease: [0.2, 0, 0, 1] }}
      style={{ paddingRight: "var(--assistant-sheet-w, 0px)" }}
      className={cn("min-h-screen transition-[padding] duration-200 ease-[cubic-bezier(0.2,0,0,1)]", className)}
    >
      {children}
    </motion.main>
  );
}
