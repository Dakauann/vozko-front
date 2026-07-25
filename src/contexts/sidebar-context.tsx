"use client";

import * as React from "react";

import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface SidebarContextType {
  isPinned: boolean;
  togglePin: () => void;
}

const SidebarContext = React.createContext<SidebarContextType>({
  isPinned: false,
  togglePin: () => {},
});

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [isPinned, setIsPinned] = React.useState(false);

  React.useEffect(() => {
    try {
      const saved = localStorage.getItem("sidebar-pinned");
      if (saved === "true") {
        setIsPinned(true);
      }
    } catch {
      // Ignore localStorage errors
    }
  }, []);

  const togglePin = React.useCallback(() => {
    setIsPinned((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("sidebar-pinned", String(next));
      } catch {
        // Ignore localStorage errors
      }
      return next;
    });
  }, []);

  return (
    <SidebarContext.Provider value={{ isPinned, togglePin }}>
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
  const { isPinned } = useSidebar();
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
        // Must match the fixed sidebar's rendered width (DashboardSidebar:
        // `width: isExpanded ? 264 : 60`). Any larger value leaves a strip of
        // background between the sidebar's right border and the content, invisible
        // on padded pages but visible on full-bleed views like the CRM/live-chat.
        marginLeft: isMd ? (isPinned ? 264 : 60) : 0,
      }}
      transition={{
        type: "spring",
        stiffness: 300,
        damping: 30,
        duration: 0.3,
      }}
      className={cn("min-h-screen", className)}
    >
      {children}
    </motion.main>
  );
}
