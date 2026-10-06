import { cn } from "@/lib/utils";

export function KeyDiamond({ filled, className }: { filled: boolean; className?: string }) {
  return (
    <svg viewBox="0 0 10 10" aria-hidden className={cn("h-2.5 w-2.5", className)}>
      <path d="M5 0.8 9.2 5 5 9.2 0.8 5Z" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.3" />
    </svg>
  );
}
