"use client";

import { DotsThree, Plus, ArrowRight } from "@/components/icons";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import ElevatedContainer from "./elevated-container";

/*
 * Accent recipes.
 *
 * `light` is the GROUND a badge or pill sits on and it is the same opaque
 * --muted for every accent, deliberately. It used to be a 10% wash of the
 * accent's own hue carrying that hue's fill value as the label — the shape
 * this system bans, shipped from a shared map so it landed on every listing
 * card in the product at once. `text` is now the measured ink for that hue in
 * both themes rather than the fill value, which was tuned to sit under a white
 * button label and had nothing left for 11px text.
 *
 * `border` follows the ground: a hairline at --border, so the chip reads as one
 * material instead of a tinted box outlined in a second tint of the same tint.
 */
const colorMap = {
  primary: {
    solid: "tile-brand",
    light: "bg-muted",
    text: "text-primary-ink",
    border: "border-border",
    ring: "ring-ring",
    gradient: "from-primary to-primary/80",
  },
  emerald: {
    solid: "tile-healthy",
    light: "bg-muted",
    text: "text-healthy-ink",
    border: "border-border",
    ring: "ring-healthy/30",
  },
  blue: {
    solid: "tile-neutral",
    light: "bg-muted",
    text: "text-info-ink",
    border: "border-border",
    ring: "ring-info/30",
  },
  amber: {
    solid: "tile-warning",
    light: "bg-muted",
    text: "text-warning-ink",
    border: "border-border",
    ring: "ring-warning/30",
  },
  rose: {
    solid: "tile-fault",
    light: "bg-muted",
    text: "text-destructive-ink",
    border: "border-border",
    ring: "ring-destructive/30",
  },
  purple: {
    solid: "tile-neutral",
    light: "bg-muted",
    text: "text-muted-foreground dark:text-chart-4",
    border: "border-border",
    ring: "ring-chart-4/30",
  },
  orange: {
    solid: "tile-warning",
    light: "bg-muted",
    text: "text-warning-ink",
    border: "border-border",
    ring: "ring-warning/30",
  },
  yellow: {
    solid: "tile-warning",
    light: "bg-muted",
    text: "text-warning-ink",
    border: "border-border",
    ring: "ring-warning/30",
  },
  cyan: {
    solid: "tile-neutral",
    light: "bg-muted",
    text: "text-muted-foreground dark:text-info-ink",
    border: "border-border",
    ring: "ring-info/30",
  },
  slate: {
    solid: "tile-neutral",
    light: "bg-muted",
    text: "text-muted-foreground",
    border: "border-border",
    ring: "ring-slate-500/30",
  },
  red: {
    solid: "tile-fault",
    light: "bg-muted",
    text: "text-destructive-ink",
    border: "border-border",
    ring: "ring-destructive/30",
  },
  green: {
    solid: "tile-healthy",
    light: "bg-muted",
    text: "text-healthy-ink",
    border: "border-border",
    ring: "ring-healthy/30",
  },
  indigo: {
    solid: "tile-neutral",
    light: "bg-muted",
    text: "text-muted-foreground dark:text-info-ink",
    border: "border-border",
    ring: "ring-info/30",
  },
  violet: {
    solid: "tile-neutral",
    light: "bg-muted",
    text: "text-muted-foreground dark:text-chart-4",
    border: "border-border",
    ring: "ring-chart-4/30",
  },
} as const;

type AccentColor = keyof typeof colorMap;

export type { AccentColor };
export { colorMap as accentColorMap };

interface IconBoxProps {
  children: ReactNode;
  color?: AccentColor;
  size?: "sm" | "md" | "lg";
  className?: string;
  animated?: boolean;
}

