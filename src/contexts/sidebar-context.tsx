"use client";

import * as React from "react";

import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

/**
 * Spine width, in pixels.
 *
 * DashboardMainContent's marginLeft MUST equal the spine's rendered width. Any
 * larger value leaves a strip of panel between the spine's right rule and the
 * content — invisible on padded pages, obvious on full-bleed views like the CRM
 * and live-chat. Both sides read these constants so they cannot drift apart.
 */
export const SPINE_WIDTH_OPEN = 208;
export const SPINE_WIDTH_RAIL = 52;

// No HEADER_HEIGHT constant here on purpose. The bar is sized in rem (h-12),
// and globals.css scales the root font to 87.5% between 1024-1440px, so it
// renders ~42px there and 48px above 1600px. A px constant asserting one value
// would be a lie in the range most of these users are on — and this file's
// whole point is that a constant and the thing it describes cannot drift.

const STORAGE_KEY = "sidebar-collapsed";

interface SidebarContextType {
  /** True when the spine is reduced to its icon rail. */
  isCollapsed: boolean;
  toggleCollapsed: () => void;
  /** False until the stored preference has been read, to keep SSR stable. */
  hasMounted: boolean;
}

const SidebarContext = React.createContext<SidebarContextType>({
  isCollapsed: false,
  toggleCollapsed: () => {},
  hasMounted: false,
});

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  // Open is the default. The spine is labelled furniture an operator reads all
  // day; it starts legible and collapses only if they ask for the width back.
  const [isCollapsed, setIsCollapsed] = React.useState(false);
  const [hasMounted, setHasMounted] = React.useState(false);

  React.useEffect(() => {
    try {
      setIsCollapsed(localStorage.getItem(STORAGE_KEY) === "true");
    } catch {
      // Ignore localStorage errors
    }
    setHasMounted(true);
  }, []);

  const toggleCollapsed = React.useCallback(() => {
    setIsCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY, String(next));
      } catch {
        // Ignore localStorage errors
      }
      return next;
    });
  }, []);

  return (
    <SidebarContext.Provider
      value={{ isCollapsed, toggleCollapsed, hasMounted }}
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
