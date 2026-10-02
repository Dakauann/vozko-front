import { EMPTY_VALUE } from "@/lib/advertising/money";

export function formatWhen(iso: string | null | undefined, tag: string, withTime = true): string {
  if (!iso) return EMPTY_VALUE;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime()) || date.getUTCFullYear() < 1971) return EMPTY_VALUE;
  return new Intl.DateTimeFormat(tag, withTime ? { dateStyle: "short", timeStyle: "short" } : { dateStyle: "short" }).format(date);
}
