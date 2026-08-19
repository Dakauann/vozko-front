"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";

import { Link } from "@/i18n/routing";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

type BaseVariant =
  | "primary"
  | "secondary"
  | "outline"
  | "outline-subtle"
  | "ghost"
  | "vsl"
  | "action";
type LegacyVariant =
  | "main-cta"
  | "secondary-cta"
  | "main-cta-mobile"
  | "secondary-cta-mobile"
  | "vsl-cta";

type ButtonVariant = BaseVariant | LegacyVariant;
type ButtonSize = "default" | "sm" | "lg" | "icon";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  title?: string;
  /** Optional class for the title span (e.g. hide on small screens). */
  titleClassName?: string;
  link?: string;
  newTab?: boolean;
  icon?: ReactNode;
  iconVisible?: boolean;
  iconColor?: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  iconSide?: "left" | "right";
}

const variantAlias: Record<ButtonVariant, BaseVariant> = {
  primary: "primary",
  secondary: "secondary",
  outline: "outline",
  "outline-subtle": "outline-subtle",
  ghost: "ghost",
  vsl: "vsl",
  action: "action",
  "main-cta": "primary",
  "main-cta-mobile": "primary",
  "secondary-cta": "secondary",
  "secondary-cta-mobile": "secondary",
  "vsl-cta": "vsl",
};

// This is the app's de-facto button (136 consumers), so it carries exactly the
// grammar in ui/button.tsx rather than a second dialect of it: a discrete
// rest/hover/pressed colour ramp from one reference system, and the layered
// shadow plus one-pixel lift from the other.
//
// Only `primary`, `vsl` and `action` carry a fill. Everything else is neutral —
// a screen with several accent buttons has no primary action left on it.
const variantClasses: Record<BaseVariant, string> = {
  primary:
    "bg-primary text-primary-foreground shadow-button hover:bg-[hsl(var(--primary-hover))] hover:shadow-button-hover active:bg-[hsl(var(--primary-active))] active:shadow-button",
  // The quiet button: its 1px edge IS the first layer of --elev-button-quiet,
  // so border and elevation compose instead of double-drawing an outline.
  secondary:
    "bg-card text-foreground shadow-quiet hover:shadow-quiet-hover active:bg-muted active:shadow-quiet",
  outline:
    "group border border-border-strong bg-transparent text-foreground hover:bg-muted active:bg-[hsl(var(--accent-hover))]",
  "outline-subtle":
    "border border-border bg-transparent text-foreground hover:bg-muted active:bg-[hsl(var(--accent-hover))]",
  ghost:
    "bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground active:bg-[hsl(var(--accent-hover))]",
  vsl: "bg-primary text-primary-foreground shadow-button hover:bg-[hsl(var(--primary-hover))] hover:shadow-button-hover active:shadow-button",
  action:
    "bg-primary text-primary-foreground shadow-button min-h-[32px] px-3 gap-1.5 hover:bg-[hsl(var(--primary-hover))] hover:shadow-button-hover active:bg-[hsl(var(--primary-active))] active:shadow-button disabled:cursor-not-allowed",
};

// The sm: prefixes are the touch floor, not a design step — below sm every
// control sits under a thumb, so the phone height is the larger of the two.
const sizeClasses: Record<ButtonSize, string> = {
  default: "min-h-[34px] px-3 py-1 text-sm leading-[18px] sm:min-h-[32px]",
  sm: "min-h-[34px] px-2.5 py-0.5 text-xs sm:min-h-[28px]",
  lg: "min-h-[40px] px-5 py-1.5 text-sm sm:min-h-[40px]",
  icon: "min-h-[34px] w-9 px-2 py-1 sm:min-h-[32px] sm:w-8",
};

function resolveIconColorClass(variant: BaseVariant) {
  switch (variant) {
    case "primary":
    case "vsl":
    case "action":
      return "text-primary-foreground";
    case "secondary":
    case "outline-subtle":
    case "outline":
      return "text-foreground";
    case "ghost":
    default:
      return "text-muted-foreground";
  }
}

const Button = ({
  title,
  titleClassName,
  link,
  newTab = true,
  icon,
  iconVisible = false,
  iconColor,
  variant = "primary",
  size,
  className,
  iconSide = "left",
  disabled = false,
  type = "button",
  ...rest
}: ButtonProps) => {
  const hasTitle = Boolean(title);
  const resolvedVariant = variantAlias[variant] ?? "primary";
  const effectiveSize = size ?? (!hasTitle && iconVisible ? "icon" : "default");
  const isHashLink = Boolean(link?.startsWith("#"));
  const isExternalLink = Boolean(
    link && /^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(link),
  );

  // One radius for every variant — 6px, off the shared ramp. Four different
  // corner treatments across variants was never a system.
  const buttonClass = cn(
    "inline-flex items-center justify-center whitespace-nowrap rounded-[--radius] font-medium gap-1.5",
    "transition-[background-color,box-shadow,transform,color,border-color] duration-150",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
    // Flat neutral chip when disabled: no fill, no elevation, no lift. Leaving
    // the shadow on is what keeps a disabled button looking pressable.
    "disabled:pointer-events-none disabled:border disabled:border-border disabled:bg-muted disabled:text-muted-foreground disabled:shadow-none",
    effectiveSize !== "icon" && "min-w-16",
    sizeClasses[effectiveSize],
    variantClasses[resolvedVariant],
    className,
  );

  const iconClass = cn(
    "flex h-4 w-4 items-center justify-center [&>svg]:h-4 [&>svg]:w-4 transition-colors",
    iconColor
      ? undefined
      : resolvedVariant === "ghost"
        ? "text-foreground"
        : resolveIconColorClass(resolvedVariant),
  );

  const iconStyle = iconColor ? { color: iconColor } : undefined;

  const iconElement = iconVisible ? (
    <span className={iconClass} style={iconStyle}>
      {icon}
    </span>
  ) : null;

  const content = (
    <motion.button
      type={type}
      disabled={disabled}
      className={buttonClass}
      transition={{ type: "spring", stiffness: 220, damping: 18 }}
      {...(rest as Record<string, unknown>)}
    >
      {iconSide === "left" && iconElement}
      {hasTitle ? (
        <span className={cn("leading-none", titleClassName)}>{title}</span>
      ) : null}
      {iconSide === "right" && iconElement}
    </motion.button>
  );

  if (link) {
    if (newTab || isHashLink || isExternalLink) {
      return (
        <a
          href={link}
          rel={newTab && !isHashLink ? "noopener noreferrer" : undefined}
          target={newTab && !isHashLink ? "_blank" : undefined}
          className={cn(
            "inline-block",
            className?.includes("w-full") && "w-full",
          )}
        >
          {content}
        </a>
      );
    }

    return (
      <Link
        href={link}
        className={cn(
          "inline-block",
          className?.includes("w-full") && "w-full",
        )}
      >
        {content}
      </Link>
    );
  }

  return content;
};

export default Button;
