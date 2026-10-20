export const CRM_VIEW_MODES = ["classic", "funnel", "table"] as const;

export type CrmViewMode = (typeof CRM_VIEW_MODES)[number];

const MODE_PARAM = "mode";
const DEFAULT_MODE: CrmViewMode = "classic";

function isCrmViewMode(value: string | null): value is CrmViewMode {
  return value !== null && (CRM_VIEW_MODES as readonly string[]).includes(value);
}

export function readViewMode(search: string): CrmViewMode | null {
  const mode = new URLSearchParams(search).get(MODE_PARAM);
  return isCrmViewMode(mode) ? mode : null;
}

export function withViewMode(search: string, mode: CrmViewMode): string {
  const params = new URLSearchParams(search);
  if (mode === DEFAULT_MODE) params.delete(MODE_PARAM);
  else params.set(MODE_PARAM, mode);
  const query = params.toString();
  return query ? `?${query}` : "";
}
