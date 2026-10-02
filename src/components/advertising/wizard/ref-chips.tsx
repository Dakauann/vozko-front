"use client";

import { X } from "@/components/icons";
import type { AdTargetRef } from "@/lib/advertising/draft-types";

export function RefChips({
  refs,
  removeLabel,
  onRemove,
}: {
  refs: AdTargetRef[];
  removeLabel: (name: string) => string;
  onRemove: (ref: AdTargetRef) => void;
}) {
  if (refs.length === 0) return null;
  return (
    <ul className="flex flex-wrap gap-1.5">
      {refs.map((ref) => (
        <li
          key={ref.id}
          className="inline-flex max-w-full items-center gap-1 rounded-[--radius] border border-border bg-muted py-0.5 pl-2.5 pr-1 text-xs text-foreground"
        >
          <span className="truncate">{ref.name}</span>
          <button
            type="button"
            onClick={() => onRemove(ref)}
            aria-label={removeLabel(ref.name)}
            className="inline-flex h-5 w-5 items-center justify-center rounded-[--radius] text-muted-foreground hover:bg-card hover:text-foreground"
          >
            <X className="h-3 w-3" aria-hidden />
          </button>
        </li>
      ))}
    </ul>
  );
}

export function addRef(refs: AdTargetRef[] | undefined, ref: AdTargetRef): AdTargetRef[] {
  const list = refs ?? [];
  return list.some((candidate) => candidate.id === ref.id) ? list : [...list, ref];
}

export function removeRef(refs: AdTargetRef[] | undefined, ref: AdTargetRef): AdTargetRef[] {
  return (refs ?? []).filter((candidate) => candidate.id !== ref.id);
}
