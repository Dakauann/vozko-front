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

// Only `primary` and `action` carry the lamp. Everything else is neutral: a
// screen with several accent-tinted buttons has no primary action left, and in
// this system the accent is reserved for "current" and "commit".
const variantClasses: Record<BaseVariant, string> = {
  primary:
    "bg-primary text-primary-foreground hover:bg-[hsl(var(--primary-hover))] active:bg-[hsl(var(--primary-active))]",
  secondary:
    "border border-border border-t-rule-strong bg-card text-foreground hover:bg-muted",
  outline:
    "group border border-border bg-transparent text-foreground hover:bg-muted",
  "outline-subtle":
    "border border-border bg-transparent text-foreground hover:bg-muted",
  ghost: "bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground",
  vsl: "bg-primary text-primary-foreground hover:bg-[hsl(var(--primary-hover))]",
  action:
    "bg-primary text-primary-foreground min-h-[32px] px-3 gap-1.5 hover:bg-[hsl(var(--primary-hover))] active:bg-[hsl(var(--primary-active))] disabled:opacity-40 disabled:cursor-not-allowed",
};

const sizeClasses: Record<ButtonSize, string> = {
  default: "min-h-[32px] px-3 py-1 text-[13px] leading-[18px]",
  sm: "min-h-[28px] px-2.5 py-0.5 text-xs",
  lg: "min-h-[36px] px-5 py-1.5 text-sm",
  icon: "min-h-[32px] w-8 px-2 py-1",
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

  // One radius for every variant. The pill was the loudest single tell of the
  // outgoing identity, and four different corner treatments across variants was
  // never a system.
  const buttonClass = cn(
    "inline-flex items-center justify-center whitespace-nowrap rounded-[--radius] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:border disabled:border-border disabled:bg-muted disabled:text-muted-foreground gap-1.5",
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
