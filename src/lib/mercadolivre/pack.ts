import type { StatusChipTone } from "@/components/elevated-design/status-chip";
import { formatMicros } from "@/lib/advertising/money";
import { refuseUnhandled } from "@/lib/exhaustive";
import type { MercadoLivreActionError, MercadoLivrePackSummary } from "@/lib/mercadolivre/types";

export const MERCADOLIVRE_ORDER_STATUSES = [
  "confirmed",
  "payment_required",
  "payment_in_process",
  "partially_paid",
  "paid",
  "partially_refunded",
  "pending_cancel",
  "cancelled",
  "invalid",
] as const;

export type MercadoLivreOrderStatus = (typeof MERCADOLIVRE_ORDER_STATUSES)[number];

export const MERCADOLIVRE_SHIPPING_STATUSES = [
  "to_be_agreed",
  "pending",
  "handling",
  "ready_to_ship",
  "shipped",
  "delivered",
  "not_delivered",
  "not_verified",
  "cancelled",
  "closed",
  "error",
  "active",
  "not_specified",
  "stale",
] as const;

export type MercadoLivreShippingStatus = (typeof MERCADOLIVRE_SHIPPING_STATUSES)[number];

export const MERCADOLIVRE_SHIPPING_SUBSTATUSES = [
  "cost_exceeded",
  "under_review",
  "waiting_for_label_generation",
  "regenerating",
  "buffered",
  "creating_route",
  "manufacturing",
  "invoice_pending",
  "ready_to_print",
  "printed",
  "ready_to_pack",
  "in_packing_list",
  "packed",
  "in_warehouse",
  "in_pickup_list",
  "ready_for_pickup",
  "ready_for_dropoff",
  "picked_up",
  "dropped_off",
  "authorized_by_carrier",
  "in_hub",
  "out_for_delivery",
  "soon_deliver",
  "waiting_for_withdrawal",
  "receiver_absent",
  "not_visited",
  "bad_address",
  "changed_address",
  "at_customs",
  "delayed",
  "delivery_failed",
  "returning_to_sender",
  "returned",
  "retained",
  "to_review",
  "claimed_me",
  "lost",
  "damaged",
  "stolen",
  "label_expired",
  "fraudulent",
  "inferred",
] as const;

export type MercadoLivreShippingSubstatus = (typeof MERCADOLIVRE_SHIPPING_SUBSTATUSES)[number];

export type PackStatusLabel<K extends string> = { key: K } | { raw: string };

export type PackLoad =
  | { state: "ready"; pack: MercadoLivrePackSummary }
  | { state: "pending" }
  | { state: "forbidden" }
  | { state: "failed" };

export const PACK_PENDING_RETRY_MS = 10_000;

const MICROS_PER_UNIT = 1_000_000;

function known<T extends string>(catalog: readonly T[], raw: string): T | null {
  return (catalog as readonly string[]).includes(raw) ? (raw as T) : null;
}

function labelOf<T extends string, P extends string>(
  catalog: readonly T[],
  prefix: P,
  raw: string | undefined,
): PackStatusLabel<`${P}.${T}`> | null {
  const value = (raw ?? "").trim();
  if (value === "") return null;
  const status = known(catalog, value);
  return status ? { key: `${prefix}.${status}` } : { raw: value };
}

export function orderStatusLabel(raw: string | undefined) {
  return labelOf(MERCADOLIVRE_ORDER_STATUSES, "orderStatus", raw);
}

export function shippingStatusLabel(raw: string | undefined) {
  return labelOf(MERCADOLIVRE_SHIPPING_STATUSES, "shippingStatus", raw);
}

export function shippingSubstatusLabel(raw: string | undefined) {
  return labelOf(MERCADOLIVRE_SHIPPING_SUBSTATUSES, "shippingSubstatus", raw);
}

export function orderStatusTone(raw: string): StatusChipTone {
  const status = known(MERCADOLIVRE_ORDER_STATUSES, raw);
  if (status === null) return "muted";
  switch (status) {
    case "paid":
      return "healthy";
    case "cancelled":
    case "invalid":
      return "fault";
    case "payment_required":
    case "payment_in_process":
    case "partially_paid":
    case "partially_refunded":
    case "pending_cancel":
      return "warning";
    case "confirmed":
      return "outline";
    default:
      return refuseUnhandled(status, "muted");
  }
}

export function shippingStatusTone(raw: string): StatusChipTone {
  const status = known(MERCADOLIVRE_SHIPPING_STATUSES, raw);
  if (status === null) return "muted";
  switch (status) {
    case "delivered":
      return "healthy";
    case "not_delivered":
    case "cancelled":
    case "error":
      return "fault";
    case "to_be_agreed":
    case "pending":
    case "handling":
    case "ready_to_ship":
    case "shipped":
    case "active":
      return "outline";
    case "not_verified":
    case "closed":
    case "not_specified":
    case "stale":
      return "muted";
    default:
      return refuseUnhandled(status, "muted");
  }
}

export function packLoadOf(result: { pack: MercadoLivrePackSummary } | MercadoLivreActionError): PackLoad {
  if ("pack" in result) return { state: "ready", pack: result.pack };
  if (result.code === "pack_summary_pending") return { state: "pending" };
  if (result.status === 403) return { state: "forbidden" };
  return { state: "failed" };
}

export function packMoney(amount: number, currency: string, locale: string): string {
  return formatMicros(Math.round(amount * MICROS_PER_UNIT), currency, locale);
}
