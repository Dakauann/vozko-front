import { cn } from "@/lib/utils";

export function SmartSendMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 36 36" fill="none" aria-hidden="true" focusable="false" className={cn("h-8 w-8 shrink-0", className)}>
      <rect x="3" y="23" width="8" height="10" rx="1.5" fill="currentColor" opacity="0.55" />
      <rect x="14" y="16" width="8" height="17" rx="1.5" fill="currentColor" opacity="0.8" />
      <rect x="25" y="9" width="8" height="24" rx="1.5" fill="currentColor" />
      <path d="M7 12l3 3-3 3-3-3zM18 5l3 3-3 3-3-3z" fill="var(--elo-accent, var(--icon-accent))" />
    </svg>
  );
}

export function SmartSendBadge({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-control-edge bg-card text-foreground", className)}>
      <SmartSendMark className="h-6 w-6" />
    </span>
  );
}
