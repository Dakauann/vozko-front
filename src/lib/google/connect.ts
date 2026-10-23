import {
  GOOGLE_CONNECT_ERRORS,
  GOOGLE_PRODUCTS,
  type GoogleConnectError,
  type GoogleConnectResult,
  type GoogleProduct,
} from "@/lib/google/types";

export const GOOGLE_POPUP_SOURCE = "google-login";

export function googleStartPath(product: GoogleProduct): string {
  return `/oauth/google/${product}/start`;
}

function productOf(value: unknown): GoogleProduct | undefined {
  return typeof value === "string" && (GOOGLE_PRODUCTS as readonly string[]).includes(value) ? (value as GoogleProduct) : undefined;
}

export function googleConnectErrorOf(reason: unknown): GoogleConnectError {
  return typeof reason === "string" && (GOOGLE_CONNECT_ERRORS as readonly string[]).includes(reason)
    ? (reason as GoogleConnectError)
    : "google_account_connect_failed";
}

function resultOf(status: unknown, product: unknown, email: unknown, reason: unknown): GoogleConnectResult | null {
  const known = productOf(product);
  if (status === "connected") {
    return { status, product: known, email: typeof email === "string" && email !== "" ? email : undefined };
  }
  if (status === "error") return { status, product: known, reason: googleConnectErrorOf(reason) };
  return null;
}

export function googleResultFromMessage(data: Record<string, unknown>): GoogleConnectResult | null {
  return resultOf(data.status, data.product, data.email, data.reason);
}

export function googleResultFromQuery(params: URLSearchParams): GoogleConnectResult | null {
  return resultOf(params.get("google"), params.get("product"), params.get("email"), params.get("reason"));
}
