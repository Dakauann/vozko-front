"use client";

import { DotsThree, Plus, ArrowRight } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import ElevatedContainer from "./elevated-container";

const colorMap = {
  primary: {
    solid: "bg-primary",
    light: "bg-primary/10",
    text: "text-primary",
    border: "border-primary/20",
    ring: "ring-primary/30",
    gradient: "from-primary to-primary/80",
  },
  emerald: {
    solid: "bg-emerald-500",
    light: "bg-emerald-500/10",
    text: "text-emerald-600 dark:text-emerald-400",
    border: "border-emerald-500/20",
    ring: "ring-emerald-500/30",
    gradient: "from-emerald-500 to-emerald-600",
  },
  blue: {
    solid: "bg-blue-500",
    light: "bg-primary/10",
    text: "text-primary",
    border: "border-blue-500/20",
    ring: "ring-blue-500/30",
    gradient: "from-blue-500 to-blue-600",
  },
  amber: {
    solid: "bg-amber-500",
    light: "bg-amber-500/10",
    text: "text-amber-600 dark:text-amber-400",
    border: "border-amber-500/20",
    ring: "ring-amber-500/30",
    gradient: "from-amber-500 to-amber-600",
  },
  rose: {
    solid: "bg-rose-500",
    light: "bg-rose-500/10",
    text: "text-rose-600 dark:text-rose-400",
    border: "border-rose-500/20",
    ring: "ring-rose-500/30",
    gradient: "from-rose-500 to-rose-600",
  },
  purple: {
    solid: "bg-purple-500",
    light: "bg-purple-500/10",
    text: "text-purple-600 dark:text-purple-400",
    border: "border-purple-500/20",
    ring: "ring-purple-500/30",
    gradient: "from-purple-500 to-purple-600",
  },
  orange: {
    solid: "bg-orange-500",
    light: "bg-orange-500/10",
    text: "text-orange-600 dark:text-orange-400",
    border: "border-orange-500/20",
    ring: "ring-orange-500/30",
    gradient: "from-orange-500 to-orange-600",
  },
  yellow: {
    solid: "bg-yellow-500",
    light: "bg-yellow-500/10",
    text: "text-yellow-600 dark:text-yellow-400",
    border: "border-yellow-500/20",
    ring: "ring-yellow-500/30",
    gradient: "from-yellow-500 to-yellow-600",
  },
  cyan: {
    solid: "bg-cyan-500",
    light: "bg-cyan-500/10",
    text: "text-cyan-600 dark:text-cyan-400",
    border: "border-cyan-500/20",
    ring: "ring-cyan-500/30",
    gradient: "from-cyan-500 to-cyan-600",
  },
  slate: {
    solid: "bg-slate-500",
    light: "bg-muted",
    text: "text-muted-foreground",
    border: "border-border",
    ring: "ring-slate-500/30",
    gradient: "from-slate-500 to-slate-600",
  },
  red: {
    solid: "bg-red-500",
    light: "bg-red-500/10",
    text: "text-red-600 dark:text-red-400",
    border: "border-red-500/20",
    ring: "ring-red-500/30",
    gradient: "from-red-500 to-red-600",
  },
  green: {
    solid: "bg-green-500",
    light: "bg-green-500/10",
    text: "text-green-600 dark:text-green-400",
    border: "border-green-500/20",
    ring: "ring-green-500/30",
    gradient: "from-green-500 to-green-600",
  },
  indigo: {
    solid: "bg-indigo-500",
    light: "bg-indigo-500/10",
    text: "text-indigo-600 dark:text-indigo-400",
    border: "border-indigo-500/20",
    ring: "ring-indigo-500/30",
    gradient: "from-indigo-500 to-indigo-600",
  },
  violet: {
    solid: "bg-violet-500",
    light: "bg-violet-500/10",
    text: "text-violet-600 dark:text-violet-400",
    border: "border-violet-500/20",
    ring: "ring-violet-500/30",
    gradient: "from-violet-500 to-violet-600",
  },
} as const;

type AccentColor = keyof typeof colorMap;

interface IconBoxProps {
  children: ReactNode;
  color?: AccentColor;
  size?: "sm" | "md" | "lg";
  className?: string;
  animated?: boolean;
}

