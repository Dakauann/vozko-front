export const TIME_ZONE_COOKIE = "tz";
export const DEFAULT_TIME_ZONE = "America/Sao_Paulo";

export function knownTimeZone(value: string | undefined): string {
    if (!value) return DEFAULT_TIME_ZONE;
    try {
        new Intl.DateTimeFormat("en", { timeZone: value });
        return value;
    } catch {
        return DEFAULT_TIME_ZONE;
    }
}