/**
 * Icon plate.
 *
 * Used 141 times across the product, so this component alone sets the tone.
 * It has now been wrong twice in opposite directions: first a gradient tile
 * with a white glyph, a drop shadow, a hover scale-and-rotate, an inner glow
 * AND an infinite shimmer sweep; then a pale plate carrying the glyph in a
 * darker shade of the plate's own hue — an orange mark on peach, a green mark
 * on mint. The second is quieter but it is the wash, and at 18px the mark and
 * its ground collapse into one smudge.
 *
 * It is the channel lockup now: the colour is the PLATE, opaque, and the glyph
 * is the foreground that colour ships with. Same shape as the WhatsApp mark
 * beside it, which is the one tile in the product that always read correctly.
 * Same props, so all 141 call sites are untouched; `animated` is accepted and
 * ignored, because there is no longer anything to animate.
 */
const plateByColor: Record<string, string> = {
  // The brand fill, for the tile that means the product's own primary object.
  primary: "tile-brand",
  slate: "tile-neutral",
  // Semantic colours keep their meaning and their measured foreground.
  emerald: "tile-healthy",
  green: "tile-healthy",
  rose: "tile-fault",
  red: "tile-fault",
  amber: "tile-warning",
  orange: "tile-warning",
  yellow: "tile-warning",
  // Category identity draws from the chart series, so a category reads the
  // same in a tile as it does in the graph beside it.
  blue: "tile-1",
  indigo: "tile-1",
  cyan: "tile-4",
  violet: "tile-5",
  purple: "tile-5",
};

export function IconBox({
  children,
  color = "primary",
  size = "md",
  className,
}: IconBoxProps) {
  const sizeClasses = {
    sm: "h-8 w-8",
    md: "h-9 w-9",
    lg: "h-10 w-10",
  };
  const iconSizeClasses = {
    sm: "[&>svg]:h-4 [&>svg]:w-4",
    md: "[&>svg]:h-[18px] [&>svg]:w-[18px]",
    lg: "[&>svg]:h-5 [&>svg]:w-5",
  };

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center",
        sizeClasses[size],
        iconSizeClasses[size],
        plateByColor[color] ?? plateByColor.primary,
        className,
      )}
    >
      {children}
    </span>
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
              <p className="text-2xl font-semibold text-foreground">{value}</p>
              {trend && (
                <span
                  className={cn(
                    "flex items-center text-xs font-semibold",
                    trend.positive ? "text-healthy-ink" : "text-destructive-ink",
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
        "inline-flex items-center rounded-[--radius] px-2.5 py-0.5 text-xs font-medium",
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

export function StatusBadge({
  label,
  color = "slate",
  pulse = false,
  icon,
}: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-[--radius] px-2.5 py-1 text-xs font-medium",
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
            className="absolute right-0 top-full z-50 mt-1 min-w-[160px] overflow-hidden rounded-[--radius] border border-border py-1 shadow-lg bg-background"
          >
            {items.map((item, index) => {
              const content = (
                <div
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 text-sm transition-colors",
                    item.danger
                      ? "text-destructive-ink dark:text-destructive-ink hover:bg-muted"
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
              <span className="text-sm font-semibold">{badge}</span>
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
        <div className="mb-4 p-3 rounded-[--radius] bg-muted border border-border">
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
                "h-full rounded-[1px]",
                colorMap[progress.color || accentColor].solid,
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
              className="rounded-[--radius] bg-muted p-3 text-center transition-colors hover:bg-muted"
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
                  "flex items-center gap-1.5 rounded-[--radius] px-3 py-1.5 text-xs font-medium transition-colors",
                  "border border-border bg-muted text-foreground hover:bg-card",
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
                  "flex items-center gap-1.5 rounded-[--radius] px-3 py-1.5 text-xs font-medium transition-colors",
                  "border border-border bg-muted text-foreground hover:bg-card",
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
        "group relative flex h-full flex-col items-center justify-center gap-4 border border-dashed p-6 transition-all duration-300 cursor-pointer overflow-hidden",
        colorMap[accentColor].border,
        "bg-muted hover:bg-accent-hover",
        `hover:border-${accentColor === "primary" ? "primary" : accentColor + "-300"}`,
        className,
      )}
      style={{ minHeight }}
    >
      
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
