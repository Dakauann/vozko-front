"use client";

import * as React from "react";

import { AnimatePresence, motion } from "framer-motion";
import {
  CalendarBlank,
  CaretDown,
  Gear,
  SignOut,
  User,
} from "@phosphor-icons/react";
import { Link, usePathname } from "@/i18n/routing";

import { BalanceIndicator } from "@/components/elevated-design/dashboard/balance-indicator";
import { CalendarSheet } from "@/components/elevated-design/dashboard/calendar-sheet";
import { DepartmentSwitcher } from "@/components/elevated-design/dashboard/department-switcher";
import Image from "next/image";
import LanguageSwitcher from "@/components/language-switcher";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { BrandLogo } from "@/components/brand-logo";
import { WorkspaceSwitcher } from "@/components/elevated-design/dashboard/workspace-switcher";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/auth-context";
import { useTheme } from "next-themes";
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
  logoLink = "/dashboard",
  settingsLink = "/dashboard/profile",
  profileLink = "/perfil",
  homeLink = "/",
  className,
}: DashboardNavbarProps = {}) {
  const t = useTranslations(translationsNamespace);
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  const [showUserMenu, setShowUserMenu] = React.useState(false);
  const [showCalendar, setShowCalendar] = React.useState(false);
  const userMenuRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const labelMap: Record<string, string> = {
    dashboard: t("breadcrumbs.dashboard"),
    agents: t("breadcrumbs.agents"),
    new: t("breadcrumbs.new"),
    campaigns: t("breadcrumbs.campaigns"),
    configuracoes: t("breadcrumbs.settings"),
    profile: t("breadcrumbs.profile"),
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
    <motion.header
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className={cn(
        "fixed top-0 left-0 right-0 z-40 h-20 border-b border-border/80 bg-card/80 backdrop-blur-xl",
        className,
      )}
    >
      <div className="flex h-full items-center justify-between px-3 sm:px-6">
        <div className="flex items-center gap-6">
          <Link href={logoLink} className="flex items-center">
            <BrandLogo
              useWhite={mounted && resolvedTheme === "dark"}
              size="md"
              hideTextOnMobile
            />
          </Link>

          <div className="hidden md:block">
            <WorkspaceSwitcher />
          </div>

          <div className="hidden md:block">
            <DepartmentSwitcher />
          </div>

          <nav className="hidden items-center gap-2 lg:flex">
            <span className="text-slate-300">/</span>
            {breadcrumbs.map((crumb, index) => (
              <React.Fragment key={crumb.href}>
                {index > 0 && <span className="text-slate-300">/</span>}
                {index === breadcrumbs.length - 1 ? (
                  <span className="text-sm font-medium text-foreground">
                    {crumb.label}
                  </span>
                ) : (
                  <Link
                    href={crumb.href}
                    className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {crumb.label}
                  </Link>
                )}
              </React.Fragment>
            ))}
          </nav>
        </div>

        {/* Balance indicator - centered */}
        <div className="hidden flex-1 justify-center px-8 md:flex">
          <BalanceIndicator />
        </div>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          <LanguageSwitcher tone="light" size="sm" />
          <div className="hidden items-center gap-1 md:flex">
            <button
              onClick={() => setShowCalendar(true)}
              className="flex h-10 w-10 items-center justify-center rounded-xl text-muted-foreground transition-all hover:bg-muted hover:text-foreground"
              title={t("actions.calendar")}
            >
              <CalendarBlank className="h-5 w-5" weight="fill" />
            </button>
          </div>

          <CalendarSheet open={showCalendar} onOpenChange={setShowCalendar} />

          <div className="mx-2 hidden h-8 w-px bg-border md:block" />

          <div className="relative" ref={userMenuRef}>
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-3 rounded-xl p-2 transition-all hover:bg-muted"
            >
              <div className="relative h-9 w-9 overflow-hidden rounded-xl border-2 border-border shadow-sm">
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
              </div>
              <div className="hidden flex-col items-start lg:flex">
                <span className="text-sm font-semibold text-foreground">
                  {user?.name || user?.email?.split("@")[0] || "Admin"}
                </span>
                <span className="text-xs text-muted-foreground">
                  {user?.role === "admin"
                    ? t("userMenu.admin")
                    : t("userMenu.user")}
                </span>
              </div>
              <CaretDown
                className={cn(
                  "hidden h-4 w-4 text-muted-foreground transition-transform lg:block",
                  showUserMenu && "rotate-180",
                )}
                weight="bold"
              />
            </button>

            <AnimatePresence>
              {showUserMenu && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 top-full mt-2 w-56 overflow-hidden rounded-2xl border border-border bg-card shadow-xl"
                >
                  <div className="border-b border-border px-4 py-3">
                    <p className="text-sm font-semibold text-foreground">
                      {user?.name || user?.email?.split("@")[0]}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {user?.email}
                    </p>
                  </div>

                  <div className="p-2">
                    <Link
                      href={settingsLink}
                      className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-foreground transition-colors hover:bg-muted"
                      onClick={() => setShowUserMenu(false)}
                    >
                      <Gear
                        className="h-4 w-4 text-muted-foreground"
                        weight="fill"
                      />
                      <span>{t("userMenu.settings")}</span>
                    </Link>
                  </div>

                  <div className="border-t border-border p-2">
                    <button
                      onClick={handleLogout}
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-red-600 transition-colors hover:bg-destructive/10"
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
      </div>
    </motion.header>
  );
}