export function IconBox({
  children,
  color = "primary",
  size = "md",
  className,
  animated = true,
}: IconBoxProps) {
  const sizeClasses = {
    sm: "h-10 w-10 rounded-xl",
    md: "h-12 w-12 rounded-xl",
    lg: "h-14 w-14 rounded-2xl",
  };

  const iconSizeClasses = {
    sm: "[&>svg]:h-5 [&>svg]:w-5",
    md: "[&>svg]:h-6 [&>svg]:w-6",
    lg: "[&>svg]:h-7 [&>svg]:w-7",
  };

  const colorConfig = colorMap[color] || colorMap.primary;

  return (
    <motion.div
      className={cn(
        "relative flex shrink-0 items-center justify-center overflow-hidden text-white shadow-lg",
        `bg-gradient-to-br ${colorConfig.gradient}`,
        sizeClasses[size],
        iconSizeClasses[size],
        className,
      )}
      whileHover={animated ? { scale: 1.05, rotate: 3 } : undefined}
      transition={{ type: "spring", stiffness: 400, damping: 17 }}
    >
      {/* Inner glow */}
      <div className="absolute inset-0 bg-white/10 opacity-0 transition-opacity group-hover:opacity-100" />
      {/* Shimmer effect */}
      <motion.div
        className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent"
        animate={{ translateX: ["100%", "-100%"] }}
        transition={{
          duration: 2,
          repeat: Infinity,
          repeatDelay: 3,
          ease: "easeInOut",
        }}
      />
      {children}
    </motion.div>
  );
}

interface StatsCardProps {
  icon: ReactNode;
  value: string | number;
  label: string;
  color?: AccentColor;
  trend?: {
    value: number;
    positive: boolean;
  };
  loading?: boolean;
  className?: string;
}

export function StatsCard({
  icon,
  value,
  label,
  color = "primary",
  trend,
  loading = false,
  className,
}: StatsCardProps) {
  const colorConfig = colorMap[color] || colorMap.primary;

  return (
    <ElevatedContainer className={cn(className)}>
      {/* Background decoration */}
      <div
        className={cn(
          "absolute -right-4 -top-4 h-24 w-24 rounded-full opacity-5 blur-2xl transition-opacity group-hover:opacity-10",
          colorConfig.solid,
        )}
      />

      <div className="relative flex items-center gap-4">
        <IconBox color={color} size="md">
          {icon}
        </IconBox>
        <div>
          {loading ? (
            <div className="h-8 w-16 animate-pulse rounded-lg bg-border" />
          ) : (
            <div className="flex items-baseline gap-2">
              <p className="text-2xl font-bold text-foreground">{value}</p>
              {trend && (
                <span
                  className={cn(
                    "flex items-center text-xs font-semibold",
                    trend.positive ? "text-emerald-600" : "text-rose-600",
                  )}
                >
                  {trend.positive ? "↑" : "↓"} {Math.abs(trend.value)}%
                </span>
              )}
            </div>
          )}
          <p className="text-sm text-muted-foreground">{label}</p>
        </div>
      </div>
    </ElevatedContainer>
  );
}

interface BadgeProps {
  label: string;
  color?: AccentColor;
}

function Badge({ label, color = "slate" }: BadgeProps) {
  const colorConfig = colorMap[color] || colorMap.slate;

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        colorConfig.light,
        colorConfig.text,
      )}
    >
      {label}
    </span>
  );
}

interface StatusBadgeProps {
  label: string;
  color?: AccentColor;
  pulse?: boolean;
  icon?: ReactNode;
}

function StatusBadge({
  label,
  color = "slate",
  pulse = false,
  icon,
}: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
        colorMap[color].light,
        colorMap[color].text,
      )}
    >
      {pulse ? (
        <span className="relative flex h-2 w-2">
          <span
            className={cn(
              "absolute inline-flex h-full w-full animate-ping rounded-full opacity-75",
              colorMap[color].solid,
            )}
          />
          <span
            className={cn(
              "relative inline-flex h-2 w-2 rounded-full",
              colorMap[color].solid,
            )}
          />
        </span>
      ) : icon ? (
        <span className="[&>svg]:h-3.5 [&>svg]:w-3.5">{icon}</span>
      ) : (
        <span
          className={cn("h-1.5 w-1.5 rounded-full", colorMap[color].solid)}
        />
      )}
      {label}
    </span>
  );
}

interface MenuItem {
  label: string;
  icon?: ReactNode;
  onClick?: () => void;
  href?: string;
  danger?: boolean;
}

interface MenuDropdownProps {
  items: MenuItem[];
  isOpen: boolean;
  onClose: () => void;
}

function MenuDropdown({ items, isOpen, onClose }: MenuDropdownProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={onClose} />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -8 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full z-50 mt-1 min-w-[160px] overflow-hidden rounded-xl border border-border py-1 shadow-lg bg-background"
          >
            {items.map((item, index) => {
              const content = (
                <div
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 text-sm transition-colors",
                    item.danger
                      ? "text-rose-600 dark:text-rose-400 hover:bg-rose-500/10"
                      : "text-foreground hover:bg-muted",
                  )}
                >
                  {item.icon && (
                    <span className="[&>svg]:h-4 [&>svg]:w-4">{item.icon}</span>
                  )}
                  {item.label}
                </div>
              );

              if (item.href) {
                return (
                  <Link key={index} href={item.href} onClick={onClose}>
                    {content}
                  </Link>
                );
              }

              return (
                <button
                  key={index}
                  type="button"
                  onClick={() => {
                    item.onClick?.();
                    onClose();
                  }}
                  className="w-full text-left"
                >
                  {content}
                </button>
              );
            })}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

