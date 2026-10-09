import type { MapStyleFailure } from "./use-map-style";

export type MapFailureCause = MapStyleFailure | "render" | null;

export interface MapFailureView {
  messageKey: "styleError" | "styleConfigError" | "renderError";
  retry: boolean;
}

export function mapStyleFailureView(cause: MapFailureCause): MapFailureView {
  if (cause === "configuration") return { messageKey: "styleConfigError", retry: false };
  if (cause === "render" || cause === "theme") return { messageKey: "renderError", retry: false };
  return { messageKey: "styleError", retry: true };
}

export type MapStartFailureCode = "create_failed" | "start_error" | "load_timeout";

export type MapFailureCode = MapStartFailureCode | "style_configuration" | "style_unavailable" | "theme_tokens";

const STYLE_FAILURE_CODES: Record<MapStyleFailure, MapFailureCode> = {
  configuration: "style_configuration",
  unavailable: "style_unavailable",
  theme: "theme_tokens",
};

export function styleFailureCode(failure: MapStyleFailure | null): MapFailureCode {
  return STYLE_FAILURE_CODES[failure ?? "unavailable"];
}

export function reportMapFailure(code: MapFailureCode, cause: unknown): void {
  console.error(`lead map failed to start: ${code}`, cause);
}
