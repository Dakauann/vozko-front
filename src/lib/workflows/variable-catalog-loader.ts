import type { VariableCatalog } from "./variable-catalog";

export type CatalogAnswer = { catalog: VariableCatalog } | { error: string; code?: string; status?: number } | { unavailable: true };

export interface CatalogDraft {
  workflowId: string | null;
  revision: number | null;
}

export interface CatalogLoader {
  load: (draft: CatalogDraft, nodeId: string) => Promise<CatalogAnswer>;
  peek: (draft: CatalogDraft, nodeId: string) => VariableCatalog | null;
}

const UNAVAILABLE: CatalogAnswer = { unavailable: true };

function cacheKey(draft: CatalogDraft, nodeId: string): string | null {
  return draft.workflowId ? `${draft.workflowId}:${draft.revision ?? ""}:${nodeId}` : null;
}

export function createCatalogLoader(read: (workflowId: string, nodeId: string) => Promise<CatalogAnswer>): CatalogLoader {
  const pending = new Map<string, Promise<CatalogAnswer>>();
  const ready = new Map<string, VariableCatalog>();

  const load = (draft: CatalogDraft, nodeId: string): Promise<CatalogAnswer> => {
    const key = cacheKey(draft, nodeId);
    if (!key || !draft.workflowId) return Promise.resolve(UNAVAILABLE);
    const known = pending.get(key);
    if (known) return known;
    const request = read(draft.workflowId, nodeId).then((answer) => {
      if ("catalog" in answer) ready.set(key, answer.catalog);
      else pending.delete(key);
      return answer;
    });
    pending.set(key, request);
    return request;
  };

  const peek = (draft: CatalogDraft, nodeId: string): VariableCatalog | null => {
    const key = cacheKey(draft, nodeId);
    return key ? (ready.get(key) ?? null) : null;
  };

  return { load, peek };
}
