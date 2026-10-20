import type { InboxEntry } from "./types";

export interface HeldInbox {
  entries: InboxEntry[];
  pending: number;
}

export function inboxEntryKey(entry: Pick<InboxEntry, "entry_id" | "entry_type">): string {
  return `${entry.entry_type}-${entry.entry_id}`;
}

function longestIncreasingRun(sequence: readonly number[]): number {
  const tails: number[] = [];
  for (const value of sequence) {
    let low = 0;
    let high = tails.length;
    while (low < high) {
      const middle = (low + high) >> 1;
      if (tails[middle] < value) low = middle + 1;
      else high = middle;
    }
    tails[low] = value;
  }
  return tails.length;
}

export function holdPlacement(heldKeys: readonly string[], live: readonly InboxEntry[]): HeldInbox {
  const heldPosition = new Map(heldKeys.map((key, index) => [key, index]));
  const liveKeys = live.map(inboxEntryKey);
  const liveByKey = new Map(live.map((entry, index) => [liveKeys[index], entry]));
  const lastHeldIndex = liveKeys.findLastIndex((key) => heldPosition.has(key));

  const kept = heldKeys.flatMap((key) => {
    const entry = liveByKey.get(key);
    return entry ? [entry] : [];
  });
  const appended = live.slice(lastHeldIndex + 1);
  const arrivedAbove = liveKeys.slice(0, lastHeldIndex + 1).filter((key) => !heldPosition.has(key)).length;
  const heldOrderInLive = liveKeys.flatMap((key) => {
    const position = heldPosition.get(key);
    return position === undefined ? [] : [position];
  });
  const moved = heldOrderInLive.length - longestIncreasingRun(heldOrderInLive);

  return { entries: [...kept, ...appended], pending: arrivedAbove + moved };
}
