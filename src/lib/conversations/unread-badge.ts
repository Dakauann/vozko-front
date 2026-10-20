const UNREAD_PREFIX = /^\(\d+\+?\)\s+/;
const TITLE_CAP = 99;
const FAVICON_CAP = 9;

function capped(count: number, cap: number): string {
  return count > cap ? `${cap}+` : String(count);
}

export function titleWithoutUnread(title: string): string {
  return title.replace(UNREAD_PREFIX, "");
}

export function unreadTitle(title: string, count: number): string {
  const base = titleWithoutUnread(title);
  return count > 0 ? `(${capped(count, TITLE_CAP)}) ${base}` : base;
}

export function faviconBadgeText(count: number): string {
  return count > 0 ? capped(count, FAVICON_CAP) : "";
}
