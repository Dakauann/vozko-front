import { useCallback } from "react";
import { useUpdateNodeInternals } from "@xyflow/react";

type UpdateInternals = (ids: string[]) => void;

const queues = new Map<UpdateInternals, Set<string>>();

export function queueNodeInternals(update: UpdateInternals, id: string): void {
  const queued = queues.get(update);
  if (queued) {
    queued.add(id);
    return;
  }
  queues.set(update, new Set([id]));
  queueMicrotask(() => {
    const ids = queues.get(update);
    queues.delete(update);
    if (ids) update([...ids]);
  });
}

export function useBatchedNodeInternals(): (id: string) => void {
  const update = useUpdateNodeInternals();
  return useCallback((id: string) => queueNodeInternals(update, id), [update]);
}
