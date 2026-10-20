"use client";

import { createContext, memo, useContext } from "react";

import { entryPointCopy } from "@/lib/workflows/entry-points";
import type { EntryPoint } from "@/lib/workflows/types";

import { EntryLastCall, EntryReadinessDot, useEntryPointText } from "./entry-point-chips";

export const EntryPointsContext = createContext<ReadonlyMap<string, EntryPoint> | null>(null);

function TriggerEntryMarkView({ nodeId }: { nodeId: string }) {
  const entry = useContext(EntryPointsContext)?.get(nodeId);
  const text = useEntryPointText();
  if (!entry) return null;
  const copy = entryPointCopy(entry);
  const inline = text.inline(copy);
  return (
    <div className="space-y-0.5 border-t border-border px-2.5 py-1.5 text-2xs leading-snug">
      <p className="flex items-center gap-1.5 text-muted-foreground">
        <span role="img" aria-label={text.status(copy)} className="inline-flex">
          <EntryReadinessDot ready={copy.ready} />
        </span>
        <span className="truncate">
          <EntryLastCall at={entry.lastReceivedAt} />
        </span>
      </p>
      {inline && <p className="text-foreground">{inline}</p>}
    </div>
  );
}

export const TriggerEntryMark = memo(TriggerEntryMarkView);
