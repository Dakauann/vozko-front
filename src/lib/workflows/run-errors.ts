export type AccessRefusal = "forbidden" | "not_found";

export const ACCESS_REFUSAL_KEYS: Record<AccessRefusal, string> = {
  forbidden: "forbidden",
  not_found: "notFound",
};

const REFUSAL_BY_STATUS: ReadonlyMap<number, AccessRefusal> = new Map([
  [403, "forbidden"],
  [404, "not_found"],
]);

export function accessRefusalOf(status: number | undefined): AccessRefusal | null {
  return status === undefined ? null : (REFUSAL_BY_STATUS.get(status) ?? null);
}

export const RUN_ERROR_REASON_KEYS: Readonly<Record<string, string>> = {
  cancelled_by_operator: "cancelledByOperator",
  conversation_finished: "conversationFinished",
};

export function runErrorReasonKey(error: string | undefined): string | null {
  if (!error || !Object.hasOwn(RUN_ERROR_REASON_KEYS, error)) return null;
  return RUN_ERROR_REASON_KEYS[error];
}
