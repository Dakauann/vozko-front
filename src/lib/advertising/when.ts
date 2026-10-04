import { emptyValue } from "@/lib/format/empty-value";

export function formatWhen(iso: string | null | undefined, tag: string, withTime = true): string {
  if (!iso) return emptyValue(tag);
  const date = new Date(iso);
  if (Number.isNaN(date.getTime()) || date.getUTCFullYear() < 1971) return emptyValue(tag);
  return new Intl.DateTimeFormat(tag, withTime ? { dateStyle: "short", timeStyle: "short" } : { dateStyle: "short" }).format(date);
}
