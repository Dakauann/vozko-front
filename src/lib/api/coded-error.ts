export interface CodedTranslator {
  (key: string): string;
  has: (key: string) => boolean;
}

export interface CodedError {
  message?: string;
  code?: string;
  status?: number;
}

export function codedErrorMessage(t: CodedTranslator, error: CodedError, fallback: string): string {
  const key = `errors.${error.code ?? ""}`;
  if (error.code && t.has(key)) return t(key);
  return fallback;
}

export function codedErrorOf(error: CodedError): CodedError {
  return { message: error.message, code: error.code, status: error.status };
}

export interface CodedRefusal extends CodedError {
  expected?: Record<string, string>;
}

export function codedRefusalOf(error: CodedRefusal): CodedRefusal {
  return { ...codedErrorOf(error), ...(error.expected ? { expected: error.expected } : {}) };
}
