export interface MemberExportTarget {
  groupIds?: string[];
  seriesId?: string;
}

export function memberExportQuery(target: MemberExportTarget): string | null {
  const ids = [...new Set((target.groupIds ?? []).map((id) => id.trim()).filter(Boolean))];
  const series = target.seriesId?.trim() ?? "";
  if (ids.length === 0 && !series) return null;
  const params = new URLSearchParams();
  if (ids.length > 0) params.set("groupIds", ids.join(","));
  if (series) params.set("seriesId", series);
  return `?${params.toString()}`;
}
