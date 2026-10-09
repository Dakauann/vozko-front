import { useId, type ReactNode } from "react";

import { cn } from "@/lib/utils";

export function SheetSection({
  icon,
  title,
  children,
  className,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
  className?: string;
}) {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className={cn("space-y-3 border-b border-border px-4 py-5 last:border-b-0 sm:px-6", className)}>
      <h3 id={headingId} className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <span className="flex h-4 w-4 items-center justify-center text-muted-foreground [&>svg]:h-4 [&>svg]:w-4">{icon}</span>
        {title}
      </h3>
      {children}
    </section>
  );
}

export function SheetHint({ children, tone = "muted", className }: { children: ReactNode; tone?: "muted" | "error" | "info"; className?: string }) {
  return (
    <p
      className={cn(
        "pl-1 text-xs",
        tone === "error" && "text-destructive-ink",
        tone === "info" && "text-info-ink",
        tone === "muted" && "text-muted-foreground",
        className,
      )}
    >
      {children}
    </p>
  );
}

export function SheetLinkButton({
  children,
  onClick,
  disabled,
  icon,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  icon?: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex min-h-[34px] items-center gap-1.5 rounded-[--radius] px-1 text-sm font-medium text-primary-ink transition-colors hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:text-muted-foreground sm:min-h-[28px]"
    >
      {icon ? <span className="flex h-3.5 w-3.5 items-center justify-center [&>svg]:h-3.5 [&>svg]:w-3.5">{icon}</span> : null}
      {children}
    </button>
  );
}

export function SheetIconButton({
  label,
  onClick,
  children,
  disabled,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[--radius] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 sm:h-8 sm:w-8 [&>svg]:h-3.5 [&>svg]:w-3.5"
    >
      {children}
    </button>
  );
}
