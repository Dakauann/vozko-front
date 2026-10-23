export const GOOGLE_PRODUCTS = ["calendar", "sheets"] as const;

export type GoogleProduct = (typeof GOOGLE_PRODUCTS)[number];

export type GoogleAccountStatus = "connected" | "needs_reconnect" | "disconnected";

export interface GoogleProductStatus {
  product: GoogleProduct;
  connected: boolean;
  status: GoogleAccountStatus;
  email?: string;
  statusReason?: string;
  connectedAt?: string;
}

export const GOOGLE_CONNECT_ERRORS = [
  "invalid_state",
  "expired_state",
  "google_account_not_connected",
  "google_account_needs_reconnect",
  "google_account_unknown_product",
  "google_account_scope_not_granted",
  "google_account_authorization_declined",
  "google_account_connect_failed",
] as const;

export type GoogleConnectError = (typeof GOOGLE_CONNECT_ERRORS)[number];

export type GoogleConnectResult =
  | { status: "connected"; product?: GoogleProduct; email?: string }
  | { status: "error"; product?: GoogleProduct; reason: GoogleConnectError }
  | { status: "cancelled" };
