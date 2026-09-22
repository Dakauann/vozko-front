import { cn } from "@/lib/utils";

export function LightPool({
  className,
  tone = "ambient",
}: {
  className?: string;
  tone?: "ambient" | "quiet";
}) {
  const scale = tone === "quiet" ? 0.5 : 1;
  return (
    <div
      aria-hidden="true"
      className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}
      style={{
        background: [
          `radial-gradient(58% 46% at 62% 48%, hsl(var(--primary) / calc(var(--pool-brand) * ${scale})), transparent 72%)`,
          `radial-gradient(38% 34% at 12% 78%, hsl(var(--info) / calc(var(--pool-cool) * ${scale})), transparent 74%)`,
        ].join(", "),
      }}
    />
  );
}
