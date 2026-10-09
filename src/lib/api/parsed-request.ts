import { apiClient } from "@/lib/api/browser-client";
import { codedErrorOf, type CodedError } from "@/lib/api/coded-error";

const EMPTY_ANSWER: CodedError = { message: "Empty response" };

export type ParsedAnswer<T> = { data: T; error: null } | { data: null; error: CodedError };

export async function parsedRequest<T>(path: string, init: RequestInit, parse: (value: unknown) => T | null): Promise<ParsedAnswer<T>> {
  const response = await apiClient<unknown>(path, init);
  if (response.error) return { data: null, error: codedErrorOf(response.error) };
  const parsed = parse(response.data);
  return parsed ? { data: parsed, error: null } : { data: null, error: EMPTY_ANSWER };
}
