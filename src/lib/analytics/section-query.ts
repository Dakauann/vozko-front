const BUSY_STATUS = 503;
const BUSY_RETRIES = 3;
const BUSY_RETRY_DELAY_MS = 5_000;
const TRANSIENT_RETRIES = 1;
const TRANSIENT_RETRY_DELAY_MS = 1_000;

export const SECTION_STALE_MS = 60_000;
export const SECTION_GC_MS = 5 * 60_000;

export class SectionError extends Error {
  readonly status?: number;
  readonly code?: string;

  constructor(message: string, status?: number, code?: string) {
    super(message);
    this.name = "SectionError";
    this.status = status;
    this.code = code;
  }
}

export interface SectionResponse<T> {
  data?: T;
  error?: { message: string; status?: number; code?: string };
}

export function requireSectionData<T>(response: SectionResponse<T>, what: string): T {
  if (response.error) {
    throw new SectionError(response.error.message, response.error.status, response.error.code);
  }
  if (!response.data) {
    throw new SectionError(`${what} came back empty`);
  }
  return response.data;
}

export function sectionErrorCode(error: unknown): string | undefined {
  return error instanceof SectionError ? error.code : undefined;
}

export function isBusySectionError(error: unknown): boolean {
  return error instanceof SectionError && error.status === BUSY_STATUS && !error.code;
}

function isTransient(status: number | undefined): boolean {
  return status === undefined || status >= 500;
}

export function shouldRetrySection(failureCount: number, error: unknown): boolean {
  const status = error instanceof SectionError ? error.status : undefined;
  if (status === BUSY_STATUS) return isBusySectionError(error) && failureCount < BUSY_RETRIES;
  if (isTransient(status)) return failureCount < TRANSIENT_RETRIES;
  return false;
}

export function sectionRetryDelay(_failureCount: number, error: unknown): number {
  const status = error instanceof SectionError ? error.status : undefined;
  return status === BUSY_STATUS ? BUSY_RETRY_DELAY_MS : TRANSIENT_RETRY_DELAY_MS;
}
