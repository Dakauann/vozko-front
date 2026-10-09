import { cn } from "@/lib/utils";

export interface RetryNoticeProps {
  message: string;
  retryLabel: string;
  onRetry?: () => void;
  retrying?: boolean;
  className?: string;
}

export function RetryNotice({ message, retryLabel, onRetry, retrying = false, className }: RetryNoticeProps) {
  return (
    <span role="status" className={cn("inline-flex flex-wrap items-center gap-1.5 text-2xs text-muted-foreground", className)}>
      {message}
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          disabled={retrying}
          className={cn(
            "rounded-sm font-medium text-foreground underline-offset-2 hover:underline disabled:opacity-60",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          )}
        >
          {retryLabel}
        </button>
      ) : null}
    </span>
  );
}
