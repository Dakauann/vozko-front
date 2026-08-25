"use client";

import * as React from "react";

import { AnimatePresence, motion } from "framer-motion";
import {
  CalendarBlank,
  CaretDown,
  Gear,
  List as ListIcon,
  SignOut,
} from "@/components/icons";
import { Link } from "@/i18n/routing";

import { BalanceIndicator } from "@/components/elevated-design/dashboard/balance-indicator";
import { BrandLogo } from "@/components/brand-logo";
import { CalendarSheet } from "@/components/elevated-design/dashboard/calendar-sheet";
import { DepartmentSwitcher } from "@/components/elevated-design/dashboard/department-switcher";
import Image from "next/image";
import LanguageSwitcher from "@/components/language-switcher";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { WorkspaceSwitcher } from "@/components/elevated-design/dashboard/workspace-switcher";
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

/**
 * The app bar — the Azure-shell topology.
 *
 * Full width, owning the top-left corner; the nav rail starts BELOW it. The
 * far-left group is the shell's identity line, read exactly the way the
 * reference reads "Azure Data Explorer | All dashboards": hamburger, brand
 * mark, a hairline divider, then the workspace the whole shell is scoped to.
 * The right side is the readout rack: balance, department, calendar, theme,
 * locale, account.
 *
 * Breadcrumbs no longer live here — the reference keeps the trail with the
 * page it describes, so it moved into the page header (ScopeBreadcrumb),
 * directly above the title it leads to.
 */
export function DashboardNavbar({
  translationsNamespace = "dashboardNavbar",
  settingsLink = "/dashboard/profile",
  className,
}: DashboardNavbarProps = {}) {
  const t = useTranslations(translationsNamespace);
  const tSidebar = useTranslations("sidebar");
  const { user, logout } = useAuth();
  const { isCollapsed, toggleCollapsed, setMobileOpen } = useSidebar();
  const [showUserMenu, setShowUserMenu] = React.useState(false);
  const [showCalendar, setShowCalendar] = React.useState(false);
  const userMenuRef = React.useRef<HTMLDivElement>(null);

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
        // Full width and above the rail: the bar owns the corner now, which is
        // the Azure shell's defining move. z-40 keeps it over the rail (z-30);
        // the mobile drawer and its veil still cover both.
        "fixed inset-x-0 top-0 z-40 flex h-12 items-center gap-2",
        "border-b border-sidebar-border bg-sidebar pl-1.5 pr-3 shadow-sm",
        className,
      )}
    >
      {/* The hamburger. One affordance, two behaviours by viewport: on the
          desktop shell it collapses the rail to its 52px icon strip; below md
          it opens the drawer. Split into two buttons so each carries the right
          accessible name. */}
      <button
        type="button"
        onClick={toggleCollapsed}
        aria-label={isCollapsed ? tSidebar("expand") : tSidebar("collapse")}
        title={isCollapsed ? tSidebar("expand") : tSidebar("collapse")}
        className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-[--radius] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground md:flex"
      >
        <ListIcon className="h-[18px] w-[18px]" weight="regular" />
      </button>
      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        aria-label={tSidebar("openMenu")}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[--radius] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground md:hidden"
      >
        <ListIcon className="h-[18px] w-[18px]" weight="regular" />
      </button>

      <Link
        href="/dashboard"
        className="flex shrink-0 items-center rounded-[--radius] px-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <BrandLogo size="sm" />
      </Link>

      {/* The identity divider — the literal "|" of "Product | Scope". */}
      <div
        aria-hidden="true"
        className="hidden h-5 w-px shrink-0 bg-border-strong md:block"
      />

      <div className="hidden min-w-0 md:block">
        <WorkspaceSwitcher />
      </div>

      <div className="min-w-0 flex-1" />

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
                className="absolute right-0 top-full mt-1 w-56 overflow-hidden rounded-lg border border-border bg-popover shadow-xl"
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
