"use client";

import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import * as React from "react";

import {
  type Icon as PhosphorIcon,
  CaretDown,
  SquaresFour,
  SignOut,
  Gear,
  ShieldCheck,
} from "@/components/icons";

import Image from "next/image";
import Link from "next/link";
import type { User } from "@/lib/auth/types";
import { getBrand } from "@/config/brand";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";

interface RouteItem {
  href: string;
  icon: PhosphorIcon;
  labelKey: string;
  descriptionKey: string;
  adminOnly?: boolean;
}

interface UserDropdownProps {
  user: User;
  onLogout: () => void;
  tone?: "light" | "dark";
}

function buildAvatarUrl(seed: string) {
  return `https://api.dicebear.com/7.x/bottts-neutral/svg?seed=${encodeURIComponent(
    seed,
  )}&backgroundColor=e0f2fe,bfe3ff,dbeafe&radius=50&scale=80`;
}

interface DropdownLinkProps {
  href: string;
  icon: PhosphorIcon;
  label: string;
  description?: string;
  onSelect?: () => void;
  tone?: "light" | "dark";
}

function DropdownLink({
  href,
  icon: Icon,
  label,
  description,
  onSelect,
  tone = "light",
}: DropdownLinkProps) {
  const isDark = tone === "dark";

  return (
    <DropdownMenuPrimitive.Item asChild onSelect={onSelect}>
      <Link
        href={href}
        className={cn(
          "group flex w-full items-center gap-3 rounded-[--radius] px-3 py-2 text-left text-sm",
          "transition-colors focus-visible:outline-none focus-visible:ring-2",
          isDark
            ? "text-gray-200 hover:bg-white/10 focus-visible:ring-white/20"
            : "text-foreground hover:bg-muted focus-visible:ring-ring",
        )}
      >
        <span
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-lg transition-colors",
            isDark
              ? "bg-white/10 text-muted-foreground/60 group-hover:bg-card group-hover:text-foreground"
              : "bg-muted text-muted-foreground group-hover:bg-foreground group-hover:text-white",
          )}
        >
          <Icon className="h-4 w-4" weight="fill" />
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span
            className={cn(
              "font-medium leading-tight",
              isDark ? "text-white" : "text-foreground",
            )}
          >
            {label}
          </span>
          {description ? (
            <span
              className={cn(
                "mt-0.5 text-xs",
                isDark ? "text-muted-foreground" : "text-muted-foreground",
              )}
            >
              {description}
            </span>
          ) : null}
        </span>
      </Link>
    </DropdownMenuPrimitive.Item>
  );
}

interface DropdownButtonProps {
  icon: PhosphorIcon;
  label: string;
  description?: string;
  onClick: () => void;
  tone?: "light" | "dark";
}

function DropdownButton({
  icon: Icon,
  label,
  description,
  onClick,
  tone = "light",
}: DropdownButtonProps) {
  const isDark = tone === "dark";

  return (
    <DropdownMenuPrimitive.Item asChild>
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "group flex w-full items-center gap-3 rounded-[--radius] px-3 py-2 text-left text-sm font-medium",
          "transition-colors focus-visible:outline-none focus-visible:ring-2",
          isDark
            ? "text-red-300 hover:bg-destructive/10 focus-visible:ring-red-500/40"
            : "text-destructive hover:bg-destructive/10 focus-visible:ring-red-300/60",
        )}
      >
        <span
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-lg",
            "bg-destructive text-destructive-foreground",
          )}
        >
          <Icon className="h-4 w-4" weight="bold" />
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span
            className={cn(
              "leading-tight",
              isDark ? "text-white" : "text-foreground",
            )}
          >
            {label}
          </span>
          {description ? (
            <span
              className={cn(
                "mt-0.5 text-xs",
                isDark ? "text-red-300/80" : "text-red-500/80",
              )}
            >
              {description}
            </span>
          ) : null}
        </span>
      </button>
    </DropdownMenuPrimitive.Item>
  );
}

const DROPDOWN_ROUTES: RouteItem[] = [
  {
    href: "/dashboard",
    icon: SquaresFour,
    labelKey: "links.dashboard.label",
    descriptionKey: "links.dashboard.description",
  },
];

