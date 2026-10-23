import type { CarrierChannelAutomation, CarrierPrice } from "@/lib/carrier-messaging/types";

export const SMS_ENCODINGS = ["gsm7", "ucs2"] as const;
export type SmsEncoding = (typeof SMS_ENCODINGS)[number];

export interface SmsMeasurement {
  encoding: SmsEncoding;
  units: number;
  segments: number;
  per_segment: number;
  remaining: number;
}

export const SMS_CHARGE_KINDS = ["sms_segment", "sms_inbound"] as const;
export type SmsChargeKind = (typeof SMS_CHARGE_KINDS)[number];

export type SmsPrice = CarrierPrice<SmsChargeKind>;

export interface SmsIssue {
  code: string;
}

export interface SmsTextCheckRequest {
  text: string;
  route_id?: string;
}

export interface SmsTextCheck {
  measurement: SmsMeasurement;
  composed_text: string;
  variable_slots: number;
  issues: SmsIssue[];
  price: SmsPrice;
}

export interface SmsToGsmRequest {
  text: string;
}

export interface SmsToGsmAnswer {
  text: string;
}

export const SMS_ROUTE_KINDS = ["shared", "dedicated"] as const;
export type SmsRouteKind = (typeof SMS_ROUTE_KINDS)[number];

export const SMS_ROUTE_STATUSES = ["active", "paused"] as const;
export type SmsRouteStatus = (typeof SMS_ROUTE_STATUSES)[number];

export const SMS_ROUTE_PAUSE_REASONS = ["manual"] as const;
export type SmsRoutePauseReason = (typeof SMS_ROUTE_PAUSE_REASONS)[number];

export interface SmsRoute {
  id: string;
  brand_prefix: string;
  kind: SmsRouteKind;
  number: string;
  status: SmsRouteStatus;
  pause_reason: SmsRoutePauseReason | "";
  can_send: boolean;
  department_id: string | null;
  pipeline_id: string | null;
  automation: CarrierChannelAutomation;
  created_at: string;
  workspace_id?: string;
}

export interface SmsRouteList {
  routes: SmsRoute[];
}

export interface SmsRouteInput {
  brand_prefix: string;
}
