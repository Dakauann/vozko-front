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

const variantClasses: Record<BaseVariant, string> = {
  primary:
    "bg-primary text-primary-foreground hover:bg-[hsl(var(--primary-hover))] active:bg-[hsl(var(--primary-active))]",
  secondary:
    "bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/90",
  outline:
    "border border-primary/40 bg-transparent text-primary shadow-sm hover:bg-primary/10",
  "outline-subtle":
    "border-2 border-border bg-transparent text-foreground hover:border-foreground/20 hover:bg-muted",
  ghost: "bg-transparent text-[var(--text-primary)] hover:bg-black/5",
  vsl: "bg-gradient-to-r from-cyan-500 to-emerald-500 text-white shadow hover:from-cyan-500/90 hover:to-emerald-500/90",
  action:
    "bg-primary text-primary-foreground min-h-[40px] px-4 gap-[6px] rounded-[10px] hover:bg-[hsl(var(--primary-hover))] active:bg-[hsl(var(--primary-active))] disabled:bg-[#898988] disabled:opacity-100 disabled:cursor-not-allowed",
};

const sizeClasses: Record<ButtonSize, string> = {
  default: "min-h-[36px] px-5 py-1.5 text-[13px] leading-[18px]",
  sm: "min-h-[32px] px-4 py-1 text-xs",
  lg: "min-h-[42px] px-9 py-2 text-base",
  icon: "min-h-[32px] w-9 px-3 py-1",
};

function resolveIconColorClass(variant: BaseVariant) {
  switch (variant) {
    case "primary":
    case "vsl":
    case "action":
      return "text-primary-foreground";
    case "secondary":
      return "text-secondary-foreground";
    case "outline-subtle":
      return "text-foreground";
    case "outline":
    case "ghost":
    default:
      return "text-primary";
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

  const buttonClass = cn(
    "inline-flex items-center justify-center whitespace-nowrap font-semibold transition-all duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 gap-[6px]",
    effectiveSize !== "icon" && "min-w-16",
    resolvedVariant === "ghost"
      ? "rounded-lg"
      : resolvedVariant === "action"
        ? "rounded-[10px]"
        : resolvedVariant === "outline-subtle"
          ? "rounded-xl"
          : "rounded-full",
    sizeClasses[effectiveSize],
    variantClasses[resolvedVariant],
    className,
  );

  const iconClass = cn(
    "flex h-4 w-4 items-center justify-center [&>svg]:h-4 [&>svg]:w-4 transition-colors",
    iconColor
      ? undefined
      : resolvedVariant === "ghost"
        ? "text-[var(--text-primary)]"
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