export function UserDropdown({
  user,
  onLogout,
  tone = "light",
}: UserDropdownProps) {
  const [open, setOpen] = React.useState(false);
  const t = useTranslations("userDropdown");

  const routes = DROPDOWN_ROUTES;

  const handleLogout = React.useCallback(() => {
    setOpen(false);
    onLogout();
  }, [onLogout]);

  const accountBadge =
    user.customerType === "company"
      ? t("accountTypes.business")
      : t("accountTypes.individual");

  return (
    <DropdownMenuPrimitive.Root open={open} onOpenChange={setOpen}>
      <DropdownMenuPrimitive.Trigger asChild>
        <motion.button
          whileTap={{ scale: 0.98 }}
          className={cn(
            "group flex items-center gap-3 rounded-[--radius] px-3 py-1.5 text-left text-sm font-medium",
            tone === "dark"
              ? "text-white hover:bg-white/10"
              : "text-foreground hover:bg-muted",
            "transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          )}
        >
          <span
            className={cn(
              "relative h-9 w-9 flex-shrink-0 overflow-hidden rounded-full",
              tone === "dark" ? "bg-white/10" : "bg-muted",
            )}
          >
            <Image
              src={
                user.picture
                  ? user.picture
                  : buildAvatarUrl(user.name || user.email)
              }
              alt={user.name || user.email}
              fill
              className="object-cover"
              unoptimized
            />
          </span>

          <span className="hidden lg:flex min-w-0 flex-col">
            <span
              className={cn(
                "truncate text-sm font-semibold",
                tone === "dark" ? "text-white" : "text-foreground",
              )}
            >
              {user.name || user.email.split("@")[0]}
            </span>
            <span
              className={cn(
                "truncate text-xs",
                tone === "dark"
                  ? "text-muted-foreground/60"
                  : "text-muted-foreground",
              )}
            >
              {user.email}
            </span>
          </span>

          <CaretDown
            className={cn(
              "hidden h-4 w-4 transition-transform duration-200 lg:block",
              tone === "dark"
                ? "text-muted-foreground/60"
                : "text-muted-foreground",
              open ? "rotate-180" : "",
            )}
            weight="bold"
          />
        </motion.button>
      </DropdownMenuPrimitive.Trigger>

      <DropdownMenuPrimitive.Portal>
        <DropdownMenuPrimitive.Content
          align="end"
          sideOffset={12}
          className="z-50 min-w-[240px]"
          asChild
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -8 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className={cn(
              "overflow-hidden rounded-[--radius] border p-3 shadow-lg",
              tone === "dark"
                ? "border-white/10 bg-black"
                : "border-border bg-card",
            )}
          >
            <div className="space-y-4">
              <div
                className={cn(
                  "rounded-[--radius] p-3",
                  tone === "dark" ? "bg-white/5" : "bg-muted",
                )}
              >
                <div className="relative flex items-start gap-3">
                  <span
                    className={cn(
                      "flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg",
                      tone === "dark"
                        ? "bg-white/10 text-gray-200"
                        : "bg-border text-foreground",
                    )}
                  >
                    <ShieldCheck className="h-4 w-4" weight="fill" />
                  </span>
                  <div className="flex-1">
                    <p
                      className={cn(
                        "text-sm font-semibold",
                        tone === "dark" ? "text-white" : "text-foreground",
                      )}
                    >
                      {user.name || `Conta ${getBrand().name}`}
                    </p>
                    <p
                      className={cn(
                        "text-xs",
                        tone === "dark"
                          ? "text-muted-foreground/60"
                          : "text-muted-foreground",
                      )}
                    >
                      {user.email}
                    </p>
                    <span
                      className={cn(
                        "mt-2 inline-flex items-center gap-2 rounded-[--radius] px-2.5 py-1 text-[11px] font-medium",
                        tone === "dark"
                          ? "bg-white/10 text-gray-200"
                          : "bg-card text-muted-foreground",
                      )}
                    >
                      {accountBadge}
                    </span>
                    {user.role === "admin" ? (
                      <span
                        className={cn(
                          "ml-2 inline-flex items-center gap-1 rounded-[--radius] px-2 py-1 text-[11px] font-semibold uppercase tracking-wide",
                          tone === "dark"
                            ? "bg-card text-foreground"
                            : "bg-foreground text-white",
                        )}
                      >
                        Admin
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                {routes.map((route) => (
                  <DropdownLink
                    key={route.href}
                    href={route.href}
                    icon={route.icon}
                    label={t(route.labelKey)}
                    description={t(route.descriptionKey)}
                    onSelect={() => setOpen(false)}
                    tone={tone}
                  />
                ))}
              </div>

              <DropdownMenuPrimitive.Separator
                className={cn(
                  "border-t",
                  tone === "dark" ? "border-white/10" : "border-border",
                )}
              />

              <DropdownButton
                icon={SignOut}
                label={t("logout.label")}
                description={t("logout.description")}
                onClick={handleLogout}
                tone={tone}
              />
            </div>
          </motion.div>
        </DropdownMenuPrimitive.Content>
      </DropdownMenuPrimitive.Portal>
    </DropdownMenuPrimitive.Root>
  );
}
