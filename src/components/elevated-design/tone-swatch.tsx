import { toneCssColor, toneStyle, type ToneKey } from "@/lib/tones/tones";
import { cn } from "@/lib/utils";

export function ToneSwatch({ tone, className }: { tone: ToneKey; className?: string }) {
  const { hollow } = toneStyle(tone);
  return (
    <span
      aria-hidden="true"
      data-tone={tone}
      data-hollow={hollow ? "true" : undefined}
      className={cn("inline-block size-3 shrink-0 rounded-full", hollow && "border-2", className)}
      style={hollow ? { borderColor: toneCssColor(tone) } : { backgroundColor: toneCssColor(tone) }}
    />
  );
}

export function ToneChip({ tone, label, className }: { tone: ToneKey; label: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-1.5 rounded-full border border-border bg-card px-2 py-0.5 text-xs font-medium text-foreground",
        className,
      )}
    >
      <ToneSwatch tone={tone} className="size-2.5" />
      <span className="truncate">{label}</span>
    </span>
  );
}