interface ListingCardStat {
  label: string;
  value: ReactNode;
  color?: string;
  icon?: ReactNode;
}

interface ListingCardMeta {
  icon: ReactNode;
  label: string;
  value?: string;
  color?: string;
}

interface ListingCardAction {
  label: string;
  icon?: ReactNode;
  href?: string;
  onClick?: () => void;
  variant?: "primary" | "secondary";
}

interface ListingCardProps {
  badge?: string;
  badgeColor?: AccentColor;
  icon?: ReactNode;
  title: string;
  subtitle?: string;

  status?: {
    label: string;
    color?: AccentColor;
    pulse?: boolean;
    icon?: ReactNode;
  };

  description?: string;
  category?: string;
  categoryColor?: AccentColor;
  tags?: Array<{ label: string; color?: AccentColor }>;

  metaItems?: ListingCardMeta[];

  progress?: {
    value: number;
    color?: AccentColor;
    label?: string;
  };

  stats?: ListingCardStat[];

  footerText?: string;
  primaryAction?: ListingCardAction;
  secondaryAction?: ListingCardAction;

  menuItems?: MenuItem[];

  accentColor?: AccentColor;
  className?: string;
}

export function ListingCard({
  badge,
  badgeColor = "primary",
  icon,
  title,
  subtitle,
  status,
  description,
  category,
  categoryColor = "slate",
  tags,
  metaItems,
  progress,
  stats,
  footerText,
  primaryAction,
  secondaryAction,
  menuItems,
  accentColor = "primary",
  className,
}: ListingCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <ElevatedContainer className={cn(className)}>
      {/* Background decoration */}
      <div
        className={cn(
          "absolute -right-8 -top-8 h-32 w-32 rounded-full opacity-5 blur-3xl transition-opacity group-hover:opacity-10",
          colorMap[accentColor].solid,
        )}
      />

      {/* Header */}
      <div className="relative flex items-start justify-between gap-4 mb-4">
        <div className="flex items-center gap-3">
          {badge ? (
            <IconBox color={badgeColor} size="md">
              <span className="text-sm font-bold">{badge}</span>
            </IconBox>
          ) : icon ? (
            <IconBox color={accentColor} size="md">
              {icon}
            </IconBox>
          ) : null}
          <div className="min-w-0">
            <h3 className="font-semibold text-foreground truncate">{title}</h3>
            {subtitle && (
              <p className="text-xs text-muted-foreground truncate">
                {subtitle}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {status && (
            <StatusBadge
              label={status.label}
              color={status.color}
              pulse={status.pulse}
              icon={status.icon}
            />
          )}
          {menuItems && menuItems.length > 0 && (
            <div className="relative">
              <button type="button" onClick={() => setMenuOpen(!menuOpen)}>
                <DotsThree className="h-4 w-4" weight="bold" />
              </button>
              <MenuDropdown
                items={menuItems}
                isOpen={menuOpen}
                onClose={() => setMenuOpen(false)}
              />
            </div>
          )}
        </div>
      </div>

      {/* Category/Tags */}
      {(category || tags) && (
        <div className="flex flex-wrap gap-1.5 mb-4">
          {category && <Badge label={category} color={categoryColor} />}
          {tags?.map((tag, index) => (
            <Badge key={index} label={tag.label} color={tag.color} />
          ))}
        </div>
      )}

      {/* Meta items */}
      {metaItems && metaItems.length > 0 && (
        <div className="mb-4 space-y-1.5">
          {metaItems.map((meta, index) => (
            <div key={index} className="flex items-center gap-2 text-xs">
              <span
                className={cn(
                  "[&>svg]:h-3.5 [&>svg]:w-3.5 shrink-0",
                  meta.color || "text-muted-foreground",
                )}
              >
                {meta.icon}
              </span>
              <span className="text-muted-foreground truncate">
                {meta.label}
              </span>
              {meta.value && (
                <span className="font-medium text-foreground truncate ml-auto">
                  {meta.value}
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Description */}
      {description && (
        <div className="mb-4 p-3 rounded-xl bg-muted border border-border">
          <p className="text-sm text-muted-foreground line-clamp-2">
            {description}
          </p>
        </div>
      )}

      {/* Progress bar */}
      {progress && (
        <div className="mb-4">
          {progress.label && (
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-muted-foreground">
                {progress.label}
              </span>
              <span className="text-xs font-semibold text-foreground">
                {progress.value}%
              </span>
            </div>
          )}
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progress.value}%` }}
              transition={{ duration: 1, ease: "easeOut" }}
              className={cn(
                "h-full rounded-full bg-gradient-to-r",
                colorMap[progress.color || accentColor].gradient,
              )}
            />
          </div>
        </div>
      )}

      {/* Stats grid */}
      {stats && stats.length > 0 && (
        <div
          className={cn(
            "grid gap-3 mb-4",
            stats.length === 2 ? "grid-cols-2" : "grid-cols-3",
          )}
        >
          {stats.map((stat, index) => (
            <div
              key={index}
              className="rounded-xl bg-muted/80 p-3 text-center transition-colors hover:bg-muted"
            >
              {stat.icon && (
                <div
                  className={cn(
                    "flex justify-center mb-1 [&>svg]:h-3.5 [&>svg]:w-3.5",
                    stat.color || "text-muted-foreground",
                  )}
                >
                  {stat.icon}
                </div>
              )}
              <p
                className={cn(
                  "text-sm font-semibold",
                  stat.color || "text-foreground",
                )}
              >
                {stat.value}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {stat.label}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between pt-4 border-t border-border">
        {footerText && (
          <p className="text-xs text-muted-foreground">{footerText}</p>
        )}

        <div className="flex items-center gap-2 ml-auto">
          {secondaryAction &&
            (secondaryAction.href ? (
              <Link
                href={secondaryAction.href}
                className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted"
              >
                {secondaryAction.icon}
                {secondaryAction.label}
              </Link>
            ) : (
              <button
                type="button"
                onClick={secondaryAction.onClick}
                className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted"
              >
                {secondaryAction.icon}
                {secondaryAction.label}
              </button>
            ))}

          {primaryAction &&
            (primaryAction.href ? (
              <Link
                href={primaryAction.href}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-white transition-all hover:shadow-lg",
                  `bg-gradient-to-r ${colorMap[accentColor].gradient}`,
                )}
              >
                {primaryAction.icon}
                {primaryAction.label}
              </Link>
            ) : (
              <button
                type="button"
                onClick={primaryAction.onClick}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-white transition-all hover:shadow-lg",
                  `bg-gradient-to-r ${colorMap[accentColor].gradient}`,
                )}
              >
                {primaryAction.icon}
                {primaryAction.label}
              </button>
            ))}
        </div>
      </div>
    </ElevatedContainer>
  );
}

interface AddNewCardProps {
  icon?: ReactNode;
  title: string;
  description: string;
  href?: string;
  onClick?: () => void;
  accentColor?: AccentColor;
  className?: string;
  minHeight?: string;
  ctaLabel?: string;
}

export function AddNewCard({
  icon,
  title,
  description,
  href,
  onClick,
  accentColor = "primary",
  className,
  minHeight = "280px",
  ctaLabel,
}: AddNewCardProps) {
  const content = (
    <ElevatedContainer
      className={cn(
        "group relative flex h-full flex-col items-center justify-center gap-4 border-2 border-dashed p-6 transition-all duration-300 cursor-pointer overflow-hidden",
        colorMap[accentColor].border,
        "bg-muted/50 hover:bg-gradient-to-br hover:from-muted hover:to-card",
        `hover:border-${accentColor === "primary" ? "primary" : accentColor + "-300"}`,
        className,
      )}
      style={{ minHeight }}
    >
      {/* Background decoration */}
      {/* <div
        className={cn(
          "absolute inset-0 bg-gradient-to-br opacity-0 transition-opacity group-hover:opacity-5",
          colorMap[accentColor].gradient,
        )}
      /> */}

      <motion.div
        whileHover={{ scale: 1.1, rotate: icon ? 0 : 90 }}
        transition={{ type: "spring", stiffness: 400, damping: 17 }}
      >
        {/* should be relative */}
        <IconBox color={accentColor} size="lg">
          {icon || <Plus className="h-7 w-7" weight="bold" />}
        </IconBox>
      </motion.div>

      <div className="relative text-center">
        <p className="font-semibold text-foreground">{title}</p>
        <p className="text-sm text-muted-foreground mt-1">{description}</p>
      </div>

      {/* Hover CTA */}
      {ctaLabel && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          whileHover={{ opacity: 1, y: 0 }}
          className={cn(
            "flex items-center gap-1 text-xs font-medium",
            colorMap[accentColor].text,
          )}
        >
          <span>{ctaLabel}</span>
          <ArrowRight className="h-3.5 w-3.5" weight="bold" />
        </motion.div>
      )}
    </ElevatedContainer>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }

  return (
    <button type="button" onClick={onClick} className="w-full h-full text-left">
      {content}
    </button>
  );
}

export default ListingCard;
