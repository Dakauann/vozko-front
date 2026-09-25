import { cn } from "@/lib/utils";

/** Angular E with Vozko's clipped edges, teal circuit and diamond. */
export function EloMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 36 36" fill="none" aria-hidden="true" focusable="false" className={cn("h-8 w-8 shrink-0", className)}>
      <path d="M5 3h25l-5 5H11v15h19l-5 5H5z" fill="currentColor" />
      <path d="M11 13h11l5-5h5v4h-3l-5 5H11zM16 29l3 3-3 3-3-3z" fill="var(--elo-accent, var(--icon-accent))" />
    </svg>
  );
}

export function EloAvatar({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-control-edge bg-card text-foreground", className)}>
      <EloMark className="h-6 w-6" />
    </span>
  );
}
