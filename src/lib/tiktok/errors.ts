const ERROR_BY_STATUS = {
  404: "not_found",
  409: "unavailable",
  422: "invalid",
  429: "rate_limited",
  502: "tiktok_failed",
} as const;

type KnownStatus = keyof typeof ERROR_BY_STATUS;

export type TiktokErrorCode = (typeof ERROR_BY_STATUS)[KnownStatus];

export const TIKTOK_ERROR_CODES: readonly TiktokErrorCode[] = Object.values(ERROR_BY_STATUS);

export type TiktokErrorKey = `errors.${TiktokErrorCode}` | "errors.generic";

function isKnownStatus(status: number | undefined): status is KnownStatus {
  return status !== undefined && Object.hasOwn(ERROR_BY_STATUS, status);
}

export function tiktokErrorKey(status: number | undefined): TiktokErrorKey {
  return isKnownStatus(status) ? `errors.${ERROR_BY_STATUS[status]}` : "errors.generic";
}
