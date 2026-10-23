import { isCount, isJson } from "@/lib/json/guards";
import type { CarrierChannelAutomation, CarrierPrice } from "@/lib/carrier-messaging/types";

export function oneOf<T extends string>(list: readonly T[], value: unknown): value is T {
  return typeof value === "string" && (list as readonly string[]).includes(value);
}

export function parseCarrierPrice<Kind extends string>(value: unknown, kinds: readonly Kind[]): CarrierPrice<Kind> | null {
  if (!isJson(value) || !oneOf(kinds, value.charge_kind)) return null;
  const { unit_micros, quantity, total_micros } = value;
  if (!isCount(unit_micros) || !isCount(quantity) || !isCount(total_micros)) return null;
  return { charge_kind: value.charge_kind, unit_micros, quantity, total_micros };
}

const AUTOMATION_FLAGS = ["enable_agent_responses", "enable_workflow", "enable_analysis", "enable_auto_staging", "enable_auto_memory"] as const;

function nullableId(value: unknown): value is string | null {
  return value === null || value === undefined || (typeof value === "string" && value !== "");
}

export function parseNullableId(value: unknown): string | null | undefined {
  if (value === null || value === undefined || value === "") return null;
  return typeof value === "string" ? value : undefined;
}

export function parseChannelAutomation(value: unknown): CarrierChannelAutomation | null {
  if (!isJson(value) || !nullableId(value.agent_id) || !nullableId(value.workflow_id) || typeof value.disclosure !== "string") return null;
  if (!AUTOMATION_FLAGS.every((flag) => typeof value[flag] === "boolean")) return null;
  return {
    agent_id: (value.agent_id as string | null | undefined) ?? null,
    workflow_id: (value.workflow_id as string | null | undefined) ?? null,
    enable_agent_responses: value.enable_agent_responses as boolean,
    enable_workflow: value.enable_workflow as boolean,
    enable_analysis: value.enable_analysis as boolean,
    enable_auto_staging: value.enable_auto_staging as boolean,
    enable_auto_memory: value.enable_auto_memory as boolean,
    disclosure: value.disclosure,
  };
}
