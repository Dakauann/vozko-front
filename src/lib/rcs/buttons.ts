import type { RcsSuggestion } from "@/lib/rcs/types";

export const RCS_BUTTON_ACTIONS = ["reply", "open_url", "webview", "dial", "view_location", "calendar"] as const;

export type RcsButtonAction = (typeof RCS_BUTTON_ACTIONS)[number];

export function buttonActionOf(suggestion: RcsSuggestion): RcsButtonAction {
  if (suggestion.kind === "open_url" && suggestion.webview) return "webview";
  return suggestion.kind;
}

export function suggestionWithAction(suggestion: RcsSuggestion, action: RcsButtonAction): RcsSuggestion {
  const label = suggestion.label;
  switch (action) {
    case "reply":
      return { kind: "reply", label };
    case "open_url":
      return { kind: "open_url", label, url: suggestion.url ?? "" };
    case "webview":
      return { kind: "open_url", label, url: suggestion.url ?? "", webview: true };
    case "dial":
      return { kind: "dial", label, phone: suggestion.phone ?? "" };
    case "view_location":
      return {
        kind: "view_location",
        label,
        location_label: suggestion.location_label ?? "",
        ...(suggestion.latitude !== undefined ? { latitude: suggestion.latitude } : {}),
        ...(suggestion.longitude !== undefined ? { longitude: suggestion.longitude } : {}),
      };
    case "calendar":
      return { kind: "calendar", label, calendar: suggestion.calendar ?? { title: "", starts_at: "", ends_at: "" } };
  }
}

export function newSuggestion(label: string): RcsSuggestion {
  return { kind: "reply", label };
}
