"use client";

import { CircleNotch } from "@/components/icons";
import { cn } from "@/lib/utils";

export interface LoaderProps {
  size?: "sm" | "md" | "lg" | "xl";
  variant?: "primary" | "emerald" | "purple" | "gradient";
  message?: string;
  className?: string;
  fullPage?: boolean;
}

const sizeConfig = {
  sm: { spinner: "h-5 w-5", text: "text-xs", gap: "gap-2" },
  md: { spinner: "h-8 w-8", text: "text-sm", gap: "gap-3" },
  lg: { spinner: "h-10 w-10", text: "text-sm", gap: "gap-3" },
  xl: { spinner: "h-12 w-12", text: "text-base", gap: "gap-4" },
};

const variantConfig = {
  primary: "text-primary-ink",
  emerald: "text-healthy dark:text-healthy",
  purple: "text-muted-foreground dark:text-chart-4",
  gradient: "text-primary-ink",
};

export function Loader({
  size = "lg",
  variant = "gradient",
  message,
  className,
  fullPage = false,
}: LoaderProps) {
  const sizes = sizeConfig[size];
  const color = variantConfig[variant];

  const loader = (
    <div className={cn("flex flex-col items-center", sizes.gap, className)}>
      <CircleNotch
        className={cn(sizes.spinner, "animate-spin", color)}
        weight="bold"
      />
      {message && (
        <p className={cn("font-medium text-muted-foreground", sizes.text)}>
          {message}
        </p>
      )}
    </div>
  );

  if (fullPage) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-background">
        {loader}
      </div>
    );
  }

  return loader;
}

export function SimpleLoader({
  size = "md",
  variant = "primary",
  className,
}: Pick<LoaderProps, "size" | "variant" | "className">) {
  const sizes = sizeConfig[size];
  const color = variantConfig[variant];

  return (
    <CircleNotch
      className={cn(sizes.spinner, "animate-spin", color, className)}
      weight="bold"
    />
  );
}

export function SkeletonLoader({
  className,
  count = 1,
}: {
  className?: string;
  count?: number;
}) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className={cn(
            "h-4 animate-pulse rounded-md bg-muted",
            className,
          )}
        />
      ))}
    </>
  );
}

export default Loader;
