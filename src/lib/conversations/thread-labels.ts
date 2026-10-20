export type DayLabel =
  | { kind: "today" }
  | { kind: "yesterday" }
  | { kind: "date"; text: string }
  | { kind: "unknown" };

export type MediaLabelKey = "image" | "video" | "audio" | "document";

function parse(iso: string): Date | null {
  if (!iso) return null;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
}

function dayBefore(date: Date): Date {
  const previous = new Date(date);
  previous.setDate(previous.getDate() - 1);
  return previous;
}

export function dayLabel(iso: string, now: Date, locale: string): DayLabel {
  const date = parse(iso);
  if (!date) return { kind: "unknown" };
  if (date.toDateString() === now.toDateString()) return { kind: "today" };
  if (date.toDateString() === dayBefore(now).toDateString()) return { kind: "yesterday" };
  return {
    kind: "date",
    text: new Intl.DateTimeFormat(locale, { day: "2-digit", month: "long", year: "numeric" }).format(date),
  };
}

export function messageTime(iso: string, locale: string): string | null {
  const date = parse(iso);
  if (!date) return null;
  return new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit" }).format(date);
}

export function mediaLabelKey(mediaType: string): MediaLabelKey {
  return mediaType === "image" || mediaType === "video" || mediaType === "audio" ? mediaType : "document";
}

export function fullDateTime(iso: string, locale: string): string | null {
  const date = parse(iso);
  if (!date) return null;
  return new Intl.DateTimeFormat(locale, { dateStyle: "long", timeStyle: "short" }).format(date);
}

export type ReadAtLabel = { kind: "same-day"; text: string } | { kind: "other-day"; text: string };

export function readAtLabel(sentIso: string, readIso: string | null | undefined, locale: string): ReadAtLabel | null {
  const read = parse(readIso ?? "");
  if (!read) return null;
  const sent = parse(sentIso);
  const sameDay = sent !== null && sent.toDateString() === read.toDateString();
  const text = sameDay ? messageTime(read.toISOString(), locale) : fullDateTime(read.toISOString(), locale);
  if (!text) return null;
  return sameDay ? { kind: "same-day", text } : { kind: "other-day", text };
}
