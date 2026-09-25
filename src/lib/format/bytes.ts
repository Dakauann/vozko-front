const UNITS = ["B", "KB", "MB", "GB"];
const STEP = 1024;

export function formatBytes(bytes: number, locale: string): string {
  let value = Math.max(bytes, 0);
  let unit = 0;
  while (value >= STEP && unit < UNITS.length - 1) {
    value /= STEP;
    unit += 1;
  }
  const digits = unit === 0 ? 0 : 1;
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: digits }).format(value)} ${UNITS[unit]}`;
}

export function megabytesToBytes(megabytes: number | undefined): number {
  return Math.round((megabytes ?? 0) * STEP * STEP);
}
