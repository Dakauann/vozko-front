import { X } from "@/components/icons";
import { AdImage } from "@/components/advertising/ad-image";
import type { ImageReference } from "@/lib/media-generation/references";

export type ReferenceThumbnail = ImageReference;

export function ReferenceThumbnails({
  items,
  onRemove,
  removeLabel,
}: {
  items: ReferenceThumbnail[];
  onRemove?: (mediaId: string) => void;
  removeLabel?: string;
}) {
  return (
    <ul className="flex flex-wrap gap-2">
      {items.map((item) => (
        <li key={item.mediaId} className="relative h-16 w-16 shrink-0 overflow-hidden rounded-[--radius] border border-border bg-muted">
          <AdImage src={item.url} />
          {onRemove ? (
            <button
              type="button"
              onClick={() => onRemove(item.mediaId)}
              aria-label={removeLabel}
              title={removeLabel}
              className="absolute right-0.5 top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-card/90 text-foreground shadow-sm hover:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <X weight="bold" className="h-3 w-3" aria-hidden />
            </button>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
