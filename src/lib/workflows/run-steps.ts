import type { WorkflowListMeta } from "./types";

export interface RunStepsWindow {
  offset: number;
  limit: number;
  total: number;
  hasMore: boolean;
}

export const RUN_STEPS_PAGE_SIZE = 500;

export function runStepsRequest(page: number): { stepsOffset: number; stepsLimit: number } {
  return { stepsOffset: (page - 1) * RUN_STEPS_PAGE_SIZE, stepsLimit: RUN_STEPS_PAGE_SIZE };
}

export function runStepsMeta(window: RunStepsWindow | undefined, loaded: number): WorkflowListMeta {
  if (!window || window.limit <= 0) return { page: 1, pageSize: loaded, totalPages: 1, totalItems: loaded };
  const page = Math.floor(window.offset / window.limit) + 1;
  const counted = Math.ceil(window.total / window.limit);
  const totalPages = Math.max(counted, window.hasMore ? page + 1 : page);
  return { page, pageSize: window.limit, totalPages, totalItems: window.total };
}
