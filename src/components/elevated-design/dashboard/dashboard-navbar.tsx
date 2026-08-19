"use client";

import * as React from "react";

import { AnimatePresence, motion } from "framer-motion";
import {
  CalendarBlank,
  CaretDown,
  Gear,
  SignOut,
  User,
} from "@/components/icons";
import { Link, usePathname } from "@/i18n/routing";

import { BalanceIndicator } from "@/components/elevated-design/dashboard/balance-indicator";
import { CalendarSheet } from "@/components/elevated-design/dashboard/calendar-sheet";
import { DepartmentSwitcher } from "@/components/elevated-design/dashboard/department-switcher";
import Image from "next/image";
import LanguageSwitcher from "@/components/language-switcher";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/auth-context";
import { useSidebar } from "@/contexts/sidebar-context";
import { useTranslations } from "next-intl";

export interface DashboardNavbarProps {
  translationsNamespace?: string;
  logoLink?: string;
  settingsLink?: string;
  profileLink?: string;
  homeLink?: string;
  className?: string;
}

export function DashboardNavbar({
  translationsNamespace = "dashboardNavbar",
  settingsLink = "/dashboard/profile",
  className,
}: DashboardNavbarProps = {}) {
  const t = useTranslations(translationsNamespace);
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const { isCollapsed } = useSidebar();
  const [showUserMenu, setShowUserMenu] = React.useState(false);
  const [showCalendar, setShowCalendar] = React.useState(false);
  const userMenuRef = React.useRef<HTMLDivElement>(null);

  const labelMap: Record<string, string> = {
    dashboard: t("breadcrumbs.dashboard"),
    agents: t("breadcrumbs.agents"),
    new: t("breadcrumbs.new"),
    campaigns: t("breadcrumbs.campaigns"),
    configuracoes: t("breadcrumbs.settings"),
    profile: t("breadcrumbs.profile"),
    // Without a mapping the segment is titleised into "Unofficial Whatsapp",
    // which is wrong in every locale including English.
    "unofficial-whatsapp": t("breadcrumbs.unofficial-whatsapp"),
    broadcasts: t("breadcrumbs.broadcasts"),
    connect: t("breadcrumbs.connect"),
  };

  const getBreadcrumbSegments = (pathname: string) => {
    const segments = pathname.split("/").filter(Boolean);

    const locales = ["pt", "en", "de", "es"];
    const filteredSegments = segments.filter((seg) => !locales.includes(seg));

    const breadcrumbs: { label: string; href: string }[] = [];

    let currentPath = "";
    filteredSegments.forEach((segment) => {
      currentPath += `/${segment}`;

      let label = segment
        .replace(/-/g, " ")
        .replace(/\b\w/g, (char) => char.toUpperCase());

      if (labelMap[segment]) {
        label = labelMap[segment];
      }

      if (!segment.startsWith("[") && !segment.match(/^[a-f0-9-]{36}$/i)) {
        breadcrumbs.push({ label, href: currentPath });
      } else {
        breadcrumbs.push({
          label: t("breadcrumbs.details"),
          href: currentPath,
        });
      }
    });

    return breadcrumbs;
  };

  const breadcrumbs = getBreadcrumbSegments(pathname);

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        userMenuRef.current &&
        !userMenuRef.current.contains(event.target as Node)
      ) {
        setShowUserMenu(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  return (
    <header
      className={cn(
        // Starts to the RIGHT of the spine, which owns the top-left corner.
        // The offset is animated by the same easing the spine uses so the two
        // edges stay joined while it collapses.
        "fixed right-0 top-0 z-30 flex h-12 items-center gap-3",
        "border-b border-border bg-card px-3 shadow-sm transition-[left] duration-150",
        "left-0",
        isCollapsed ? "md:left-[52px]" : "md:left-[208px]",
        className,
      )}
    >
      {/*
        The scope route. Where the previous bar carried a logo, two selectors
        and a breadcrumb, this carries only where you are: the spine now owns
        brand and workspace, so the bar can be a legend line and a readout rack.
      */}
      <nav
        aria-label={t("breadcrumbs.dashboard")}
        className="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden"
      >
        {breadcrumbs.map((crumb, index) => (
          <React.Fragment key={crumb.href}>
            {/* The separator hides with the crumb it separates. Below sm the
                intermediate crumbs are hidden, and a bare leading "›" pointing
                at nothing was rendering on every mobile screen. */}
            {index > 0 && (
              <span
                aria-hidden="true"
                className="legend hidden shrink-0 opacity-50 sm:inline"
              >
                ›
              </span>
            )}
            {index === breadcrumbs.length - 1 ? (
              <span
                aria-current="page"
                className="legend truncate !text-foreground"
              >
                {crumb.label}
              </span>
            ) : (
              <Link
                href={crumb.href}
                className="legend hidden shrink-0 transition-colors hover:!text-foreground sm:block"
              >
                {crumb.label}
              </Link>
            )}
          </React.Fragment>
        ))}
      </nav>

      <div className="flex shrink-0 items-center gap-1">
        <div className="hidden md:block">
          <BalanceIndicator />
        </div>

        <div className="hidden md:block">
          <DepartmentSwitcher />
        </div>

        <div className="mx-1 hidden h-5 w-px bg-border md:block" />

        <button
          onClick={() => setShowCalendar(true)}
          className="hidden h-8 w-8 items-center justify-center rounded-[--radius] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground md:flex"
          title={t("actions.calendar")}
        >
          <CalendarBlank className="h-4 w-4" weight="regular" />
        </button>

        <CalendarSheet open={showCalendar} onOpenChange={setShowCalendar} />

        <ThemeToggle />
        <LanguageSwitcher tone="light" size="sm" />

        <div className="mx-1 hidden h-5 w-px bg-border md:block" />

        <div className="relative" ref={userMenuRef}>
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            aria-haspopup="menu"
            aria-expanded={showUserMenu}
            className={cn(
              "flex items-center gap-2 rounded-[--radius] p-1 transition-colors",
              showUserMenu ? "bg-muted" : "hover:bg-muted",
            )}
          >
            <span className="relative h-7 w-7 overflow-hidden rounded-[--radius] border border-border">
              {user?.picture ? (
                <Image
                  src={user.picture}
                  alt={user?.name || user?.email || "User"}
                  fill
                  className="object-cover"
                  unoptimized
                />
              ) : (
                <Image
                  src={`https://api.dicebear.com/7.x/bottts-neutral/svg?seed=${encodeURIComponent(
                    user?.name || user?.email || "user",
                  )}&backgroundColor=e0f2fe,bfdbfe,dbeafe&radius=50&scale=80`}
                  alt={user?.name || user?.email || "User"}
                  fill
                  className="object-cover"
                  unoptimized
                />
              )}
            </span>
            <span className="hidden min-w-0 flex-col items-start lg:flex">
              <span className="max-w-[140px] truncate text-sm font-semibold leading-tight text-foreground">
                {user?.name || user?.email?.split("@")[0] || "Admin"}
              </span>
              <span className="legend leading-tight">
                {user?.role === "admin"
                  ? t("userMenu.admin")
                  : t("userMenu.user")}
              </span>
            </span>
            <CaretDown
              className={cn(
                "hidden h-3 w-3 text-muted-foreground transition-transform lg:block",
                showUserMenu && "rotate-180",
              )}
              weight="bold"
            />
          </button>

          <AnimatePresence>
            {showUserMenu && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.12, ease: [0.2, 0, 0, 1] }}
                className="absolute right-0 top-full mt-1 w-56 overflow-hidden border border-border bg-popover shadow-xl"
              >
                <div className="border-b border-border px-3 py-2.5">
                  <p className="truncate text-sm font-semibold text-foreground">
                    {user?.name || user?.email?.split("@")[0]}
                  </p>
                  <p className="truncate text-2xs text-muted-foreground">
                    {user?.email}
                  </p>
                </div>

                <div className="p-1">
                  <Link
                    href={settingsLink}
                    className="flex items-center gap-2 rounded-[--radius] px-2 py-1.5 text-sm text-foreground transition-colors hover:bg-muted"
                    onClick={() => setShowUserMenu(false)}
                  >
                    <Gear
                      className="h-4 w-4 text-muted-foreground"
                      weight="regular"
                    />
                    <span>{t("userMenu.settings")}</span>
                  </Link>
                </div>

                <div className="border-t border-border p-1">
                  <button
                    onClick={handleLogout}
                    className="flex w-full items-center gap-2 rounded-[--radius] px-2 py-1.5 text-sm text-destructive-ink transition-colors hover:bg-muted"
                  >
                    <SignOut className="h-4 w-4" weight="bold" />
                    <span>{t("userMenu.logout")}</span>
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  );
}