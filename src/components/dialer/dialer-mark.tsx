import { cn } from "@/lib/utils";

const KEYS = [0, 1, 2].flatMap((row) => [0, 1, 2].map((col) => ({ x: 6 + col * 9, y: 1 + row * 8.5 })));

export function DialerMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 36 36" fill="none" aria-hidden="true" focusable="false" className={cn("h-5 w-5 shrink-0", className)}>
      {KEYS.map((key) => (
        <rect key={`${key.x}-${key.y}`} x={key.x} y={key.y} width="6" height="6" rx="1.5" fill="currentColor" />
      ))}
      <path d="M18 27l3 3-3 3-3-3z" fill="var(--elo-accent, var(--icon-accent))" />
    </svg>
  );
}
